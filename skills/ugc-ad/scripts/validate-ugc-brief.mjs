#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const ALLOWED_PLATFORMS = new Set(["tiktok", "instagram-reels"]);
const ALLOWED_FORMATS = new Set([
  "unboxing-reveal",
  "first-use-demo",
  "direct-to-camera-demo",
  "problem-solution",
  "try-on",
  "creator-comparison",
]);
const ALLOWED_TALENT_SOURCES = new Set(["user-provided", "hired-creator", "synthetic-generic"]);
const ALLOWED_MODES = new Set(["first-frame", "multimodal-reference", "text-only"]);
const ALLOWED_RESOLUTIONS = new Set(["480p", "720p", "1080p", "4k"]);
const REGULATED_CATEGORIES = new Set([
  "alcohol",
  "finance",
  "financial",
  "gambling",
  "health",
  "health-supplement",
  "medical",
  "supplement",
  "weight-loss",
]);

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function includesText(haystack, needle) {
  return normalized(haystack).includes(normalized(needle));
}

function countCjkSpeechCharacters(text) {
  return Array.from(String(text ?? "").replace(/[\s，。！？、；：,.!?;:'"“”‘’（）()—-]/g, "")).length;
}

function countWords(text) {
  return String(text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function isCjkLanguage(language, script) {
  return /^(zh|ja|ko)(?:-|$)/i.test(String(language ?? "")) || /[\u3400-\u9fff]/u.test(String(script ?? ""));
}

function validateTimedReferences(kind, urls, paths, durations, errors) {
  const count = list(urls).length + list(paths).length;
  if (count === 0) return;

  if (list(durations).length !== count) {
    errors.push(`production.${kind}_durations must contain one duration for each ${kind} URL or path.`);
    return;
  }

  let total = 0;
  for (const value of durations) {
    const duration = Number(value);
    if (!Number.isFinite(duration) || duration < 2 || duration > 15) {
      errors.push(`Each ${kind.replaceAll("_", " ")} duration must be between 2 and 15 seconds.`);
      continue;
    }
    total += duration;
  }

  if (total > 15) {
    errors.push(`Total ${kind.replaceAll("_", " ")} duration must not exceed 15 seconds.`);
  }
}

export function validateBrief(brief) {
  const errors = [];
  const warnings = [];
  const product = brief?.product ?? {};
  const creative = brief?.creative ?? {};
  const talent = brief?.talent ?? {};
  const production = brief?.production ?? {};
  const compliance = brief?.compliance_review ?? {};

  if (!nonEmptyString(brief?.campaign_id)) errors.push("campaign_id is required.");
  if (!nonEmptyString(brief?.variant_id)) errors.push("variant_id is required.");
  if (!nonEmptyString(product.name)) errors.push("product.name is required.");
  if (!nonEmptyString(product.category)) errors.push("product.category is required.");

  const facts = list(product.facts);
  if (facts.length === 0) {
    warnings.push("product.facts is empty; avoid factual benefit or result claims.");
  }
  facts.forEach((fact, index) => {
    if (!nonEmptyString(fact?.claim)) errors.push(`product.facts[${index}].claim is required.`);
    if (!nonEmptyString(fact?.source)) errors.push(`product.facts[${index}].source is required.`);
  });

  const platforms = list(creative.platforms).map(normalized);
  if (platforms.length === 0) errors.push("creative.platforms must contain tiktok and/or instagram-reels.");
  platforms.forEach((platform) => {
    if (!ALLOWED_PLATFORMS.has(platform)) errors.push(`Unsupported platform "${platform}".`);
  });

  const format = normalized(creative.format);
  if (!ALLOWED_FORMATS.has(format)) errors.push(`Unsupported creative.format "${creative.format ?? ""}".`);
  if (!nonEmptyString(creative.language)) errors.push("creative.language is required.");

  const duration = Number(creative.duration_seconds);
  if (!Number.isInteger(duration) || duration < 4 || duration > 15) {
    errors.push("creative.duration_seconds must be an integer from 4 to 15.");
  }

  if (creative.aspect_ratio !== "9:16") {
    errors.push("creative.aspect_ratio must be 9:16 for this TikTok/Reels skill.");
  }

  const resolution = normalized(creative.resolution);
  if (!ALLOWED_RESOLUTIONS.has(resolution)) {
    errors.push(`Unsupported creative.resolution "${creative.resolution ?? ""}".`);
  }
  if (resolution === "4k" && creative.cost_confirmation !== true) {
    errors.push("4k requires creative.cost_confirmation=true after explicit user approval.");
  }

  if (!nonEmptyString(creative.hook)) errors.push("creative.hook is required.");
  if (!nonEmptyString(creative.script)) errors.push("creative.script is required.");
  if (!nonEmptyString(creative.cta)) errors.push("creative.cta is required.");
  if (!nonEmptyString(creative.seedance_prompt)) errors.push("creative.seedance_prompt is required.");

  if (
    nonEmptyString(creative.script) &&
    nonEmptyString(creative.seedance_prompt) &&
    !creative.seedance_prompt.includes(creative.script)
  ) {
    errors.push("creative.seedance_prompt must contain creative.script verbatim.");
  }
  if (nonEmptyString(creative.cta) && nonEmptyString(creative.script) && !includesText(creative.script, creative.cta)) {
    warnings.push("creative.cta is not present verbatim in creative.script; verify how the CTA will be delivered.");
  }

  if (Number.isFinite(duration) && duration > 0 && nonEmptyString(creative.script)) {
    if (isCjkLanguage(creative.language, creative.script)) {
      const characters = countCjkSpeechCharacters(creative.script);
      if (characters > duration * 6) errors.push(`The script has ${characters} spoken CJK characters for ${duration}s; shorten it.`);
      else if (characters > duration * 5) warnings.push(`The script has ${characters} spoken CJK characters for ${duration}s and may sound rushed.`);
    } else {
      const words = countWords(creative.script);
      if (words > duration * 3.4) errors.push(`The script has ${words} words for ${duration}s; shorten it.`);
      else if (words > duration * 2.8) warnings.push(`The script has ${words} words for ${duration}s and may sound rushed.`);
    }
  }

  if (nonEmptyString(creative.hook_overlay)) {
    if (isCjkLanguage(creative.language, creative.hook_overlay)) {
      if (countCjkSpeechCharacters(creative.hook_overlay) > 12) warnings.push("creative.hook_overlay is longer than 12 CJK characters.");
    } else if (countWords(creative.hook_overlay) > 6) {
      warnings.push("creative.hook_overlay is longer than 6 words.");
    }
  }

  const talentSource = normalized(talent.source);
  if (!ALLOWED_TALENT_SOURCES.has(talentSource)) {
    errors.push(`Unsupported talent.source "${talent.source ?? ""}".`);
  }
  if (["user-provided", "hired-creator"].includes(talentSource) && talent.consent_confirmed !== true) {
    errors.push("Real or hired talent requires talent.consent_confirmed=true.");
  }
  if (talentSource === "synthetic-generic" && !nonEmptyString(creative.disclosure)) {
    warnings.push("Synthetic talent should have a disclosure note before publishing.");
  }
  if (!nonEmptyString(talent.description)) warnings.push("talent.description is empty; identity and wardrobe continuity may drift.");

  const category = normalized(product.category);
  if (REGULATED_CATEGORIES.has(category)) {
    if (compliance.required !== true || normalized(compliance.status) !== "approved") {
      errors.push(`Regulated category "${category}" requires compliance_review.required=true and status="approved".`);
    }
  }

  const mode = normalized(production.mode);
  if (!ALLOWED_MODES.has(mode)) errors.push(`Unsupported production.mode "${production.mode ?? ""}".`);
  if (Object.hasOwn(production, "seed") && production.seed != null) {
    errors.push("production.seed is not supported by the current HiAPI Seedance 2.0 task schema; remove it.");
  }

  if (mode === "first-frame" && !nonEmptyString(production.first_frame_url) && !nonEmptyString(production.first_frame_path)) {
    errors.push("first-frame mode requires production.first_frame_url or production.first_frame_path.");
  }

  const referenceImageCount = list(production.reference_image_urls).length + list(production.reference_image_paths).length;
  if (mode === "multimodal-reference" && referenceImageCount === 0) {
    errors.push("multimodal-reference mode requires at least one reference image URL or path.");
  }
  if (mode === "multimodal-reference" && referenceImageCount === 1) {
    warnings.push("Only one reference image is configured; verify that it contains both the approved talent and exact product.");
  }
  if (referenceImageCount > 9) errors.push("Seedance accepts at most 9 reference images.");
  if (mode === "text-only") warnings.push("Text-only mode has lower product and talent fidelity.");

  const referenceVideoCount = list(production.reference_video_urls).length + list(production.reference_video_paths).length;
  const referenceAudioCount = list(production.reference_audio_urls).length + list(production.reference_audio_paths).length;
  if (referenceVideoCount > 3) errors.push("Seedance accepts at most 3 reference videos.");
  if (referenceAudioCount > 3) errors.push("Seedance accepts at most 3 reference audio clips.");
  validateTimedReferences(
    "reference_video",
    production.reference_video_urls,
    production.reference_video_paths,
    production.reference_video_durations,
    errors,
  );
  validateTimedReferences(
    "reference_audio",
    production.reference_audio_urls,
    production.reference_audio_paths,
    production.reference_audio_durations,
    errors,
  );

  if (production.generate_audio !== true && ["direct-to-camera-demo", "unboxing-reveal", "first-use-demo", "try-on"].includes(format)) {
    warnings.push("This speaking-led format normally requires production.generate_audio=true.");
  }

  const storage = normalized(production.storage || "temp");
  if (!["temp", "persistent"].includes(storage)) errors.push(`Unsupported production.storage "${production.storage ?? ""}".`);
  if (storage === "persistent" && production.persistent_storage_confirmed !== true) {
    errors.push("Persistent storage costs money and requires production.persistent_storage_confirmed=true after explicit user approval.");
  }

  return {
    ok: errors.length === 0,
    error_count: errors.length,
    warning_count: warnings.length,
    errors,
    warnings,
  };
}

async function runCli() {
  const file = process.argv[2];
  if (!file || file === "--help" || file === "-h") {
    console.log("Usage: node scripts/validate-ugc-brief.mjs /absolute/path/to/ugc-brief.json");
    return;
  }

  const brief = JSON.parse(await readFile(file, "utf8"));
  const result = validateBrief(brief);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
  });
}
