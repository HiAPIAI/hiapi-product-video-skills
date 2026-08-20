#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateBrief } from "./validate-ugc-brief.mjs";

const MIME_BY_EXTENSION = new Map([
  [".aac", "audio/aac"],
  [".flac", "audio/flac"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".m4a", "audio/mp4"],
  [".mov", "video/quicktime"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".png", "image/png"],
  [".wav", "audio/wav"],
  [".webm", "video/webm"],
  [".webp", "image/webp"],
]);

function parseArgs(argv) {
  const options = { preview: false, dryRun: false, resumeTaskId: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--preview") options.preview = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--resume-task-id") {
      options.resumeTaskId = String(argv[index + 1] ?? "").trim();
      index += 1;
      if (!options.resumeTaskId) throw new Error("--resume-task-id requires a task ID.");
    } else if (arg.startsWith("--resume-task-id=")) {
      options.resumeTaskId = arg.slice("--resume-task-id=".length).trim();
      if (!options.resumeTaskId) throw new Error("--resume-task-id requires a task ID.");
    }
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (!options.briefPath) options.briefPath = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if ((options.preview || options.dryRun) && options.resumeTaskId) {
    throw new Error("--preview/--dry-run and --resume-task-id cannot be used together.");
  }
  if (options.preview && options.dryRun) throw new Error("--preview and --dry-run cannot be used together.");
  return options;
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function locateSeedanceLibrary() {
  const override = process.env.HIAPI_SEEDANCE_SKILL_DIR?.trim();
  const candidates = [
    override,
    resolve(homedir(), ".codex/skills/hiapi-seedance-2-0-video-skill"),
    resolve(homedir(), ".codex/skills/hiapi-seedance-2-0-video"),
  ].filter(Boolean);

  for (const directory of candidates) {
    const library = resolve(directory, "scripts/lib/seedance-2-video.mjs");
    if (await pathExists(library)) return library;
  }

  throw new Error(
    "Could not find the adjacent HiAPI Seedance 2.0 skill. Install it or set HIAPI_SEEDANCE_SKILL_DIR to its directory.",
  );
}

function isRemoteMedia(value) {
  return /^(?:https?:\/\/|data:|asset:\/\/)/i.test(value);
}

async function toMediaValue(value, briefDirectory) {
  const clean = String(value ?? "").trim();
  if (!clean) return "";
  if (isRemoteMedia(clean)) return clean;

  const localPath = clean.startsWith("file://") ? fileURLToPath(clean) : resolve(briefDirectory, clean);
  const extension = extname(localPath).toLowerCase();
  const mime = MIME_BY_EXTENSION.get(extension);
  if (!mime) throw new Error(`Unsupported local media extension "${extension}" for ${localPath}.`);
  const bytes = await readFile(localPath);
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

async function resolveMediaList(urls, paths, briefDirectory) {
  const values = [...(Array.isArray(urls) ? urls : []), ...(Array.isArray(paths) ? paths : [])];
  return Promise.all(values.map((value) => toMediaValue(value, briefDirectory)));
}

function redactMedia(value) {
  if (typeof value === "string" && value.startsWith("data:")) return `[data-uri:${value.length} chars]`;
  return value;
}

function redactedPayload(payload) {
  const clone = structuredClone(payload);
  const input = clone.input ?? {};
  if (input.first_frame_url) input.first_frame_url = redactMedia(input.first_frame_url);
  if (input.last_frame_url) input.last_frame_url = redactMedia(input.last_frame_url);
  for (const field of ["reference_image_urls", "reference_video_urls", "reference_audio_urls"]) {
    if (Array.isArray(input[field])) input[field] = input[field].map(redactMedia);
  }
  return clone;
}

export function requestHash(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function buildOptions(brief, briefPath) {
  const creative = brief.creative;
  const production = brief.production;
  const briefDirectory = dirname(briefPath);
  const mode = String(production.mode).trim().toLowerCase();

  const options = {
    prompt: creative.seedance_prompt,
    seconds: creative.duration_seconds,
    resolution: creative.resolution,
    ratio: creative.aspect_ratio,
    generateAudio: production.generate_audio,
    storage: production.storage || "temp",
    outputDir: resolve(briefDirectory, production.output_dir || "outputs"),
  };

  if (mode === "first-frame") {
    options.firstFrameUrl = await toMediaValue(
      production.first_frame_url || production.first_frame_path,
      briefDirectory,
    );
    if (production.last_frame_url || production.last_frame_path) {
      options.lastFrameUrl = await toMediaValue(
        production.last_frame_url || production.last_frame_path,
        briefDirectory,
      );
    }
  } else if (mode === "multimodal-reference") {
    options.referenceImageUrls = await resolveMediaList(
      production.reference_image_urls,
      production.reference_image_paths,
      briefDirectory,
    );
    options.referenceVideoUrls = await resolveMediaList(
      production.reference_video_urls,
      production.reference_video_paths,
      briefDirectory,
    );
    options.referenceAudioUrls = await resolveMediaList(
      production.reference_audio_urls,
      production.reference_audio_paths,
      briefDirectory,
    );
    options.referenceVideoDurations = production.reference_video_durations;
    options.referenceAudioDurations = production.reference_audio_durations;
  }

  return options;
}

function isTransientNetworkError(error) {
  const message = `${error?.message ?? ""} ${error?.cause?.code ?? ""}`;
  return /(fetch failed|econnreset|econnrefused|etimedout|enotfound|und_err|socket|network)/i.test(message);
}

async function withTransientRetries(label, action, maxAttempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (!isTransientNetworkError(error) || attempt === maxAttempts) throw error;
      console.error(`${label} hit a transient network error; retrying (${attempt}/${maxAttempts}).`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 2000));
    }
  }
  throw lastError;
}

async function finishTask(seedance, taskId, options) {
  const config = seedance.resolveConfig();
  const { response, videoUrl } = await withTransientRetries(
    `Polling HiAPI task ${taskId}`,
    () => seedance.waitForVideo(taskId, config),
  );
  const output = { kind: "url", value: videoUrl };
  const saved = await withTransientRetries(
    `Downloading HiAPI task ${taskId}`,
    () => seedance.saveVideoOutput(videoUrl, options.outputDir),
  );
  if (saved) {
    output.kind = "file";
    output.value = saved.path;
    output.path = saved.path;
    output.mimeType = saved.mimeType;
    output.sourceUrl = videoUrl;
  }

  return {
    model: seedance.MODEL,
    taskId,
    seconds: String(options.seconds),
    resolution: options.resolution,
    ratio: options.ratio,
    generateAudio: options.generateAudio,
    storage: options.storage,
    outputs: [output],
    rawStatus: response,
  };
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  if (cli.help || !cli.briefPath) {
    console.log(
      "Usage: node scripts/run-ugc-seedance.mjs /absolute/path/to/ugc-brief.json [--preview | --dry-run | --resume-task-id <task-id>]",
    );
    return;
  }

  const briefPath = resolve(cli.briefPath);
  const brief = JSON.parse(await readFile(briefPath, "utf8"));
  const validation = validateBrief(brief);
  if (validation.warnings.length > 0) {
    console.error(`UGC brief warnings:\n- ${validation.warnings.join("\n- ")}`);
  }
  if (!validation.ok) {
    throw new Error(`UGC brief validation failed:\n- ${validation.errors.join("\n- ")}`);
  }

  const seedanceLibrary = await locateSeedanceLibrary();
  const seedance = await import(pathToFileURL(seedanceLibrary).href);
  const options = await buildOptions(brief, briefPath);

  const payload = seedance.buildVideoPayload(options);
  const hash = requestHash(payload);
  if (cli.preview) {
    console.log(JSON.stringify({
      status: "preview",
      adapter: "ugc-ad",
      campaign_id: brief.campaign_id,
      variant_id: brief.variant_id,
      request_hash: hash,
      requestHash: hash,
      networkAccess: false,
      payload: redactedPayload(payload),
    }, null, 2));
    return;
  }

  if (cli.dryRun) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dry_run: true,
          campaign_id: brief.campaign_id,
          variant_id: brief.variant_id,
          adapter: "ugc-ad",
          request_hash: hash,
          requestHash: hash,
          payload: redactedPayload(payload),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!cli.resumeTaskId && JSON.stringify(brief).includes("https://example.com/")) {
    throw new Error("The bundled demo brief contains example.com placeholder media. Replace every demo URL before a paid generation.");
  }

  let taskId = cli.resumeTaskId;
  if (taskId) {
    console.error(`Resuming HiAPI task: ${taskId}`);
  } else {
    const created = await seedance.generateVideo({ ...options, wait: false, save: false });
    taskId = created.taskId;
    console.error(`HiAPI task created: ${taskId}`);
  }

  const result = await finishTask(seedance, taskId, options);
  const { rawStatus: _rawStatus, ...summary } = result;
  console.log(
    JSON.stringify(
      {
        ok: true,
        campaign_id: brief.campaign_id,
        variant_id: brief.variant_id,
        ...summary,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
