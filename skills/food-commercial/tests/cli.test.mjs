import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
} from "../scripts/hiapi-food-commercial-video.mjs";
import { hasLocalChanges, replaceInstall } from "../scripts/install.mjs";

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

test("installer restores failed swaps and preserves a concurrently changed copy", async () => {
  const root = await mkdtemp(join(tmpdir(), "food-commercial-installer-"));
  const destination = join(root, "hiapi-food-commercial-video");
  const staging = join(root, ".staging");
  const backup = join(root, ".backup");
  const oldMarker = join(destination, "old.txt");

  try {
    await mkdir(destination);
    await writeFile(oldMarker, "old", "utf8");

    assert.throws(() => replaceInstall(destination, staging, backup));
    assert.equal(await readFile(oldMarker, "utf8"), "old");
    await assert.rejects(access(backup));

    await mkdir(staging);
    await writeFile(join(staging, "new.txt"), "new", "utf8");
    replaceInstall(destination, staging, backup);
    assert.equal(await readFile(join(destination, "new.txt"), "utf8"), "new");
    await assert.rejects(access(oldMarker));
    await assert.rejects(access(backup));

    const nextStaging = join(root, ".next-staging");
    const protectedBackup = join(root, ".protected-backup");
    await mkdir(nextStaging);
    await writeFile(join(nextStaging, "next.txt"), "next", "utf8");
    assert.equal(
      replaceInstall(destination, nextStaging, protectedBackup, true),
      protectedBackup,
    );
    assert.equal(await readFile(join(protectedBackup, "new.txt"), "utf8"), "new");
    assert.equal(await readFile(join(destination, "next.txt"), "utf8"), "next");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("installer protects ignored files, local branches, and stashes", async () => {
  const root = await mkdtemp(join(tmpdir(), "food-commercial-installer-state-"));
  const repository = join(root, "install");
  const remote = join(root, "remote.git");

  try {
    await mkdir(repository);
    execFileSync("git", ["init", "--bare", remote], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "init", "-b", "main"], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "config", "user.name", "Installer Test"], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "config", "user.email", "installer@example.com"], { stdio: "ignore" });
    await writeFile(join(repository, ".gitignore"), ".env\noutputs/\n", "utf8");
    await writeFile(join(repository, "SKILL.md"), "clean\n", "utf8");
    execFileSync("git", ["-C", repository, "add", "."], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "commit", "-m", "initial"], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "remote", "add", "origin", remote], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "push", "-u", "origin", "main"], { stdio: "ignore" });

    assert.equal(hasLocalChanges(repository), false);

    await writeFile(join(repository, ".env"), "HIAPI_API_KEY=local\n", "utf8");
    assert.equal(hasLocalChanges(repository), true);
    await rm(join(repository, ".env"));

    await mkdir(join(repository, "outputs"));
    await writeFile(join(repository, "outputs", "result.mp4"), "local output", "utf8");
    assert.equal(hasLocalChanges(repository), true);
    await rm(join(repository, "outputs"), { recursive: true });

    execFileSync("git", ["-C", repository, "switch", "-c", "local-work"], { stdio: "ignore" });
    await writeFile(join(repository, "SKILL.md"), "local branch commit\n", "utf8");
    execFileSync("git", ["-C", repository, "add", "SKILL.md"], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "commit", "-m", "local"], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "switch", "main"], { stdio: "ignore" });
    assert.equal(hasLocalChanges(repository), true);

    execFileSync("git", ["-C", repository, "branch", "-D", "local-work"], { stdio: "ignore" });
    assert.equal(hasLocalChanges(repository), false);

    await writeFile(join(repository, "SKILL.md"), "stashed work\n", "utf8");
    execFileSync("git", ["-C", repository, "stash", "push", "-m", "local"], { stdio: "ignore" });
    assert.equal(hasLocalChanges(repository), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

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

test("parseArgs keeps explicit media routes and strict spend flags", () => {
  const options = parseArgs([
    "--recipe", "product-hero",
    "--prompt", "A chilled can",
    "--reference-image-url", "https://example.com/front.jpg",
    "--reference-image-url", "https://example.com/side.jpg",
    "--spend",
    "--approved-request-hash", "abc123",
  ]);
  assert.equal(options.spend, true);
  assert.equal(options.approvedRequestHash, "abc123");
  assert.deepEqual(options.referenceImageUrls, [
    "https://example.com/front.jpg",
    "https://example.com/side.jpg",
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

test("text-only recipe builds the Kling single-shot payload", async () => {
  const built = await buildRequest(parseArgs([
    "--recipe", "coffee-pour",
    "--prompt", "A premium dark-roast coffee in a ceramic cup",
    "--duration", "4",
    "--preview",
  ]));
  assert.equal(built.route, "text-to-video");
  assert.equal(built.payload.model, MODELS.text);
  assert.equal(built.payload.input.duration, 4);
  assert.equal(built.payload.input.resolution, "720p");
  assert.equal(built.payload.input.aspect_ratio, "9:16");
  assert.equal(built.payload.input.sound, true);
  assert.match(built.prompt, /one continuous pour/i);
  assert.match(built.prompt, /one primary action, one camera movement/i);
  assert.match(built.prompt, /Do not invent or rewrite readable package text/i);
});

test("duration validation follows the selected Kling or Seedance route", async () => {
  const klingShort = await buildRequest(parseArgs([
    "--recipe", "beverage-splash",
    "--prompt", "A chilled soda can",
    "--duration", "3",
    "--preview",
  ]));
  assert.equal(klingShort.payload.input.duration, 3);

  const klingLong = await buildRequest(parseArgs([
    "--recipe", "product-hero",
    "--prompt", "The supplied bottle",
    "--hero-image-url", "https://example.com/bottle.jpg",
    "--duration", "15",
    "--preview",
  ]));
  assert.equal(klingLong.payload.input.duration, 15);

  const seedanceLong = await buildRequest(parseArgs([
    "--recipe", "restaurant-atmosphere",
    "--prompt", "The supplied plated dish in a warm dining room",
    "--reference-image-url", "https://example.com/dish.jpg",
    "--duration", "15",
    "--preview",
  ]));
  assert.equal(seedanceLong.payload.input.duration, 15);
  assert.match(seedanceLong.prompt, /20% setup, 60% primary action/i);

  await assert.rejects(
    buildRequest(parseArgs(["--recipe", "product-hero", "--prompt", "A bottle", "--duration", "2", "--preview"])),
    /Kling duration must be an integer from 3 to 15/,
  );
  await assert.rejects(
    buildRequest(parseArgs([
      "--recipe", "product-hero",
      "--prompt", "A bottle",
      "--reference-image-url", "https://example.com/bottle.jpg",
      "--duration", "3",
      "--preview",
    ])),
    /Seedance Fast duration must be an integer from 4 to 15/,
  );
  await assert.rejects(
    buildRequest(parseArgs(["--recipe", "product-hero", "--prompt", "A bottle", "--duration", "4.5", "--preview"])),
    /must be an integer/,
  );
  await assert.rejects(
    buildRequest(parseArgs(["--recipe", "product-hero", "--prompt", "A bottle", "--duration", "16", "--preview"])),
    /Kling duration must be an integer from 3 to 15/,
  );
});

test("hero and reference flags select different image routes", async () => {
  const hero = await buildRequest(parseArgs([
    "--recipe", "product-hero",
    "--prompt", "The supplied bottle",
    "--hero-image-url", "https://example.com/bottle.jpg",
    "--preview",
  ]));
  assert.equal(hero.route, "hero-image-to-video");
  assert.equal(hero.payload.model, MODELS.hero);
  assert.equal("aspect_ratio" in hero.payload.input, false);

  const references = await buildRequest(parseArgs([
    "--recipe", "product-hero",
    "--prompt", "The supplied bottle",
    "--reference-image-url", "https://example.com/front.jpg",
    "--preview",
  ]));
  assert.equal(references.route, "reference-images");
  assert.equal(references.payload.model, MODELS.references);
  assert.equal(references.payload.input.reference_image_urls.length, 1);
});

test("media validation rejects ambiguity and unsupported hero framing", async () => {
  await assert.rejects(
    buildRequest(parseArgs([
      "--recipe", "product-hero",
      "--prompt", "A bottle",
      "--hero-image-url", "https://example.com/hero.jpg",
      "--reference-image-url", "https://example.com/ref.jpg",
      "--preview",
    ])),
    /Do not mix/,
  );
  await assert.rejects(
    buildRequest(parseArgs([
      "--recipe", "product-hero",
      "--prompt", "A bottle",
      "--hero-image-url", "https://example.com/hero.jpg",
      "--ratio", "1:1",
      "--preview",
    ])),
    /source image ratio/,
  );
  await assert.rejects(
    buildRequest(parseArgs([
      "--recipe", "coffee-pour",
      "--prompt", "A cup of coffee",
      "--ratio", "4:3",
      "--preview",
    ])),
    /Unsupported Kling text-to-video ratio/,
  );

  const adaptive = await buildRequest(parseArgs([
    "--recipe", "product-hero",
    "--prompt", "A packaged snack",
    "--reference-image-url", "https://example.com/snack.jpg",
    "--ratio", "adaptive",
    "--preview",
  ]));
  assert.equal(adaptive.payload.input.aspect_ratio, "adaptive");
});

test("local images require matching JPEG, PNG, or WEBP signatures", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hiapi-food-image-"));
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
        "--recipe", "product-hero",
        "--prompt", "A bottle",
        "--hero-image-url", "data:image/jpeg;base64,c2VjcmV0",
        "--preview",
      ])),
      /Unsupported image URL/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("prompt overrides preserve real UTF-8 product briefs", async () => {
  const built = await buildRequest(parseArgs([
    "--recipe", "food-macro",
    "--prompt", "一碗刚出锅的红烧牛肉面，保持真实配料和份量",
    "--action", "one slow lift of a single noodle bundle",
    "--camera", "one restrained vertical rise",
    "--no-audio",
    "--preview",
  ]));
  assert.match(built.prompt, /红烧牛肉面/);
  assert.match(built.prompt, /one slow lift/);
  assert.match(built.prompt, /one restrained vertical rise/);
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
  assert.match(key, /^food-aaaaaaaaaaaa-[a-z0-9]+$/);
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
  const first = uniqueOutputDirectory("outputs", "coffee-pour", "tk-1");
  const second = uniqueOutputDirectory("outputs", "coffee-pour", "tk-1");
  assert.notEqual(first, second);
  assert.match(first, /coffee-pour-tk-1-[a-z0-9]+$/i);
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
  const directory = await mkdtemp(join(tmpdir(), "hiapi-food-env-"));
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
    "--recipe", "beverage-splash",
    "--prompt", "A chilled sparkling-water can",
    "--preview",
  ], {
    print: (value) => output.push(value),
    fetchImpl: async () => { throw new Error("network must not be used"); },
  });
  const preview = JSON.parse(output[0]);
  assert.equal(preview.networkAccess, false);
  assert.equal(preview.estimatedCostUsd, null);
  assert.equal(preview.model, MODELS.text);
});

test("dry-run contacts pricing only and never needs the API key", async () => {
  const calls = [];
  const output = [];
  await main([
    "--recipe", "coffee-pour",
    "--prompt", "A clean coffee pour",
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
  const base = ["--recipe", "coffee-pour", "--prompt", "A coffee pour", "--spend"];
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
  const directory = await mkdtemp(join(tmpdir(), "hiapi-food-run-"));
  const envFile = join(directory, ".env.local");
  const outputs = join(directory, "outputs");
  const common = [
    "--recipe", "food-macro",
    "--prompt", "一份刚出炉的芝士焗饭，保持真实份量",
    "--action", "one slow cheese pull",
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
          return new Response(JSON.stringify(pricingFor(MODELS.text)), { status: 200 });
        }
        if (target === `${BASE_URL}/v1/tasks` && init.method === "POST") {
          assert.equal(init.headers.Authorization, "Bearer test-key");
          return new Response(JSON.stringify({ data: { taskId: "tk-food-1" } }), { status: 200 });
        }
        if (target === `${BASE_URL}/v1/tasks/tk-food-1`) {
          return new Response(JSON.stringify({ data: {
            taskId: "tk-food-1",
            status: "success",
            model: MODELS.text,
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
    assert.equal(manifest.taskStatus, "success");
    assert.equal(qc.status, "pending_human_review");
    assert.equal(qc.checks.length, 8);
    assert.match(brief, /芝士焗饭/);
    assert.equal(isMp4Buffer(savedVideo), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
