#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const BASE_URL = "https://api.hiapi.ai";
export const DEFAULT_MAX_COST_USD = 1;
export const MODELS = Object.freeze({
  text: "kling-3.0-omni/text-to-video",
  hero: "kling-3.0-omni/image-to-video",
  references: "seedance-2.0-fast",
});

export const RECIPES = Object.freeze({
  "runway-walk": {
    duration: 6,
    shot: "a full-body runway composition with the entire outfit and footwear visible",
    action: "one controlled runway walk ending in one settled pose",
    setting: "a restrained fashion-show runway without readable sponsor signage",
    lighting: "clean directional runway light that preserves garment color and texture",
    camera: "one smooth backward tracking move at the subject's walking pace",
    sound: "natural footsteps and restrained room ambience",
  },
  "outfit-transition": {
    duration: 5,
    shot: "a full-body centered fashion transformation composition",
    action: "one simple body turn that reveals exactly one target outfit",
    transition: "one clean transformation at the midpoint with no flash montage",
    setting: "a minimal editorial studio that keeps the clothing readable",
    lighting: "stable soft fashion light with no exposure jump during the change",
    camera: "one locked or nearly locked camera",
    sound: "a subtle fabric movement accent without speech",
  },
  "lookbook-pose": {
    duration: 5,
    shot: "a full-body or three-quarter editorial lookbook composition",
    action: "one slow half-turn that settles into one natural pose",
    setting: "a quiet editorial studio or simple architectural backdrop",
    lighting: "soft directional lookbook light with truthful fabric texture",
    camera: "one restrained push-in",
    sound: "subtle room tone and natural fabric movement",
  },
  "person-showcase": {
    duration: 5,
    shot: "a medium-full fashion portrait that keeps face, hair, silhouette, and outfit readable",
    action: "one calm weight shift with a small head turn and a settled finish",
    setting: "a clean lifestyle or editorial environment with no competing people",
    lighting: "natural flattering light that preserves skin tone and garment color",
    camera: "one gentle lateral slide",
    sound: "restrained environmental ambience without speech",
  },
});

const VALUE_FLAGS = new Map([
  ["--recipe", "recipe"],
  ["--prompt", "prompt"],
  ["--action", "action"],
  ["--setting", "setting"],
  ["--lighting", "lighting"],
  ["--garment-details", "garmentDetails"],
  ["--camera", "camera"],
  ["--transition", "transition"],
  ["--sound", "sound"],
  ["--duration", "duration"],
  ["--resolution", "resolution"],
  ["--ratio", "ratio"],
  ["--output-dir", "outputDir"],
  ["--env-file", "envFile"],
  ["--max-cost-usd", "maxCostUsd"],
  ["--poll-interval-seconds", "pollIntervalSeconds"],
  ["--poll-timeout-seconds", "pollTimeoutSeconds"],
  ["--idempotency-key", "idempotencyKey"],
  ["--approved-request-hash", "approvedRequestHash"],
  ["--task-id", "taskId"],
]);

const REPEAT_FLAGS = new Map([
  ["--person-image-url", "personImageUrls"],
  ["--person-image-file", "personImageFiles"],
  ["--garment-image-url", "garmentImageUrls"],
  ["--garment-image-file", "garmentImageFiles"],
  ["--style-image-url", "styleImageUrls"],
  ["--style-image-file", "styleImageFiles"],
]);

const IMAGE_MIME_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const KLING_RATIOS = new Set(["16:9", "9:16", "1:1"]);
const SEEDANCE_RATIOS = new Set(["1:1", "4:3", "3:4", "16:9", "9:16", "21:9", "adaptive"]);
const SUCCESS_STATUSES = new Set(["success", "succeeded", "completed"]);
const FAILURE_STATUSES = new Set(["fail", "failed", "error", "cancelled", "canceled"]);
const RETRYABLE_STATUSES = new Set([409, 429, 503]);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export function usage() {
  return `HiAPI Fashion Lookbook Video

Usage:
  node scripts/hiapi-fashion-lookbook-video.mjs --recipe RECIPE --prompt TEXT [options] --preview
  node scripts/hiapi-fashion-lookbook-video.mjs --recipe RECIPE --prompt TEXT [options] --dry-run
  node scripts/hiapi-fashion-lookbook-video.mjs --recipe RECIPE --prompt TEXT [options] --spend --approved-request-hash HASH
  node scripts/hiapi-fashion-lookbook-video.mjs --task-id ID --env-file PATH
  node scripts/hiapi-fashion-lookbook-video.mjs --check --env-file PATH

Recipes:
  runway-walk | outfit-transition | lookbook-pose | person-showcase

Media routes:
  No image                                      Kling text-to-video
  One person image only                         Kling image-to-video
  Any garment/style image, up to 9 total refs   Seedance 2.0 Fast

Options:
  --duration SECONDS              Kling: integer 3-15; Seedance: 4-15
  --resolution VALUE              Kling: 720p/1080p/4K; Seedance: 480p/720p
  --ratio VALUE                   Kling: 16:9/9:16/1:1. Seedance also supports
                                  4:3/3:4/21:9/adaptive. Default: 9:16
  --person-image-file/url PATH    One authorized person or complete-look image
  --garment-image-file/url PATH   Repeatable garment view; maximum 6
  --style-image-file/url PATH     Repeatable setting/lighting reference; maximum 2
  --person-consent-confirmed      Confirm authorization for the depicted person
  --asset-rights-confirmed        Confirm rights to every supplied image
  --action TEXT                   Override the recipe's single primary action
  --setting TEXT                  Override the setting
  --lighting TEXT                 Override the lighting
  --garment-details TEXT          Describe silhouette, material, color, pattern, and construction
  --camera TEXT                   Override the single camera movement
  --transition TEXT               Override the one outfit transition
  --sound TEXT                    Override the sound direction
  --audio                         Enable generated audio; disabled by default
  --no-audio                      Explicitly keep generated audio disabled
  --max-cost-usd VALUE            Public-price estimate limit. Default: 1.00
  --output-dir PATH               Default: outputs
  --env-file PATH                 Read HIAPI_API_KEY without printing it
  --idempotency-key VALUE         Reuse the exact key printed for this request hash
  --approved-request-hash HASH    Required for --spend; copy from --dry-run
  --task-id ID                    Resume an existing task without resubmitting
  --preview                       Fully offline validation and redacted payload
  --dry-run                       Live public pricing only; creates no task
  --spend                         Explicitly authorize one paid task
  --check                         Live pricing and authentication checks; creates no task
  --help                          Show this text`;
}

export function parseArgs(args) {
  const options = {
    personImageUrls: [],
    personImageFiles: [],
    garmentImageUrls: [],
    garmentImageFiles: [],
    styleImageUrls: [],
    styleImageFiles: [],
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
    else if (arg === "--audio") options.audio = true;
    else if (arg === "--no-audio") options.noAudio = true;
    else if (arg === "--person-consent-confirmed") options.personConsentConfirmed = true;
    else if (arg === "--asset-rights-confirmed") options.assetRightsConfirmed = true;
    else if (REPEAT_FLAGS.has(arg)) {
      const value = requireOptionValue(args, index, arg);
      options[REPEAT_FLAGS.get(arg)].push(value);
      index += 1;
    } else if (VALUE_FLAGS.has(arg)) {
      options[VALUE_FLAGS.get(arg)] = requireOptionValue(args, index, arg);
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

function requireOptionValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

export function validateExecutionMode(options) {
  if (options.help) return "help";
  const active = [
    options.preview && "preview",
    options.dryRun && "dry-run",
    options.spend && "spend",
    options.check && "check",
  ].filter(Boolean);

  if (options.taskId) {
    if (active.length > 0) throw new Error("--task-id cannot be combined with --preview, --dry-run, --spend, or --check.");
    if (hasRequestInput(options)) throw new Error("--task-id is resume-only; do not include a recipe, prompt, media, or generation settings.");
    return "resume";
  }
  if (active.length !== 1) throw new Error("Choose exactly one of --preview, --dry-run, --spend, or --check.");
  if (active[0] === "check" && hasRequestInput(options)) {
    throw new Error("--check cannot be combined with a generation request.");
  }
  return active[0];
}

function hasRequestInput(options) {
  return Boolean(
    options.recipe || options.prompt || options.action || options.setting || options.lighting || options.garmentDetails ||
    options.camera || options.transition || options.sound || options.duration !== undefined || options.resolution || options.ratio ||
    options.audio || options.noAudio || options.personConsentConfirmed || options.assetRightsConfirmed ||
    options.approvedRequestHash || options.idempotencyKey || options.personImageUrls.length || options.personImageFiles.length ||
    options.garmentImageUrls.length || options.garmentImageFiles.length || options.styleImageUrls.length || options.styleImageFiles.length
  );
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
  return { apiKey, baseUrl: BASE_URL };
}

function requireApiKey(config) {
  if (!config.apiKey) throw new Error("HIAPI_API_KEY is missing. Set it in the environment or pass --env-file PATH.");
}

function validateNumber(value, label, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
}

function normalizeDuration(value, minimum, route) {
  if (!Number.isInteger(value) || value < minimum || value > 15) {
    throw new Error(`${route} duration must be an integer from ${minimum} to 15.`);
  }
  return value;
}

function normalizeRatio(value, supported, route) {
  const ratio = value || "9:16";
  if (!supported.has(ratio)) throw new Error(`Unsupported ${route} ratio: ${ratio}.`);
  return ratio;
}

function normalizeKlingResolution(value = "720p") {
  const normalized = String(value).toLowerCase() === "4k" ? "4K" : String(value).toLowerCase();
  if (!["720p", "1080p", "4K"].includes(normalized)) throw new Error("Kling resolution must be 720p, 1080p, or 4K.");
  return normalized;
}

function normalizeSeedanceResolution(value = "480p") {
  const normalized = String(value).toLowerCase();
  if (!["480p", "720p"].includes(normalized)) throw new Error("Seedance Fast resolution must be 480p or 720p.");
  return normalized;
}

function validateMediaUrl(value) {
  if (!/^(?:https:\/\/|asset:\/\/)/i.test(value)) {
    throw new Error("Unsupported image URL. Use HTTPS, asset://, or a local JPEG, PNG, or WEBP file.");
  }
  return value;
}

export function detectImageMime(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

export async function imageFileToDataUri(filePath) {
  const absolutePath = resolve(filePath);
  const mimeType = IMAGE_MIME_TYPES.get(extname(absolutePath).toLowerCase());
  if (!mimeType) throw new Error(`Unsupported image type: ${filePath}. Use JPEG, PNG, or WEBP.`);
  const bytes = await readFile(absolutePath);
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`Image is larger than 20 MiB: ${filePath}`);
  const detectedMimeType = detectImageMime(bytes);
  if (detectedMimeType !== mimeType) throw new Error(`Image content does not match its file extension: ${filePath}`);
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

async function resolveImages(urls = [], files = []) {
  const resolvedUrls = urls.map(validateMediaUrl);
  const localImages = await Promise.all(files.map(imageFileToDataUri));
  return [...resolvedUrls, ...localImages];
}

function roleSentence(slot, role) {
  if (role === "person") {
    return `${slot} defines only the authorized person's identity, face, hair, skin tone, and body proportions.`;
  }
  if (role === "garment") {
    return `${slot} defines only the target garment's silhouette, construction, material, color, pattern, closures, and existing branding.`;
  }
  return `${slot} defines only setting, lighting, palette, and editorial mood; do not transfer people, garments, text, or logos from it.`;
}

function mediaRoleMap(personImages, garmentImages, styleImages) {
  const roles = [];
  let index = 1;
  for (const _image of personImages) roles.push({ slot: `@Image${index++}`, role: "person" });
  for (const _image of garmentImages) roles.push({ slot: `@Image${index++}`, role: "garment" });
  for (const _image of styleImages) roles.push({ slot: `@Image${index++}`, role: "style" });
  return roles;
}

export function buildFashionPrompt(options, recipe, duration, audioEnabled, mediaRoles = []) {
  const userPrompt = options.prompt?.trim();
  if (!userPrompt) throw new Error("--prompt is required.");
  const direction = RECIPES[recipe];
  if (!direction) throw new Error(`Unknown recipe: ${recipe}.`);

  const sound = audioEnabled ? (options.sound?.trim() || direction.sound) : "no generated audio and no implied dialogue";
  const roleDirections = mediaRoles.length > 0
    ? mediaRoles.map(({ slot, role }) => roleSentence(slot, role)).join(" ") + " Do not cross-transfer reference roles."
    : "No reference image is supplied; create a fictional adult and original unbranded wardrobe from the written brief.";
  const transition = recipe === "outfit-transition"
    ? `Outfit transition: ${options.transition?.trim() || direction.transition}. Show exactly one change from the initial look to one target look.`
    : "Keep one continuous wardrobe throughout the shot; do not introduce an outfit change.";
  const identityConstraint = mediaRoles.some(({ role }) => role === "person")
    ? "Preserve the authorized person's face, hair, skin tone, body proportions, and age presentation; do not reshape the body or copy another person's identity."
    : "Keep one consistent fictional adult identity, face, hair, skin tone, body proportions, and age presentation throughout the shot.";
  return [
    `Create a ${duration}-second single-shot fashion video.`,
    `Shot type: ${direction.shot}.`,
    `Creative brief: ${userPrompt}.`,
    `Reference roles: ${roleDirections}`,
    `Garment truth: ${options.garmentDetails?.trim() || "preserve every visible supplied garment detail without inventing fit, size, or construction claims"}.`,
    `Primary action: ${options.action?.trim() || direction.action}.`,
    transition,
    `Setting: ${options.setting?.trim() || direction.setting}.`,
    `Lighting: ${options.lighting?.trim() || direction.lighting}.`,
    `Camera movement: ${options.camera?.trim() || direction.camera}.`,
    `Sound: ${sound}.`,
    "Keep exactly one primary action, one camera movement, one continuous shot, and no cuts or montage.",
    identityConstraint,
    "Preserve garment silhouette, neckline, sleeves, waist, hem, layering, material, color, pattern, closures, seams, and existing logo placement across every frame.",
    "Keep fabric drape, folds, occlusion, contact points, hands, feet, gait, joints, reflections, and gravity physically coherent.",
    "Do not merge garments, duplicate people, add accessories, invent readable text, rewrite logos, or degrade the outfit in later frames.",
    "Treat the result as creative visualization, not evidence of exact fit, size, tailoring, fabric performance, or how a product will look on a buyer.",
    "Add no captions, CTA, overlay text, watermark, or new logo. Keep the featured person and outfit unobstructed.",
  ].join("\n");
}

export async function buildRequest(options) {
  const recipe = options.recipe;
  if (!RECIPES[recipe]) throw new Error(`Choose --recipe ${Object.keys(RECIPES).join(", ")}.`);
  if (!Number.isFinite(options.maxCostUsd) || options.maxCostUsd <= 0) throw new Error("--max-cost-usd must be greater than zero.");

  if (options.audio && options.noAudio) throw new Error("Choose only one of --audio or --no-audio.");
  const audioEnabled = Boolean(options.audio);
  const personImages = await resolveImages(options.personImageUrls, options.personImageFiles);
  const garmentImages = await resolveImages(options.garmentImageUrls, options.garmentImageFiles);
  const styleImages = await resolveImages(options.styleImageUrls, options.styleImageFiles);
  if (personImages.length > 1) throw new Error("Use at most one person image.");
  if (garmentImages.length > 6) throw new Error("Use at most 6 garment images for one target look.");
  if (styleImages.length > 2) throw new Error("Use at most 2 style images.");
  const referenceImages = [...personImages, ...garmentImages, ...styleImages];
  if (referenceImages.length > 9) throw new Error("Use at most 9 total reference images.");
  if (referenceImages.length > 0 && !options.assetRightsConfirmed) {
    throw new Error("Supplied media requires --asset-rights-confirmed.");
  }
  if (personImages.length > 0 && !options.personConsentConfirmed) {
    throw new Error("A person image requires --person-consent-confirmed.");
  }
  const hasReferenceRoute = garmentImages.length > 0 || styleImages.length > 0;
  if (recipe === "outfit-transition" && referenceImages.length > 0 && (personImages.length !== 1 || garmentImages.length < 1)) {
    throw new Error("Reference-driven outfit-transition requires one person image and at least one garment image.");
  }
  const route = hasReferenceRoute ? "reference-images" : personImages.length === 1 ? "person-image-to-video" : "text-to-video";
  const duration = normalizeDuration(options.duration ?? RECIPES[recipe].duration, route === "reference-images" ? 4 : 3, route === "reference-images" ? "Seedance Fast" : "Kling");
  const mediaRoles = mediaRoleMap(personImages, garmentImages, styleImages);
  const rightsConfirmation = {
    suppliedMedia: referenceImages.length > 0,
    assetRightsConfirmed: referenceImages.length > 0 ? true : null,
    personImageSupplied: personImages.length > 0,
    personConsentConfirmed: personImages.length > 0 ? true : null,
  };
  const prompt = buildFashionPrompt(options, recipe, duration, audioEnabled, mediaRoles);
  if (route === "person-image-to-video") {
    if (options.ratio) throw new Error("Kling image-to-video follows the source image ratio; omit --ratio.");
    const resolution = normalizeKlingResolution(options.resolution);
    return {
      recipe,
      route,
      prompt,
      userPrompt: options.prompt.trim(),
      mediaCount: 1,
      mediaRoles,
      rightsConfirmation,
      duration,
      resolution,
      ratio: "source-image",
      audioEnabled,
      payload: {
        model: MODELS.hero,
        storage: "temp",
        input: { image_urls: personImages, prompt, resolution, duration, sound: audioEnabled },
      },
    };
  }

  if (route === "reference-images") {
    const resolution = normalizeSeedanceResolution(options.resolution);
    const ratio = normalizeRatio(options.ratio, SEEDANCE_RATIOS, "Seedance Fast");
    return {
      recipe,
      route,
      prompt,
      userPrompt: options.prompt.trim(),
      mediaCount: referenceImages.length,
      mediaRoles,
      rightsConfirmation,
      duration,
      resolution,
      ratio,
      audioEnabled,
      payload: {
        model: MODELS.references,
        storage: "temp",
        input: {
          reference_image_urls: referenceImages,
          prompt,
          aspect_ratio: ratio,
          resolution,
          duration,
          generate_audio: audioEnabled,
          web_search: false,
        },
      },
    };
  }

  const resolution = normalizeKlingResolution(options.resolution);
  const ratio = normalizeRatio(options.ratio, KLING_RATIOS, "Kling text-to-video");
  return {
    recipe,
    route: "text-to-video",
    prompt,
    userPrompt: options.prompt.trim(),
    mediaCount: 0,
    mediaRoles,
    rightsConfirmation,
    duration,
    resolution,
    ratio,
    audioEnabled,
    payload: {
      model: MODELS.text,
      storage: "temp",
      input: { prompt, resolution, aspect_ratio: ratio, duration, sound: audioEnabled },
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

function positiveNumber(value, label) {
  if (value === null || value === undefined || value === "") throw new Error(`${label} is missing.`);
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) throw new Error(`${label} must be greater than zero.`);
  return numeric;
}

function baseUnitPrice(row, model) {
  return positiveNumber(row.base_usd_value ?? row.model_price, `Live pricing base USD value for ${model}`);
}

function policyUnitPrice(policy, row, model) {
  const pricingType = policy.pricing_type || (policy.usd_value !== undefined ? "fixed" : "");
  if (pricingType === "fixed") {
    return positiveNumber(policy.usd_value, `Live fixed policy USD value for ${model}`);
  }
  if (pricingType === "multiply") {
    const multiplier = positiveNumber(policy.times ?? policy.pricing_value, `Live policy multiplier for ${model}`);
    return baseUnitPrice(row, model) * multiplier;
  }
  throw new Error(`Live pricing for ${model} has unsupported policy type: ${pricingType || "missing"}.`);
}

export function estimateCostUsd(pricingResponse, payload) {
  const row = responseRows(pricingResponse).find((item) => item.model_name === payload.model);
  if (!row) throw new Error(`Live pricing does not contain ${payload.model}.`);
  if (!Array.isArray(row.factors) || row.factors.length === 0 || row.factors.some((factor) => typeof factor !== "string" || !factor.trim())) {
    throw new Error(`Live pricing for ${payload.model} has missing or malformed factors.`);
  }
  const factorNames = row.factors.map((factor) => factor.trim().toLowerCase());
  const allowedFactors = new Set(["duration", "seconds", "duration_seconds"]);
  const unsupportedFactors = factorNames.filter((factor) => !allowedFactors.has(factor));
  if (unsupportedFactors.length > 0) {
    throw new Error(`Live pricing for ${payload.model} has unsupported factor(s): ${unsupportedFactors.join(", ")}.`);
  }
  if (factorNames.length !== 1) throw new Error(`Live pricing for ${payload.model} must contain exactly one duration factor.`);
  const policies = row.policies === undefined || row.policies === null ? [] : row.policies;
  if (!Array.isArray(policies)) throw new Error(`Live pricing for ${payload.model} has malformed policies.`);
  const matchingPolicies = policies.filter((policy) => policyMatches(policy, payload.input));
  let unitPrice;
  if (matchingPolicies.length > 0) {
    const specificity = Math.max(...matchingPolicies.map((policy) => Object.keys(policy.rule || {}).length));
    const prices = matchingPolicies
      .filter((policy) => Object.keys(policy.rule || {}).length === specificity)
      .map((policy) => policyUnitPrice(policy, row, payload.model));
    unitPrice = Math.max(...prices);
  } else {
    unitPrice = baseUnitPrice(row, payload.model);
  }
  return Number((unitPrice * payload.input.duration).toFixed(6));
}

export function enforceBudget(estimatedCostUsd, maxCostUsd) {
  if (!Number.isFinite(estimatedCostUsd)) throw new Error("Estimated cost is unavailable; refusing a paid request.");
  if (estimatedCostUsd > maxCostUsd) {
    throw new Error(`Estimated cost $${estimatedCostUsd.toFixed(4)} exceeds the $${maxCostUsd.toFixed(2)} limit.`);
  }
}

export function redactPayload(payload) {
  const copy = structuredClone(payload);
  for (const field of ["image_urls", "reference_image_urls"]) {
    if (Array.isArray(copy.input?.[field])) copy.input[field] = copy.input[field].map(() => "[image omitted]");
  }
  return copy;
}

export function requestHash(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function idempotencyKeyForRequest(providedKey, hash) {
  const prefix = `fashion-${hash.slice(0, 12)}-`;
  if (!providedKey) return `${prefix}${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  if (!providedKey.startsWith(prefix) || !/^[a-z0-9_-]{20,128}$/i.test(providedKey)) {
    throw new Error("--idempotency-key is not bound to this request hash. Reuse the exact key printed for this payload.");
  }
  return providedKey;
}

export async function fetchJson(url, init = {}, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Request timed out: ${url}`);
    throw new Error(`Request failed: ${error?.message || "unknown network error"}`);
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text };
  }
  return { response, body };
}

export async function runChecks(config, deps = {}) {
  requireApiKey(config);
  const pricing = await fetchJson(`${config.baseUrl}/api/pricing`, {}, deps);
  if (!pricing.response.ok) throw new Error(`Live pricing check failed: HTTP ${pricing.response.status}.`);
  const auth = await fetchJson(`${config.baseUrl}/v1/tasks?page=1&size=1`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  }, deps);
  if (!auth.response.ok) throw new Error(`Authentication check failed: HTTP ${auth.response.status}.`);
  const available = new Set(responseRows(pricing.body).map((row) => row.model_name));
  return {
    authentication: "ok",
    livePricing: "ok",
    models: Object.fromEntries(Object.values(MODELS).map((model) => [model, available.has(model)])),
  };
}

export function extractTaskId(body) {
  return body?.data?.taskId || body?.data?.task_id || body?.data?.id || body?.taskId || body?.task_id || body?.id || "";
}

function errorSummary(body, status) {
  return body?.error?.message || body?.message || body?.error || `HTTP ${status}`;
}

function retryDelaySeconds(response, attempt) {
  const retryAfter = Number(response.headers.get("retry-after"));
  return Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) : attempt * 2;
}

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

export async function submitTask(config, payload, idempotencyKey, deps = {}) {
  const sleepImpl = deps.sleepImpl || sleep;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await fetchJson(`${config.baseUrl}/v1/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    }, deps);
    const taskId = extractTaskId(result.body);
    if (result.response.ok) {
      if (!taskId) throw new Error("Task creation succeeded without a task ID.");
      return taskId;
    }
    if (result.response.status === 409 && taskId) {
      const error = new Error(`Idempotency key already belongs to task ${taskId}. Resume it with --task-id; the current brief will not be attached.`);
      error.taskId = taskId;
      throw error;
    }
    if (!RETRYABLE_STATUSES.has(result.response.status) || attempt === 3) {
      throw new Error(`Task submission failed: ${errorSummary(result.body, result.response.status)}`);
    }
    await sleepImpl(retryDelaySeconds(result.response, attempt) * 1000);
  }
  throw new Error("Task submission failed after retries.");
}

function unwrapTask(body, taskId) {
  const task = body?.data || body;
  return { ...task, taskId: task?.taskId || task?.task_id || task?.id || taskId };
}

export function assertTaskMatchesRequest(task, payload) {
  const taskModel = task.model || task.model_name;
  if (taskModel && taskModel !== payload.model) {
    throw new Error("Returned task model does not match the approved request. Resume the task separately with --task-id.");
  }
  if (!task.input || typeof task.input !== "object") return;
  for (const field of ["prompt", "duration", "resolution", "aspect_ratio", "sound", "generate_audio"]) {
    if (Object.hasOwn(task.input, field) && JSON.stringify(task.input[field]) !== JSON.stringify(payload.input[field])) {
      throw new Error(`Returned task input does not match the approved request field: ${field}. Resume the task separately with --task-id.`);
    }
  }
}

export async function pollTask(config, taskId, intervalSeconds, timeoutSeconds, deps = {}) {
  const sleepImpl = deps.sleepImpl || sleep;
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const result = await fetchJson(`${config.baseUrl}/v1/tasks/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    }, deps);
    if (RETRYABLE_STATUSES.has(result.response.status)) {
      await sleepImpl(intervalSeconds * 1000);
      continue;
    }
    if (!result.response.ok) throw new Error(`Task polling failed: HTTP ${result.response.status}.`);
    const task = unwrapTask(result.body, taskId);
    const status = String(task.status || "").toLowerCase();
    if (SUCCESS_STATUSES.has(status)) return task;
    if (FAILURE_STATUSES.has(status)) {
      throw new Error(`${task.error?.code || "TASK_FAILED"}: ${task.error?.message || task.fail_reason || "Generation failed."}`);
    }
    await sleepImpl(intervalSeconds * 1000);
  }
  return { taskId, status: "timeout" };
}

function readMp4Box(bytes, offset, limit) {
  if (offset + 8 > limit) return null;
  let size = bytes.readUInt32BE(offset);
  const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > limit) return null;
    const largeSize = bytes.readBigUInt64BE(offset + 8);
    if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(largeSize);
    headerSize = 16;
  } else if (size === 0) {
    size = limit - offset;
  }
  if (size < headerSize || offset + size > limit) return null;
  return { type, size, headerSize, next: offset + size };
}

function childBoxes(bytes, start, end) {
  const boxes = [];
  let offset = start;
  while (offset < end) {
    const box = readMp4Box(bytes, offset, end);
    if (!box) return null;
    boxes.push({ ...box, offset });
    offset = box.next;
  }
  return offset === end ? boxes : null;
}

export function isMp4Buffer(bytes) {
  if (bytes.length < 48) return false;
  let offset = 0;
  let hasFtyp = false;
  let hasMoovMetadata = false;
  let hasMediaData = false;
  while (offset < bytes.length) {
    const box = readMp4Box(bytes, offset, bytes.length);
    if (!box) return false;
    if (box.type === "ftyp") {
      if (box.size < 16) return false;
      hasFtyp = true;
    } else if (box.type === "moov") {
      const children = childBoxes(bytes, offset + box.headerSize, box.next);
      const mvhd = children?.find((child) => child.type === "mvhd" && child.size > child.headerSize);
      const trak = children?.find((child) => child.type === "trak" && child.size > child.headerSize);
      const trackChildren = trak ? childBoxes(bytes, trak.offset + trak.headerSize, trak.next) : null;
      const tkhd = trackChildren?.find((child) => child.type === "tkhd" && child.size > child.headerSize);
      hasMoovMetadata = Boolean(mvhd && tkhd);
    } else if (box.type === "mdat" && box.size > box.headerSize) {
      hasMediaData = true;
    }
    offset = box.next;
  }
  return hasFtyp && hasMoovMetadata && hasMediaData;
}

function extractVideo(task) {
  const output = Array.isArray(task.output) ? task.output : Array.isArray(task.outputs) ? task.outputs : [];
  return output.find((item) => item?.type === "video") ||
    output.find((item) => /\.mp4(?:\?|#|$)/i.test(String(item?.url || item || ""))) ||
    output.find((item) => item?.url);
}

async function fetchVideoBytes(url, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.downloadTimeoutMs || 60000);
  let response;
  try {
    response = await fetchImpl(url, { signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Video download timed out.");
    throw new Error(`Video download failed: ${error?.message || "unknown network error"}`);
  } finally {
    clearTimeout(timer);
  }
  if (response.status !== 200) throw new Error(`Video download failed: expected HTTP 200, received ${response.status}.`);
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType && !contentType.startsWith("video/") && contentType !== "application/octet-stream") {
    throw new Error(`Video download returned unexpected content type: ${contentType}.`);
  }
  const contentLengthHeader = response.headers.get("content-length");
  const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
  if (contentLength !== null && (!Number.isInteger(contentLength) || contentLength < 0)) {
    throw new Error("Video download returned an invalid Content-Length header.");
  }
  if (contentLength !== null && contentLength > MAX_VIDEO_BYTES) throw new Error("Video download exceeds 200 MiB.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (contentLength !== null && bytes.length !== contentLength) throw new Error("Video download was truncated.");
  if (bytes.length > MAX_VIDEO_BYTES) throw new Error("Video download exceeds 200 MiB.");
  if (!isMp4Buffer(bytes)) throw new Error("Video download is empty or is not a valid MP4 container.");
  return bytes;
}

async function downloadTaskVideo(task, directory, deps = {}) {
  const video = extractVideo(task);
  const url = typeof video === "string" ? video : video?.url;
  if (!url) throw new Error("Task succeeded without a video output URL.");
  const bytes = await fetchVideoBytes(url, deps);
  const videoPath = resolve(directory, "final.mp4");
  await writeFile(videoPath, bytes);
  return { video, videoPath };
}

function timestamp() {
  return new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "");
}

export function uniqueOutputDirectory(baseDirectory, label, taskId) {
  const safeLabel = String(label || "task").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 40) || "task";
  const safeTaskId = String(taskId || "task").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 40) || "task";
  const suffix = randomUUID().replace(/-/g, "").slice(0, 10);
  return resolve(baseDirectory, `${timestamp()}-${safeLabel}-${safeTaskId}-${suffix}`);
}

function qcTemplate() {
  const ids = [
    "person_identity_hair_skin_tone_and_body_proportions",
    "garment_silhouette_neckline_sleeves_waist_hem_and_layering",
    "material_color_pattern_closures_seams_logos_and_readable_text",
    "fabric_drape_occlusion_contacts_reflections_and_gravity",
    "hands_feet_gait_joints_and_anatomy",
    "flicker_morphing_unwanted_accessories_and_late_frame_drift",
    "single_shot_one_transition_full_outfit_framing_and_obstruction",
    "rights_fit_claims_audio_sync_and_unintended_speech",
  ];
  return {
    status: "pending_human_review",
    result: "generated_unreviewed",
    checks: ids.map((id) => ({ id, status: "not_reviewed" })),
  };
}

function briefMarkdown(built) {
  const audio = typeof built.audioEnabled === "boolean" ? (built.audioEnabled ? "enabled" : "disabled") : "unknown";
  const roles = Array.isArray(built.mediaRoles) && built.mediaRoles.length > 0
    ? built.mediaRoles.map(({ slot, role }) => `- ${slot}: ${role}`).join("\n")
    : "- None";
  return `# Fashion Lookbook Video Brief

- Recipe: ${built.recipe}
- Route: ${built.route}
- Model: ${built.payload.model}
- Duration: ${built.duration} seconds
- Resolution: ${built.resolution}
- Ratio: ${built.ratio}
- Audio: ${audio}
- Media inputs: ${built.mediaCount}
- Media rights confirmed: ${built.rightsConfirmation?.assetRightsConfirmed ?? "not applicable or unavailable"}
- Person consent confirmed: ${built.rightsConfirmation?.personConsentConfirmed ?? "not applicable or unavailable"}

## Media Roles

${roles}

## Creative Brief

${built.userPrompt}

## Final Prompt

${built.prompt}

## Review Status

generated_unreviewed - human identity, garment, rights, fit-claim, continuity, framing, and audio QC is required before publication.
`;
}

async function writePackageFiles(directory, built, manifest) {
  await Promise.all([
    writeFile(resolve(directory, "brief.md"), briefMarkdown(built), "utf8"),
    writeFile(resolve(directory, "prompt.json"), `${JSON.stringify(redactPayload(built.payload), null, 2)}\n`, "utf8"),
    writeFile(resolve(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    writeFile(resolve(directory, "qc.json"), `${JSON.stringify(qcTemplate(), null, 2)}\n`, "utf8"),
  ]);
}

async function savePackage(options, built, task, estimatedCostUsd, deps = {}) {
  const directory = uniqueOutputDirectory(options.outputDir, built.recipe, task.taskId);
  await mkdir(directory, { recursive: true });
  const { video, videoPath } = await downloadTaskVideo(task, directory, deps);
  const manifest = {
    skill: "hiapi-fashion-lookbook-video",
    recipe: built.recipe,
    route: built.route,
    model: built.payload.model,
    taskId: task.taskId,
    taskStatus: task.status,
    status: "generated_unreviewed",
    estimatedCostUsd,
    costEstimateScope: "public_pricing_before_account_group_ratio",
    requestHash: requestHash(built.payload),
    rightsConfirmation: built.rightsConfirmation,
    storage: "temp",
    outputExpiresAt: video?.expireAt || video?.expiresAt || null,
    createdAt: new Date().toISOString(),
  };
  await writePackageFiles(directory, built, manifest);
  return { directory, videoPath, manifest };
}

function inferRecoveredRoute(model) {
  if (model === MODELS.text) return "text-to-video";
  if (model === MODELS.hero) return "person-image-to-video";
  if (model === MODELS.references) return "reference-images";
  return "recovered-task";
}

async function saveRecoveredPackage(options, task, deps = {}) {
  const model = task.model || task.model_name;
  const route = inferRecoveredRoute(model);
  const directory = uniqueOutputDirectory(options.outputDir, `${route}-recovered`, task.taskId);
  await mkdir(directory, { recursive: true });
  const { video, videoPath } = await downloadTaskVideo(task, directory, deps);
  const built = {
    recipe: "recovered-task",
    route,
    payload: { model, recovered: true },
    duration: task.input?.duration || "unknown",
    resolution: task.input?.resolution || "unknown",
    ratio: task.input?.aspect_ratio || "source-or-unknown",
    audioEnabled: task.input?.sound ?? task.input?.generate_audio ?? "unknown",
    mediaCount: "unknown",
    mediaRoles: [],
    rightsConfirmation: null,
    userPrompt: "Recovered existing task. The original local brief is unavailable.",
    prompt: "Recovered existing task. Inspect the task and generated video before use.",
  };
  const manifest = {
    skill: "hiapi-fashion-lookbook-video",
    recipe: built.recipe,
    route,
    model,
    taskId: task.taskId,
    taskStatus: task.status,
    status: "generated_unreviewed",
    estimatedCostUsd: null,
    requestHash: null,
    rightsConfirmation: null,
    recovered: true,
    storage: task.storage || "temp",
    outputExpiresAt: video?.expireAt || video?.expiresAt || null,
    createdAt: new Date().toISOString(),
  };
  await writePackageFiles(directory, built, manifest);
  return { directory, videoPath, manifest };
}

async function getPricing(config, deps) {
  const pricing = await fetchJson(`${config.baseUrl}/api/pricing`, {}, deps);
  if (!pricing.response.ok) throw new Error(`Live pricing check failed: HTTP ${pricing.response.status}.`);
  return pricing.body;
}

export async function main(args = process.argv.slice(2), deps = {}) {
  const print = deps.print || console.log;
  const options = parseArgs(args);
  const mode = validateExecutionMode(options);
  if (mode === "help") {
    print(usage());
    return;
  }

  if (mode === "preview") {
    const built = await buildRequest(options);
    print(JSON.stringify({
      mode,
      recipe: built.recipe,
      route: built.route,
      model: built.payload.model,
      requestHash: requestHash(built.payload),
      rightsConfirmation: built.rightsConfirmation,
      estimatedCostUsd: null,
      networkAccess: false,
      payload: redactPayload(built.payload),
    }, null, 2));
    return;
  }

  if (mode === "check") {
    const config = await resolveConfig(options);
    print(JSON.stringify(await runChecks(config, deps), null, 2));
    return;
  }

  if (mode === "resume") {
    const config = await resolveConfig(options);
    requireApiKey(config);
    const task = await pollTask(config, options.taskId, options.pollIntervalSeconds, options.pollTimeoutSeconds, deps);
    if (task.status === "timeout") {
      print(JSON.stringify({ taskId: options.taskId, status: "timeout", message: "Task may still be running; retry with the same --task-id." }, null, 2));
      return;
    }
    const saved = await saveRecoveredPackage(options, task, deps);
    print(JSON.stringify({
      taskId: options.taskId,
      status: "generated_unreviewed",
      taskStatus: task.status,
      model: saved.manifest.model,
      outputDirectory: saved.directory,
      videoPath: saved.videoPath,
      resumed: true,
    }, null, 2));
    return;
  }

  const built = await buildRequest(options);
  const hash = requestHash(built.payload);
  let idempotencyKey;
  if (mode === "spend" && !options.approvedRequestHash) {
    throw new Error("--spend requires --approved-request-hash from the matching --dry-run output.");
  }
  if (mode === "spend" && options.approvedRequestHash !== hash) {
    throw new Error("--approved-request-hash does not match the current request. Run --dry-run again.");
  }
  if (mode === "spend") idempotencyKey = idempotencyKeyForRequest(options.idempotencyKey, hash);
  const publicConfig = { baseUrl: BASE_URL };
  const pricing = await getPricing(publicConfig, deps);
  const estimatedCostUsd = estimateCostUsd(pricing, built.payload);
  enforceBudget(estimatedCostUsd, options.maxCostUsd);

  const estimate = {
    recipe: built.recipe,
    route: built.route,
    model: built.payload.model,
    requestHash: hash,
    rightsConfirmation: built.rightsConfirmation,
    estimatedCostUsd,
    maxCostUsd: options.maxCostUsd,
    costEstimateScope: "public_pricing_before_account_group_ratio",
    warning: "The server may apply an account group ratio; this is an estimate limit, not a server-enforced final-charge cap.",
    payload: redactPayload(built.payload),
  };
  if (mode === "dry-run") {
    print(JSON.stringify(estimate, null, 2));
    return;
  }

  const config = await resolveConfig(options);
  requireApiKey(config);
  print(JSON.stringify({ event: "submission-ready", idempotencyKey, ...estimate, payload: undefined }));
  const taskId = await submitTask(config, built.payload, idempotencyKey, deps);
  print(JSON.stringify({ event: "task-created", taskId, estimatedCostUsd }));
  const task = await pollTask(config, taskId, options.pollIntervalSeconds, options.pollTimeoutSeconds, deps);
  if (task.status === "timeout") {
    print(JSON.stringify({ taskId, status: "timeout", estimatedCostUsd, message: "Task may still be running; resume with --task-id." }, null, 2));
    return;
  }
  assertTaskMatchesRequest(task, built.payload);
  const saved = await savePackage(options, built, task, estimatedCostUsd, deps);
  print(JSON.stringify({
    taskId,
    taskStatus: task.status,
    status: "generated_unreviewed",
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
