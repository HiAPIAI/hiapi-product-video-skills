import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildRequest,
  enforceBudget,
  estimateCostUsd,
  isMp4Buffer,
  parseArgs,
  parseEnvText,
  redactPayload,
  resolveConfig,
} from "../scripts/hiapi-product-spokesperson-video.mjs";

test("parseArgs keeps repeated reference images and the spend gate", () => {
  const options = parseArgs([
    "--scenario", "product-intro",
    "--prompt", "A clean product shot",
    "--reference-image-url", "https://example.com/front.jpg",
    "--reference-image-url", "https://example.com/side.jpg",
    "--spend",
  ]);
  assert.equal(options.spend, true);
  assert.deepEqual(options.referenceImageUrls, [
    "https://example.com/front.jpg",
    "https://example.com/side.jpg",
  ]);
});

test("parseArgs accepts an existing task for zero-spend recovery", () => {
  const options = parseArgs(["--task-id", "tk-hiapi-example"]);
  assert.equal(options.taskId, "tk-hiapi-example");
  assert.equal(options.spend, undefined);
});

test("parseArgs rejects caller-controlled API hosts", () => {
  assert.throws(() => parseArgs(["--base-url", "https://evil.example"]), /Unknown option/);
});

test("parseArgs rejects unsafe polling values", () => {
  assert.throws(() => parseArgs(["--poll-interval-seconds", "0"]), /between 1 and 300/);
  assert.throws(() => parseArgs(["--poll-timeout-seconds", "Infinity"]), /between 1 and 86400/);
});

test("synthetic spokesperson builds the low-cost Kling payload", async () => {
  const built = await buildRequest(parseArgs([
    "--scenario", "synthetic-spokesperson",
    "--prompt", "A fictional spokesperson in a clean studio",
    "--dialogue", "新品上线，欢迎了解。",
  ]));
  assert.equal(built.payload.model, "kling-3.0-omni/text-to-video");
  assert.equal(built.payload.input.duration, 3);
  assert.equal(built.payload.input.resolution, "720p");
  assert.equal(built.payload.input.sound, true);
  assert.match(built.payload.input.prompt, /新品上线/);
});

test("talking head refuses an image without consent", async () => {
  await assert.rejects(
    buildRequest(parseArgs([
      "--scenario", "talking-head",
      "--prompt", "Speak to camera",
      "--image-url", "https://example.com/person.jpg",
    ])),
    /consent-confirmed/,
  );
});

test("pricing chooses the more specific sound-on policy", () => {
  const pricing = { data: [{
    model_name: "kling-3.0-omni/text-to-video",
    factors: ["duration"],
    policies: [
      { rule: { resolution: { match: "720p" } }, usd_value: 0.1 },
      { rule: { resolution: { match: "720p" }, sound: { match: true } }, usd_value: 0.143 },
    ],
  }] };
  const cost = estimateCostUsd(pricing, {
    model: "kling-3.0-omni/text-to-video",
    input: { resolution: "720p", sound: true, duration: 3 },
  });
  assert.equal(cost, 0.429);
});

test("pricing supports array-valued match policies", () => {
  const pricing = { data: [{
    model_name: "seedance-2.0-fast",
    factors: ["duration"],
    base_usd_value: 0.1,
    policies: [
      { rule: { resolution: { match: ["480p", "720p"] } }, usd_value: 0.2 },
    ],
  }] };
  const cost = estimateCostUsd(pricing, {
    model: "seedance-2.0-fast",
    input: { resolution: "720p", duration: 3 },
  });
  assert.equal(cost, 0.6);
});

test("pricing refuses unsupported policy operators", () => {
  const pricing = { data: [{
    model_name: "kling-3.0-omni/text-to-video",
    factors: ["duration"],
    base_usd_value: 0.2,
    policies: [{ rule: { duration: { min: 10 } }, usd_value: 0.01 }],
  }] };
  assert.throws(() => estimateCostUsd(pricing, {
    model: "kling-3.0-omni/text-to-video",
    input: { duration: 3 },
  }), /Unsupported live pricing condition/);
});

test("pricing uses the highest price among equally specific policies", () => {
  const pricing = { data: [{
    model_name: "kling-3.0-omni/text-to-video",
    factors: ["duration"],
    policies: [
      { rule: { resolution: { match: "720p" } }, usd_value: 0.1 },
      { rule: { resolution: { match: "720p" } }, usd_value: 0.2 },
    ],
  }] };
  const cost = estimateCostUsd(pricing, {
    model: "kling-3.0-omni/text-to-video",
    input: { resolution: "720p", duration: 3 },
  });
  assert.equal(cost, 0.6);
});

test("redacted payload omits local and remote image values", () => {
  const redacted = redactPayload({
    input: {
      image_urls: ["https://cdn.example/person.png?token=private", "data:image/png;base64,secret"],
      reference_image_urls: ["https://cdn.example/product.png#private"],
    },
  });
  assert.deepEqual(redacted.input.image_urls, ["[image omitted]", "[image omitted]"]);
  assert.deepEqual(redacted.input.reference_image_urls, ["[image omitted]"]);
  assert.doesNotMatch(JSON.stringify(redacted), /private|base64|secret/);
});

test("budget enforcement fails closed", () => {
  assert.throws(() => enforceBudget(0.51, 0.5), /exceeds/);
  assert.doesNotThrow(() => enforceBudget(0.429, 0.5));
});

test("env parser reads a quoted key without exposing it", () => {
  const parsed = parseEnvText('HIAPI_API_KEY="secret-value"\n');
  assert.equal(parsed.HIAPI_API_KEY, "secret-value");
});

test("an explicit env file cannot be shadowed by a process key", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hiapi-spokesperson-"));
  const envFile = join(directory, ".env.local");
  try {
    await writeFile(envFile, "HIAPI_API_KEY=file-key\n", "utf8");
    const config = await resolveConfig({ envFile }, { HIAPI_API_KEY: "wrong-process-key" });
    assert.equal(config.apiKey, "file-key");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("MP4 validation checks the ISO base media signature", () => {
  assert.equal(isMp4Buffer(Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0])), true);
  assert.equal(isMp4Buffer(Buffer.from("not a video")), false);
});
