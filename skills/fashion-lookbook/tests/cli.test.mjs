import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BASE_URL,
  MODELS,
  assertTaskMatchesRequest,
  buildRequest,
  detectImageMime,
  enforceBudget,
  estimateCostUsd,
  idempotencyKeyForRequest,
  imageFileToDataUri,
  isMp4Buffer,
  main,
  parseArgs,
  parseEnvText,
  pollTask,
  redactPayload,
  requestHash,
  resolveConfig,
  submitTask,
  uniqueOutputDirectory,
  validateExecutionMode,
} from "../scripts/hiapi-fashion-lookbook-video.mjs";

function pricingFor(model, unitPrice = 0.1) {
  return {
    data: [{
      model_name: model,
      factors: ["duration"],
      policies: [{ rule: {}, usd_value: unitPrice }],
    }],
  };
}

function mp4Box(type, payload = Buffer.alloc(0)) {
  const box = Buffer.alloc(8 + payload.length);
  box.writeUInt32BE(box.length, 0);
  box.write(type, 4, 4, "ascii");
  payload.copy(box, 8);
  return box;
}

function validMp4() {
  const moov = mp4Box("moov", Buffer.concat([
    mp4Box("mvhd", Buffer.from([0, 0, 0, 0])),
    mp4Box("trak", mp4Box("tkhd", Buffer.from([0, 0, 0, 0]))),
  ]));
  return Buffer.concat([
    mp4Box("ftyp", Buffer.from("isom\0\0\0\0", "binary")),
    moov,
    mp4Box("mdat", Buffer.from([1, 2, 3, 4])),
  ]);
}

test("parseArgs keeps role-specific media, rights, and strict spend flags", () => {
  const options = parseArgs([
    "--recipe", "outfit-transition",
    "--prompt", "One target outfit",
    "--person-image-url", "https://example.com/person.jpg",
    "--garment-image-url", "https://example.com/front.jpg",
    "--garment-image-url", "https://example.com/back.jpg",
    "--person-consent-confirmed",
    "--asset-rights-confirmed",
    "--spend",
    "--approved-request-hash", "abc123",
  ]);
  assert.equal(options.spend, true);
  assert.equal(options.approvedRequestHash, "abc123");
  assert.equal(options.personConsentConfirmed, true);
  assert.equal(options.assetRightsConfirmed, true);
  assert.deepEqual(options.garmentImageUrls, [
    "https://example.com/front.jpg",
    "https://example.com/back.jpg",
  ]);
});

test("parseArgs rejects missing values, caller-controlled hosts, and unsafe polling", () => {
  assert.throws(() => parseArgs(["--prompt", "--preview"]), /requires a value/);
  assert.throws(() => parseArgs(["--base-url", "https://evil.example"]), /Unknown option/);
  assert.throws(() => parseArgs(["--poll-interval-seconds", "0"]), /between 1 and 300/);
  assert.throws(() => parseArgs(["--poll-timeout-seconds", "Infinity"]), /between 1 and 86400/);
});

test("execution modes are exclusive and task recovery is resume-only", () => {
  assert.equal(validateExecutionMode(parseArgs(["--preview"])), "preview");
  assert.throws(() => validateExecutionMode(parseArgs(["--preview", "--dry-run"])), /exactly one/);
  assert.equal(validateExecutionMode(parseArgs(["--task-id", "tk-1"])), "resume");
  assert.throws(
    () => validateExecutionMode(parseArgs(["--task-id", "tk-1", "--duration", "0"])),
    /resume-only/,
  );
});

test("text-only runway builds the Kling payload with audio disabled by default", async () => {
  const built = await buildRequest(parseArgs([
    "--recipe", "runway-walk",
    "--prompt", "A fictional adult presents an original monochrome tailored look",
    "--preview",
  ]));
  assert.equal(built.route, "text-to-video");
  assert.equal(built.payload.model, MODELS.text);
  assert.equal(built.payload.input.duration, 6);
  assert.equal(built.payload.input.resolution, "720p");
  assert.equal(built.payload.input.aspect_ratio, "9:16");
  assert.equal(built.payload.input.sound, false);
  assert.match(built.prompt, /controlled runway walk/i);
  assert.match(built.prompt, /one primary action, one camera movement/i);
  assert.match(built.prompt, /creative visualization, not evidence of exact fit/i);
});

test("Kling and Seedance enforce their own duration ranges", async () => {
  const kling = await buildRequest(parseArgs([
    "--recipe", "person-showcase",
    "--prompt", "A fictional editorial portrait",
    "--duration", "3",
    "--preview",
  ]));
  assert.equal(kling.payload.input.duration, 3);
  await assert.rejects(buildRequest(parseArgs([
    "--recipe", "lookbook-pose",
    "--prompt", "The supplied garment",
    "--garment-image-url", "https://example.com/dress.jpg",
    "--asset-rights-confirmed",
    "--duration", "3",
    "--preview",
  ])), /Seedance Fast duration.*4 to 15/);
  await assert.rejects(buildRequest(parseArgs([
    "--recipe", "runway-walk", "--prompt", "A look", "--duration", "16", "--preview",
  ])), /Kling duration.*3 to 15/);
});

test("one authorized person image selects Kling image-to-video", async () => {
  const built = await buildRequest(parseArgs([
    "--recipe", "person-showcase",
    "--prompt", "The authorized adult presents the supplied complete look",
    "--person-image-url", "https://example.com/person.jpg",
    "--person-consent-confirmed",
    "--asset-rights-confirmed",
    "--preview",
  ]));
  assert.equal(built.route, "person-image-to-video");
  assert.equal(built.payload.model, MODELS.hero);
  assert.equal("aspect_ratio" in built.payload.input, false);
  assert.deepEqual(built.mediaRoles, [{ slot: "@Image1", role: "person" }]);
  assert.deepEqual(built.rightsConfirmation, {
    suppliedMedia: true,
    assetRightsConfirmed: true,
    personImageSupplied: true,
    personConsentConfirmed: true,
  });
});

test("multireference payload orders person, garment, then style roles", async () => {
  const built = await buildRequest(parseArgs([
    "--recipe", "lookbook-pose",
    "--prompt", "Present one supplied tailored look",
    "--person-image-url", "https://example.com/person.jpg",
    "--garment-image-url", "https://example.com/front.jpg",
    "--garment-image-url", "https://example.com/back.jpg",
    "--style-image-url", "https://example.com/studio.jpg",
    "--person-consent-confirmed",
    "--asset-rights-confirmed",
    "--ratio", "adaptive",
    "--preview",
  ]));
  assert.equal(built.route, "reference-images");
  assert.equal(built.payload.model, MODELS.references);
  assert.deepEqual(built.payload.input.reference_image_urls, [
    "https://example.com/person.jpg",
    "https://example.com/front.jpg",
    "https://example.com/back.jpg",
    "https://example.com/studio.jpg",
  ]);
  assert.deepEqual(built.mediaRoles, [
    { slot: "@Image1", role: "person" },
    { slot: "@Image2", role: "garment" },
    { slot: "@Image3", role: "garment" },
    { slot: "@Image4", role: "style" },
  ]);
  assert.equal(built.payload.input.aspect_ratio, "adaptive");
  assert.match(built.prompt, /Do not cross-transfer reference roles/);
});

test("media requests fail closed without rights and person consent", async () => {
  await assert.rejects(
    buildRequest(parseArgs([
      "--recipe", "lookbook-pose",
      "--prompt", "A supplied garment",
      "--garment-image-url", "https://example.com/garment.jpg",
      "--preview",
    ])),
    /asset-rights-confirmed/,
  );
  await assert.rejects(
    buildRequest(parseArgs([
      "--recipe", "person-showcase",
      "--prompt", "An adult",
      "--person-image-url", "https://example.com/person.jpg",
      "--asset-rights-confirmed",
      "--preview",
    ])),
    /person-consent-confirmed/,
  );
});

test("outfit transition requires one person and a garment when referenced", async () => {
  await assert.rejects(
    buildRequest(parseArgs([
      "--recipe", "outfit-transition",
      "--prompt", "One target change",
      "--person-image-url", "https://example.com/person.jpg",
      "--person-consent-confirmed",
      "--asset-rights-confirmed",
      "--preview",
    ])),
    /requires one person image and at least one garment image/,
  );
  await assert.rejects(buildRequest(parseArgs([
    "--recipe", "outfit-transition", "--prompt", "One target change",
    "--garment-image-url", "https://example.com/dress.jpg",
    "--asset-rights-confirmed", "--preview",
  ])), /requires one person image and at least one garment image/);
});

test("media limits and Kling source framing are enforced", async () => {
  await assert.rejects(buildRequest(parseArgs([
    "--recipe", "person-showcase", "--prompt", "A person",
    "--person-image-url", "https://example.com/one.jpg",
    "--person-image-url", "https://example.com/two.jpg",
    "--person-consent-confirmed", "--asset-rights-confirmed", "--preview",
  ])), /at most one person image/);
  await assert.rejects(buildRequest(parseArgs([
    "--recipe", "person-showcase", "--prompt", "A person",
    "--person-image-url", "https://example.com/person.jpg",
    "--person-consent-confirmed", "--asset-rights-confirmed", "--ratio", "1:1", "--preview",
  ])), /source image ratio/);
  await assert.rejects(buildRequest(parseArgs([
    "--recipe", "runway-walk", "--prompt", "A look", "--ratio", "4:3", "--preview",
  ])), /Unsupported Kling text-to-video ratio/);
});

test("generated audio is opt-in and conflicting audio flags are rejected", async () => {
  const built = await buildRequest(parseArgs([
    "--recipe", "person-showcase",
    "--prompt", "A fictional fashion portrait",
    "--audio",
    "--preview",
  ]));
  assert.equal(built.audioEnabled, true);
  assert.equal(built.payload.input.sound, true);
  await assert.rejects(buildRequest(parseArgs([
    "--recipe", "person-showcase", "--prompt", "A portrait", "--audio", "--no-audio", "--preview",
  ])), /Choose only one/);
});

test("garment and style reference counts are capped independently", async () => {
  const garmentArgs = Array.from({ length: 7 }, (_, index) => [
    "--garment-image-url", `https://example.com/garment-${index}.jpg`,
  ]).flat();
  await assert.rejects(buildRequest(parseArgs([
    "--recipe", "lookbook-pose", "--prompt", "One look", ...garmentArgs,
    "--asset-rights-confirmed", "--preview",
  ])), /at most 6 garment images/);

  await assert.rejects(buildRequest(parseArgs([
    "--recipe", "lookbook-pose", "--prompt", "One look",
    "--style-image-url", "https://example.com/style-1.jpg",
    "--style-image-url", "https://example.com/style-2.jpg",
    "--style-image-url", "https://example.com/style-3.jpg",
    "--asset-rights-confirmed", "--preview",
  ])), /at most 2 style images/);
});

test("text-only outfit transition stays fictional and requests exactly one change", async () => {
  const built = await buildRequest(parseArgs([
    "--recipe", "outfit-transition",
    "--prompt", "A fictional adult changes from casual black to an original silver evening look",
    "--preview",
  ]));
  assert.equal(built.route, "text-to-video");
  assert.match(built.prompt, /fictional adult and original unbranded wardrobe/i);
  assert.match(built.prompt, /exactly one change from the initial look to one target look/i);
});

test("garment-only generation uses Seedance without claiming a person identity", async () => {
  const built = await buildRequest(parseArgs([
    "--recipe", "runway-walk",
    "--prompt", "A fictional adult presents the supplied original jacket",
    "--garment-image-url", "https://example.com/jacket.jpg",
    "--asset-rights-confirmed",
    "--preview",
  ]));
  assert.equal(built.route, "reference-images");
  assert.deepEqual(built.mediaRoles, [{ slot: "@Image1", role: "garment" }]);
  assert.match(built.prompt, /@Image1 defines only the target garment/);
});

test("local images require matching JPEG, PNG, or WEBP signatures", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hiapi-fashion-image-"));
  const validJpeg = join(directory, "valid.jpg");
  const fakeJpeg = join(directory, "secret.jpg");
  try {
    await writeFile(validJpeg, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    await writeFile(fakeJpeg, "not an image", "utf8");
    assert.equal(detectImageMime(Buffer.from([0xff, 0xd8, 0xff])), "image/jpeg");
    assert.match(await imageFileToDataUri(validJpeg), /^data:image\/jpeg;base64,/);
    await assert.rejects(imageFileToDataUri(fakeJpeg), /does not match its file extension/);
    await assert.rejects(
      buildRequest(parseArgs([
        "--recipe", "lookbook-pose",
        "--prompt", "A look",
        "--garment-image-url", "data:image/jpeg;base64,c2VjcmV0",
        "--asset-rights-confirmed",
        "--preview",
      ])),
      /Unsupported image URL/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("prompt overrides preserve real UTF-8 fashion briefs", async () => {
  const built = await buildRequest(parseArgs([
    "--recipe", "lookbook-pose",
    "--prompt", "展示一套黑色西装造型，保持人物和服装细节稳定",
    "--action", "one slow half-turn into a relaxed pose",
    "--camera", "one restrained vertical rise",
    "--garment-details", "preserve the peaked lapels and single silver button",
    "--no-audio",
    "--preview",
  ]));
  assert.match(built.prompt, /黑色西装造型/);
  assert.match(built.prompt, /one slow half-turn/);
  assert.match(built.prompt, /one restrained vertical rise/);
  assert.match(built.prompt, /peaked lapels/);
  assert.match(built.prompt, /no generated audio/);
});

test("redaction removes remote and embedded image values", () => {
  const redacted = redactPayload({
    input: {
      image_urls: ["https://cdn.example/hero.png?token=private"],
      reference_image_urls: ["data:image/png;base64,secret"],
    },
  });
  assert.deepEqual(redacted.input.image_urls, ["[image omitted]"]);
  assert.deepEqual(redacted.input.reference_image_urls, ["[image omitted]"]);
  assert.doesNotMatch(JSON.stringify(redacted), /private|base64|secret/);
});

test("request hashes bind the exact normalized payload", () => {
  const first = requestHash({ model: "x", input: { prompt: "a" } });
  assert.equal(first, requestHash({ model: "x", input: { prompt: "a" } }));
  assert.notEqual(first, requestHash({ model: "x", input: { prompt: "b" } }));
});

test("idempotency keys are bound to the approved request hash", () => {
  const hash = "a".repeat(64);
  const key = idempotencyKeyForRequest(undefined, hash);
  assert.match(key, /^fashion-aaaaaaaaaaaa-[a-z0-9]+$/);
  assert.equal(idempotencyKeyForRequest(key, hash), key);
  assert.throws(() => idempotencyKeyForRequest(key, "b".repeat(64)), /not bound/);
});

test("task identity checks refuse an old model or changed input", () => {
  const payload = { model: MODELS.text, input: { prompt: "approved", duration: 4, resolution: "720p" } };
  assert.throws(() => assertTaskMatchesRequest({ model: MODELS.references }, payload), /model does not match/);
  assert.throws(() => assertTaskMatchesRequest({
    model: MODELS.text,
    input: { prompt: "old request", duration: 4, resolution: "720p" },
  }, payload), /field: prompt/);
  assert.doesNotThrow(() => assertTaskMatchesRequest({ model: MODELS.text }, payload));
});

test("output package paths remain unique within the same millisecond", () => {
  const first = uniqueOutputDirectory("outputs", "lookbook-pose", "tk-1");
  const second = uniqueOutputDirectory("outputs", "lookbook-pose", "tk-1");
  assert.notEqual(first, second);
  assert.match(first, /lookbook-pose-tk-1-[a-z0-9]+$/i);
});

test("pricing chooses the most specific conservative match", () => {
  const pricing = { data: [{
    model_name: MODELS.text,
    factors: ["duration"],
    policies: [
      { rule: { resolution: { match: "720p" } }, usd_value: 0.1 },
      { rule: { resolution: { match: "720p" }, sound: { match: true } }, usd_value: 0.143 },
    ],
  }] };
  assert.equal(estimateCostUsd(pricing, {
    model: MODELS.text,
    input: { resolution: "720p", sound: true, duration: 4 },
  }), 0.572);
});

test("pricing supports array matches and fails closed on unknown rules or factors", () => {
  const arrayPricing = { data: [{
    model_name: MODELS.references,
    factors: ["duration_seconds"],
    policies: [{ rule: { resolution: { match: ["480p", "720p"] } }, usd_value: 0.2 }],
  }] };
  assert.equal(estimateCostUsd(arrayPricing, {
    model: MODELS.references,
    input: { resolution: "480p", duration: 4 },
  }), 0.8);

  assert.throws(() => estimateCostUsd({ data: [{
    model_name: MODELS.text,
    factors: ["duration"],
    policies: [{ rule: { duration: { min: 4 } }, usd_value: 0.1 }],
  }] }, { model: MODELS.text, input: { duration: 4 } }), /Unsupported live pricing condition/);

  assert.throws(() => estimateCostUsd({ data: [{
    model_name: MODELS.text,
    factors: ["frames"],
    base_usd_value: 0.1,
  }] }, { model: MODELS.text, input: { duration: 4 } }), /unsupported factor/);

  assert.throws(() => estimateCostUsd({ data: [{
    model_name: MODELS.text,
    base_usd_value: 0.1,
  }] }, { model: MODELS.text, input: { duration: 4 } }), /missing or malformed factors/);

  assert.throws(() => estimateCostUsd({ data: [{
    model_name: MODELS.text,
    factors: [{ name: "duration" }],
    base_usd_value: 0.1,
  }] }, { model: MODELS.text, input: { duration: 4 } }), /missing or malformed factors/);
});

test("pricing handles multiply policies and rejects null or quota-only prices", () => {
  const multiply = { data: [{
    model_name: MODELS.text,
    factors: ["duration"],
    base_usd_value: 0.1,
    policies: [{
      rule: { resolution: { match: "1080p" } },
      pricing_type: "multiply",
      pricing_value: 2,
    }],
  }] };
  assert.equal(estimateCostUsd(multiply, {
    model: MODELS.text,
    input: { resolution: "1080p", duration: 4 },
  }), 0.8);

  assert.throws(() => estimateCostUsd({ data: [{
    model_name: MODELS.text,
    factors: ["duration"],
    policies: [{ rule: {}, pricing_type: "fixed", usd_value: null, pricing_value: 77500 }],
  }] }, { model: MODELS.text, input: { duration: 4 } }), /USD value.*missing/);

  assert.throws(() => estimateCostUsd({ data: [{
    model_name: MODELS.text,
    factors: ["duration"],
    base_usd_value: null,
    model_price: null,
  }] }, { model: MODELS.text, input: { duration: 4 } }), /base USD value.*missing/);
});

test("budget enforcement refuses estimates above the approved limit", () => {
  assert.throws(() => enforceBudget(0.572, 0.5), /exceeds/);
  assert.doesNotThrow(() => enforceBudget(0.4, 0.5));
});

test("environment parsing supports quoted keys and env-file precedence", async () => {
  assert.equal(parseEnvText('HIAPI_API_KEY="secret-value"\n').HIAPI_API_KEY, "secret-value");
  const directory = await mkdtemp(join(tmpdir(), "hiapi-fashion-env-"));
  const envFile = join(directory, ".env.local");
  try {
    await writeFile(envFile, "HIAPI_API_KEY=file-key\n", "utf8");
    const config = await resolveConfig({ envFile }, { HIAPI_API_KEY: "process-key" });
    assert.deepEqual(config, { apiKey: "file-key", baseUrl: BASE_URL });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("preview is fully offline and requires no API key", async () => {
  const output = [];
  await main([
    "--recipe", "runway-walk",
    "--prompt", "A fictional adult presents an original tailored look",
    "--preview",
  ], {
    print: (value) => output.push(value),
    fetchImpl: async () => { throw new Error("network must not be used"); },
  });
  const preview = JSON.parse(output[0]);
  assert.equal(preview.networkAccess, false);
  assert.equal(preview.estimatedCostUsd, null);
  assert.equal(preview.model, MODELS.text);
  assert.equal(preview.rightsConfirmation.suppliedMedia, false);
});

test("dry-run contacts pricing only and never needs the API key", async () => {
  const calls = [];
  const output = [];
  await main([
    "--recipe", "lookbook-pose",
    "--prompt", "A clean editorial lookbook pose",
    "--duration", "4",
    "--no-audio",
    "--dry-run",
  ], {
    print: (value) => output.push(value),
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), method: init?.method || "GET" });
      return new Response(JSON.stringify(pricingFor(MODELS.text)), { status: 200 });
    },
  });
  assert.deepEqual(calls, [{ url: `${BASE_URL}/api/pricing`, method: "GET" }]);
  assert.equal(JSON.parse(output[0]).estimatedCostUsd, 0.4);
});

test("spend rejects a missing or mismatched approved hash before network access", async () => {
  const base = ["--recipe", "lookbook-pose", "--prompt", "An editorial look", "--spend"];
  await assert.rejects(
    main(base, { fetchImpl: async () => { throw new Error("network must not be used"); } }),
    /requires --approved-request-hash/,
  );
  await assert.rejects(
    main([...base, "--approved-request-hash", "wrong"], { fetchImpl: async () => { throw new Error("network must not be used"); } }),
    /does not match/,
  );
});

test("submission retries only retryable statuses with the same idempotency key", async () => {
  const statuses = [503, 429, 200];
  const headers = [];
  const sleeps = [];
  const taskId = await submitTask(
    { apiKey: "test-key", baseUrl: BASE_URL },
    { model: MODELS.text, input: { prompt: "x" } },
    "same-key",
    {
      fetchImpl: async (_url, init) => {
        headers.push(init.headers);
        const status = statuses.shift();
        const body = status === 200 ? { data: { taskId: "tk-1" } } : { message: "retry" };
        return new Response(JSON.stringify(body), { status });
      },
      sleepImpl: async (ms) => sleeps.push(ms),
    },
  );
  assert.equal(taskId, "tk-1");
  assert.equal(headers.length, 3);
  assert.ok(headers.every((header) => header["Idempotency-Key"] === "same-key"));
  assert.deepEqual(sleeps, [2000, 4000]);

  let calls = 0;
  await assert.rejects(
    submitTask({ apiKey: "test-key", baseUrl: BASE_URL }, {}, "key", {
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({ message: "bad request" }), { status: 400 });
      },
      sleepImpl: async () => {},
    }),
    /bad request/,
  );
  assert.equal(calls, 1);

  await assert.rejects(
    submitTask({ apiKey: "test-key", baseUrl: BASE_URL }, {}, "key", {
      fetchImpl: async () => new Response(JSON.stringify({ data: { taskId: "tk-old" } }), { status: 409 }),
      sleepImpl: async () => { throw new Error("409 with a task ID must not retry"); },
    }),
    (error) => {
      assert.equal(error.taskId, "tk-old");
      assert.match(error.message, /Resume it with --task-id/);
      return true;
    },
  );
});

test("polling tolerates transient responses and recognizes broad success states", async () => {
  const responses = [
    new Response(JSON.stringify({ message: "busy" }), { status: 503 }),
    new Response(JSON.stringify({ data: { status: "processing" } }), { status: 200 }),
    new Response(JSON.stringify({ data: { status: "completed", output: [] } }), { status: 200 }),
  ];
  const sleeps = [];
  const task = await pollTask({ apiKey: "test-key", baseUrl: BASE_URL }, "tk-2", 1, 30, {
    fetchImpl: async () => responses.shift(),
    sleepImpl: async (ms) => sleeps.push(ms),
  });
  assert.equal(task.status, "completed");
  assert.equal(task.taskId, "tk-2");
  assert.deepEqual(sleeps, [1000, 1000]);
});

test("MP4 validation requires complete ftyp, moov, and mdat boxes", () => {
  assert.equal(isMp4Buffer(validMp4()), true);
  assert.equal(isMp4Buffer(Buffer.from([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0])), false);
  assert.equal(isMp4Buffer(Buffer.concat([mp4Box("ftyp", Buffer.from("isom\0\0\0\0", "binary")), mp4Box("moov")])), false);
  assert.equal(isMp4Buffer(Buffer.concat([
    mp4Box("ftyp", Buffer.from("isom\0\0\0\0", "binary")),
    mp4Box("moov", Buffer.concat([mp4Box("mvhd"), mp4Box("trak")])),
    mp4Box("mdat", Buffer.from([1])),
  ])), false);
  assert.equal(isMp4Buffer(Buffer.from("not a video")), false);
});

test("offline mocked generation writes the complete generated_unreviewed package", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hiapi-fashion-run-"));
  const envFile = join(directory, ".env.local");
  const outputs = join(directory, "outputs");
  const common = [
    "--recipe", "lookbook-pose",
    "--prompt", "展示一套原创黑色西装造型，保持服装细节稳定",
    "--action", "one slow half-turn into a relaxed pose",
    "--person-image-url", "https://example.com/person.jpg",
    "--garment-image-url", "https://example.com/jacket.jpg",
    "--person-consent-confirmed",
    "--asset-rights-confirmed",
    "--no-audio",
  ];
  try {
    await writeFile(envFile, "HIAPI_API_KEY=test-key\n", "utf8");
    const built = await buildRequest(parseArgs([...common, "--preview"]));
    const hash = requestHash(built.payload);
    const printed = [];
    const mp4 = validMp4();
    await main([
      ...common,
      "--env-file", envFile,
      "--output-dir", outputs,
      "--approved-request-hash", hash,
      "--spend",
    ], {
      print: (value) => printed.push(value),
      sleepImpl: async () => {},
      fetchImpl: async (url, init = {}) => {
        const target = String(url);
        if (target === `${BASE_URL}/api/pricing`) {
          return new Response(JSON.stringify(pricingFor(MODELS.references)), { status: 200 });
        }
        if (target === `${BASE_URL}/v1/tasks` && init.method === "POST") {
          assert.equal(init.headers.Authorization, "Bearer test-key");
          return new Response(JSON.stringify({ data: { taskId: "tk-fashion-1" } }), { status: 200 });
        }
        if (target === `${BASE_URL}/v1/tasks/tk-fashion-1`) {
          return new Response(JSON.stringify({ data: {
            taskId: "tk-fashion-1",
            status: "success",
            model: MODELS.references,
            output: [{ type: "video", url: "https://cdn.example/final.mp4" }],
          } }), { status: 200 });
        }
        if (target === "https://cdn.example/final.mp4") {
          return new Response(mp4, { status: 200, headers: { "content-type": "video/mp4" } });
        }
        throw new Error(`Unexpected URL: ${target}`);
      },
    });

    const final = JSON.parse(printed.at(-1));
    assert.equal(final.status, "generated_unreviewed");
    const manifest = JSON.parse(await readFile(join(final.outputDirectory, "manifest.json"), "utf8"));
    const qc = JSON.parse(await readFile(join(final.outputDirectory, "qc.json"), "utf8"));
    const brief = await readFile(join(final.outputDirectory, "brief.md"), "utf8");
    const savedVideo = await readFile(join(final.outputDirectory, "final.mp4"));
    assert.equal(manifest.status, "generated_unreviewed");
    assert.equal(manifest.skill, "hiapi-fashion-lookbook-video");
    assert.equal(manifest.taskStatus, "success");
    assert.equal(manifest.rightsConfirmation.assetRightsConfirmed, true);
    assert.equal(manifest.rightsConfirmation.personConsentConfirmed, true);
    assert.equal(qc.status, "pending_human_review");
    assert.equal(qc.checks.length, 8);
    assert.match(brief, /原创黑色西装造型/);
    assert.match(brief, /Fashion Lookbook Video Brief/);
    assert.match(brief, /@Image1: person/);
    assert.match(brief, /@Image2: garment/);
    assert.equal(isMp4Buffer(savedVideo), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
