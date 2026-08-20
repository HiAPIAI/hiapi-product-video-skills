#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = "https://api.hiapi.ai";
const DEFAULT_MAX_COST_USD = 0.5;
const KLING_T2V = "kling-3.0-omni/text-to-video";
const KLING_I2V = "kling-3.0-omni/image-to-video";
const SEEDANCE_FAST = "seedance-2.0-fast";

const VALUE_FLAGS = new Map([
  ["--scenario", "scenario"],
  ["--prompt", "prompt"],
  ["--dialogue", "dialogue"],
  ["--image-url", "imageUrl"],
  ["--image-file", "imageFile"],
  ["--duration", "duration"],
  ["--resolution", "resolution"],
  ["--ratio", "ratio"],
  ["--output-dir", "outputDir"],
  ["--env-file", "envFile"],
  ["--max-cost-usd", "maxCostUsd"],
  ["--poll-interval-seconds", "pollIntervalSeconds"],
  ["--poll-timeout-seconds", "pollTimeoutSeconds"],
  ["--idempotency-key", "idempotencyKey"],
  ["--task-id", "taskId"],
  ["--approved-request-hash", "approvedRequestHash"],
]);

export function usage() {
  return `HiAPI Product Spokesperson Video

Usage:
  node scripts/hiapi-product-spokesperson-video.mjs --check --env-file PATH
  node scripts/hiapi-product-spokesperson-video.mjs --scenario synthetic-spokesperson --prompt TEXT [options] --dry-run
  node scripts/hiapi-product-spokesperson-video.mjs --scenario synthetic-spokesperson --prompt TEXT [options] --spend

Scenarios:
  synthetic-spokesperson  Kling text-to-video with native dialogue/audio
  talking-head            Kling image-to-video; requires --image-* and --consent-confirmed
  product-intro           Seedance Fast with one or more --reference-image-*
  brand-promo             Seedance Fast with one or more --reference-image-*

Options:
  --dialogue TEXT                 Exact spoken line for spokesperson scenarios
  --image-file PATH               Authorized local spokesperson image
  --image-url URL                 Authorized spokesperson image URL
  --reference-image-file PATH     Repeat for local product/brand images
  --reference-image-url URL       Repeat for product/brand image URLs
  --duration SECONDS              Kling: 3-15; Seedance: 4-15
  --resolution VALUE              Kling: 720p/1080p/4K; Seedance: 480p/720p
  --ratio VALUE                   Default: 9:16
  --max-cost-usd VALUE            Client-side public-price estimate limit; default: 0.50
  --output-dir PATH               Default: outputs
  --env-file PATH                 Read HIAPI_API_KEY without printing it
  --task-id ID                    Resume polling/downloading an existing task
  --consent-confirmed             Required for a real person's image
  --no-audio                      Disable native audio
  --dry-run                       Validate, price, and print a redacted request
  --preview                       Validate and print a redacted request offline
  --spend                         Explicitly authorize a paid request
  --check                         Zero-cost auth and live pricing checks
  --help                          Show this text`;
}

export function parseArgs(args) {
  const options = {
    referenceImageUrls: [],
    referenceImageFiles: [],
    outputDir: "outputs",
    maxCostUsd: DEFAULT_MAX_COST_USD,
    pollIntervalSeconds: 5,
    pollTimeoutSeconds: 1800,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--preview") options.preview = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--spend") options.spend = true;
    else if (arg === "--check") options.check = true;
    else if (arg === "--consent-confirmed") options.consentConfirmed = true;
    else if (arg === "--no-audio") options.noAudio = true;
    else if (arg === "--reference-image-url" || arg === "--reference-image-file") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value.`);
      const target = arg.endsWith("-url") ? options.referenceImageUrls : options.referenceImageFiles;
      target.push(value);
      index += 1;
    } else if (VALUE_FLAGS.has(arg)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value.`);
      options[VALUE_FLAGS.get(arg)] = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  for (const key of ["duration", "maxCostUsd", "pollIntervalSeconds", "pollTimeoutSeconds"]) {
    if (options[key] !== undefined) options[key] = Number(options[key]);
  }
  validateNumber(options.pollIntervalSeconds, "--poll-interval-seconds", 1, 300);
  validateNumber(options.pollTimeoutSeconds, "--poll-timeout-seconds", 1, 86400);
  return options;
}

export function parseEnvText(text) {
  const parsed = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separator = normalized.indexOf("=");
    if (separator < 1) continue;
    const key = normalized.slice(0, separator).trim();
    let value = normalized.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

export async function resolveConfig(options, env = process.env) {
  let fileEnv = {};
  if (options.envFile) fileEnv = parseEnvText(await readFile(resolve(options.envFile), "utf8"));
  const apiKey = options.envFile ? fileEnv.HIAPI_API_KEY?.trim() : env.HIAPI_API_KEY?.trim();
  return {
    apiKey,
    baseUrl: DEFAULT_BASE_URL,
  };
}

function requireApiKey(config) {
  if (!config.apiKey) {
    throw new Error("HIAPI_API_KEY is missing. Set it in the environment or pass --env-file PATH.");
  }
}

function validateNumber(value, label, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
}

function appendDialogue(prompt, dialogue) {
  if (!dialogue) return prompt;
  return `${prompt}\nThe spokesperson says exactly in Mandarin: "${dialogue}". Keep the speech clear and the lip movement synchronized.`;
}

const MIME_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

export async function imageFileToDataUri(filePath) {
  const absolutePath = resolve(filePath);
  const mimeType = MIME_TYPES.get(extname(absolutePath).toLowerCase());
  if (!mimeType) throw new Error(`Unsupported image type: ${filePath}. Use JPEG, PNG, or WEBP.`);
  const bytes = await readFile(absolutePath);
  if (bytes.length > 20 * 1024 * 1024) throw new Error(`Image is larger than 20 MiB: ${filePath}`);
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

export async function buildRequest(options) {
  const scenario = options.scenario;
  if (!["synthetic-spokesperson", "talking-head", "product-intro", "brand-promo"].includes(scenario)) {
    throw new Error("Choose --scenario synthetic-spokesperson, talking-head, product-intro, or brand-promo.");
  }
  if (!options.prompt?.trim()) throw new Error("--prompt is required.");
  if (!Number.isFinite(options.maxCostUsd) || options.maxCostUsd <= 0) throw new Error("--max-cost-usd must be greater than zero.");

  const ratio = options.ratio || "9:16";
  const sound = !options.noAudio;
  const prompt = appendDialogue(options.prompt.trim(), options.dialogue?.trim());

  if (scenario === "synthetic-spokesperson") {
    const duration = options.duration ?? 3;
    const resolution = options.resolution || "720p";
    validateNumber(duration, "duration", 3, 15);
    if (!["720p", "1080p", "4K"].includes(resolution)) throw new Error("Kling resolution must be 720p, 1080p, or 4K.");
    return {
      scenario,
      payload: {
        model: KLING_T2V,
        storage: "temp",
        input: { prompt, resolution, aspect_ratio: ratio, duration, sound },
      },
    };
  }

  if (scenario === "talking-head") {
    if (!options.consentConfirmed) throw new Error("--consent-confirmed is required for a real person's image.");
    const images = [];
    if (options.imageUrl) images.push(options.imageUrl);
    if (options.imageFile) images.push(await imageFileToDataUri(options.imageFile));
    if (images.length !== 1) throw new Error("Talking-head requires exactly one --image-url or --image-file.");
    const duration = options.duration ?? 3;
    const resolution = options.resolution || "720p";
    validateNumber(duration, "duration", 3, 15);
    if (!["720p", "1080p", "4K"].includes(resolution)) throw new Error("Kling resolution must be 720p, 1080p, or 4K.");
    return {
      scenario,
      payload: {
        model: KLING_I2V,
        storage: "temp",
        input: { image_urls: images, prompt, resolution, duration, sound },
      },
    };
  }

  const references = [...options.referenceImageUrls];
  for (const filePath of options.referenceImageFiles) references.push(await imageFileToDataUri(filePath));
  if (references.length < 1 || references.length > 9) {
    throw new Error("Product and brand scenarios require 1-9 reference images.");
  }
  const duration = options.duration ?? 4;
  const resolution = options.resolution || "480p";
  validateNumber(duration, "duration", 4, 15);
  if (!["480p", "720p"].includes(resolution)) throw new Error("Seedance Fast resolution must be 480p or 720p.");
  return {
    scenario,
    payload: {
      model: SEEDANCE_FAST,
      storage: "temp",
      input: {
        prompt,
        reference_image_urls: references,
        aspect_ratio: ratio,
        resolution,
        duration,
        generate_audio: sound,
        web_search: false,
      },
    },
  };
}

function responseRows(pricingResponse) {
  if (Array.isArray(pricingResponse)) return pricingResponse;
  if (Array.isArray(pricingResponse?.data)) return pricingResponse.data;
  return [];
}

function hasValue(value) {
  return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== "" && value !== false;
}

function policyMatches(policy, input) {
  return Object.entries(policy?.rule || {}).every(([field, condition]) => {
    if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
      throw new Error(`Unsupported live pricing condition for ${field}; refusing to estimate.`);
    }
    const operators = Object.keys(condition);
    if (operators.length === 0 || operators.some((operator) => operator !== "match" && operator !== "with")) {
      throw new Error(`Unsupported live pricing condition for ${field}; refusing to estimate.`);
    }
    const value = input[field];
    if (Object.hasOwn(condition, "match")) {
      const expected = condition.match;
      if (Array.isArray(expected) ? !expected.includes(value) : value !== expected) return false;
    }
    if (Object.hasOwn(condition, "with") && hasValue(value) !== Boolean(condition.with)) return false;
    return true;
  });
}

export function estimateCostUsd(pricingResponse, payload) {
  const row = responseRows(pricingResponse).find((item) => item.model_name === payload.model);
  if (!row) throw new Error(`Live pricing does not contain ${payload.model}.`);
  const policies = [...(row.policies || [])].filter((policy) => policyMatches(policy, payload.input));
  let unitPrice;
  if (policies.length > 0) {
    const specificity = Math.max(...policies.map((policy) => Object.keys(policy.rule || {}).length));
    const prices = policies
      .filter((policy) => Object.keys(policy.rule || {}).length === specificity)
      .map((policy) => Number(policy.usd_value ?? policy.pricing_value));
    if (prices.some((price) => !Number.isFinite(price))) {
      throw new Error(`Live pricing for ${payload.model} has an invalid matching policy price.`);
    }
    unitPrice = Math.max(...prices);
  } else {
    unitPrice = Number(row.base_usd_value ?? row.model_price);
  }
  if (!Number.isFinite(unitPrice)) throw new Error(`Live pricing for ${payload.model} has no usable USD value.`);
  const perSecond = (row.factors || []).some((factor) => factor === "duration" || factor === "duration_seconds");
  const cost = perSecond ? unitPrice * Number(payload.input.duration) : unitPrice;
  return Number(cost.toFixed(6));
}

export function enforceBudget(estimatedCostUsd, maxCostUsd) {
  if (!Number.isFinite(estimatedCostUsd)) throw new Error("Estimated cost is unavailable; refusing a paid request.");
  if (estimatedCostUsd > maxCostUsd) {
    throw new Error(`Estimated cost $${estimatedCostUsd.toFixed(4)} exceeds the $${maxCostUsd.toFixed(2)} limit.`);
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text };
  }
  return { response, body };
}

export async function runChecks(config) {
  requireApiKey(config);
  const pricing = await fetchJson(`${config.baseUrl}/api/pricing`);
  if (!pricing.response.ok) throw new Error(`Live pricing check failed: HTTP ${pricing.response.status}.`);
  const auth = await fetchJson(`${config.baseUrl}/v1/tasks?page=1&size=1`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });
  if (!auth.response.ok) throw new Error(`Authentication check failed: HTTP ${auth.response.status}.`);
  const available = new Set(responseRows(pricing.body).map((row) => row.model_name));
  return {
    authentication: "ok",
    livePricing: "ok",
    models: {
      [KLING_T2V]: available.has(KLING_T2V),
      [KLING_I2V]: available.has(KLING_I2V),
      [SEEDANCE_FAST]: available.has(SEEDANCE_FAST),
    },
  };
}

async function submitTask(config, payload, idempotencyKey) {
  const retryable = new Set([409, 429, 503]);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { response, body } = await fetchJson(`${config.baseUrl}/v1/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const taskId = body?.data?.taskId || body?.taskId;
      if (!taskId) throw new Error("Task creation succeeded without a taskId.");
      return taskId;
    }
    if (!retryable.has(response.status) || attempt === 3) {
      const code = body?.error_code || body?.error?.code || "REQUEST_FAILED";
      const message = body?.message || body?.error?.message || `HTTP ${response.status}`;
      throw new Error(`${code}: ${message}`);
    }
    const retryAfter = Number(response.headers.get("retry-after")) || attempt * 2;
    await new Promise((done) => setTimeout(done, retryAfter * 1000));
  }
  throw new Error("Task submission failed after retries.");
}

async function pollTask(config, taskId, intervalSeconds, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const { response, body } = await fetchJson(`${config.baseUrl}/v1/tasks/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (response.status === 503) {
      await new Promise((done) => setTimeout(done, intervalSeconds * 1000));
      continue;
    }
    if (!response.ok) throw new Error(`Task polling failed: HTTP ${response.status}.`);
    const task = body?.data || body;
    if (task?.status === "success") return task;
    if (task?.status === "fail") {
      throw new Error(`${task.error?.code || "TASK_FAILED"}: ${task.error?.message || "Generation failed."}`);
    }
    await new Promise((done) => setTimeout(done, intervalSeconds * 1000));
  }
  return { taskId, status: "timeout" };
}

export function redactPayload(payload) {
  const copy = structuredClone(payload);
  for (const field of ["image_urls", "reference_image_urls"]) {
    if (Array.isArray(copy.input?.[field])) {
      copy.input[field] = copy.input[field].map(() => "[image omitted]");
    }
  }
  return copy;
}

export function requestHash(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function srtFor(dialogue, duration) {
  if (!dialogue) return "";
  const seconds = String(Math.floor(duration)).padStart(2, "0");
  return `1\n00:00:00,000 --> 00:00:${seconds},000\n${dialogue}\n`;
}

export function isMp4Buffer(bytes) {
  return bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp";
}

async function downloadTaskVideo(task, directory) {
  const video = task.output?.find((item) => item.type === "video") || task.output?.find((item) => item.url);
  if (!video?.url) throw new Error("Task succeeded without a video output URL.");
  const response = await fetch(video.url);
  if (!response.ok) throw new Error(`Video download failed: HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType && !contentType.startsWith("video/") && contentType !== "application/octet-stream") {
    throw new Error(`Video download returned unexpected content type: ${contentType}.`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!isMp4Buffer(bytes)) throw new Error("Video download is empty or is not a valid MP4 container.");
  const videoPath = resolve(directory, "final.mp4");
  await writeFile(videoPath, bytes);
  return { video, videoPath };
}

async function savePackage(options, built, task, estimatedCostUsd) {
  const directory = resolve(options.outputDir, `${Date.now()}-${built.scenario}`);
  await mkdir(directory, { recursive: true });
  const { video, videoPath } = await downloadTaskVideo(task, directory);
  const manifest = {
    scenario: built.scenario,
    model: built.payload.model,
    taskId: task.taskId,
    status: task.status,
    estimatedCostUsd,
    costEstimateScope: "public_pricing_before_account_group_ratio",
    requestHash: requestHash(built.payload),
    storage: "temp",
    outputExpiresAt: video?.expireAt || null,
    createdAt: new Date().toISOString(),
  };
  const qc = {
    status: "pending_human_review",
    checks: ["speech_intelligibility", "lip_sync", "identity_or_product_consistency", "single_shot", "claim_accuracy"],
  };
  await Promise.all([
    writeFile(resolve(directory, "script.md"), options.dialogue ? `${options.dialogue}\n` : `${options.prompt}\n`, "utf8"),
    writeFile(resolve(directory, "captions.srt"), srtFor(options.dialogue, built.payload.input.duration), "utf8"),
    writeFile(resolve(directory, "prompt.json"), `${JSON.stringify(redactPayload(built.payload), null, 2)}\n`, "utf8"),
    writeFile(resolve(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    writeFile(resolve(directory, "qc.json"), `${JSON.stringify(qc, null, 2)}\n`, "utf8"),
  ]);
  return { directory, videoPath, manifest };
}

function inferRecoveredScenario(model) {
  if (model === KLING_T2V) return "synthetic-spokesperson";
  if (model === KLING_I2V) return "talking-head";
  if (model === SEEDANCE_FAST) return "product-or-brand-promo";
  return "recovered-task";
}

async function saveRecoveredPackage(options, task) {
  const scenario = inferRecoveredScenario(task.model);
  const directory = resolve(options.outputDir, `${Date.now()}-${scenario}-recovered`);
  await mkdir(directory, { recursive: true });
  const { video, videoPath } = await downloadTaskVideo(task, directory);
  const manifest = {
    scenario,
    model: task.model,
    taskId: task.taskId,
    status: task.status,
    estimatedCostUsd: null,
    requestHash: null,
    recovered: true,
    storage: task.storage || "temp",
    outputExpiresAt: video.expireAt || null,
    createdAt: new Date().toISOString(),
  };
  const qc = {
    status: "pending_human_review",
    checks: ["speech_intelligibility", "lip_sync", "identity_or_product_consistency", "single_shot", "claim_accuracy"],
  };
  await Promise.all([
    writeFile(resolve(directory, "script.md"), "Recovered existing task. Original script is unavailable from task details.\n", "utf8"),
    writeFile(resolve(directory, "captions.srt"), "", "utf8"),
    writeFile(resolve(directory, "prompt.json"), `${JSON.stringify({ recovered: true, model: task.model }, null, 2)}\n`, "utf8"),
    writeFile(resolve(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    writeFile(resolve(directory, "qc.json"), `${JSON.stringify(qc, null, 2)}\n`, "utf8"),
  ]);
  return { directory, videoPath };
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    console.log(usage());
    return;
  }
  const config = await resolveConfig(options);
  if (options.check) {
    console.log(JSON.stringify(await runChecks(config), null, 2));
    return;
  }
  if (options.taskId) {
    requireApiKey(config);
    const task = await pollTask(config, options.taskId, options.pollIntervalSeconds, options.pollTimeoutSeconds);
    if (task.status === "timeout") {
      console.log(JSON.stringify({ taskId: options.taskId, status: "timeout", message: "Task may still be running; retry with the same --task-id." }, null, 2));
      return;
    }
    const saved = await saveRecoveredPackage(options, task);
    console.log(JSON.stringify({
      taskId: options.taskId,
      status: task.status,
      model: task.model,
      outputDirectory: saved.directory,
      videoPath: saved.videoPath,
      resumed: true,
    }, null, 2));
    return;
  }

  const built = await buildRequest(options);
  const hash = requestHash(built.payload);
  if (options.preview) {
    console.log(JSON.stringify({
      status: "preview",
      adapter: "product-spokesperson",
      request_hash: hash,
      requestHash: hash,
      scenario: built.scenario,
      networkAccess: false,
      payload: redactPayload(built.payload),
    }, null, 2));
    return;
  }
  if (options.spend && !options.approvedRequestHash) {
    throw new Error("--spend requires --approved-request-hash from the matching --dry-run output.");
  }
  if (options.spend && options.approvedRequestHash !== hash) {
    throw new Error("--approved-request-hash does not match the current request. Run --dry-run again.");
  }
  const pricing = await fetchJson(`${config.baseUrl}/api/pricing`);
  if (!pricing.response.ok) throw new Error(`Live pricing check failed: HTTP ${pricing.response.status}.`);
  const estimatedCostUsd = estimateCostUsd(pricing.body, built.payload);

  if (options.dryRun) {
    enforceBudget(estimatedCostUsd, options.maxCostUsd);
    console.log(JSON.stringify({
      scenario: built.scenario,
      adapter: "product-spokesperson",
      request_hash: hash,
      requestHash: hash,
      estimatedCostUsd,
      maxCostUsd: options.maxCostUsd,
      costEstimateScope: "public_pricing_before_account_group_ratio",
      warning: "The server may apply an account group ratio; this is an estimate limit, not a server-enforced final-charge cap.",
      payload: redactPayload(built.payload),
    }, null, 2));
    return;
  }
  if (!options.spend) throw new Error("Paid generation requires explicit --spend. Use --dry-run first.");
  enforceBudget(estimatedCostUsd, options.maxCostUsd);
  requireApiKey(config);

  const idempotencyKey = options.idempotencyKey || `spokesperson-${hash.slice(0, 12)}`;
  console.log(JSON.stringify({
    event: "submission-ready",
    idempotencyKey,
    estimatedCostUsd,
    maxCostUsd: options.maxCostUsd,
    costEstimateScope: "public_pricing_before_account_group_ratio",
    warning: "The server may apply an account group ratio; this is an estimate limit, not a server-enforced final-charge cap.",
  }));
  const taskId = await submitTask(config, built.payload, idempotencyKey);
  console.log(JSON.stringify({ event: "task-created", taskId, estimatedCostUsd }));
  const task = await pollTask(config, taskId, options.pollIntervalSeconds, options.pollTimeoutSeconds);
  if (task.status === "timeout") {
    console.log(JSON.stringify({ taskId, status: "timeout", estimatedCostUsd, message: "Task may still be running; resume polling by taskId." }, null, 2));
    return;
  }
  const saved = await savePackage(options, built, task, estimatedCostUsd);
  console.log(JSON.stringify({
    taskId,
    status: task.status,
    model: built.payload.model,
    estimatedCostUsd,
    outputDirectory: saved.directory,
    videoPath: saved.videoPath,
  }, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
