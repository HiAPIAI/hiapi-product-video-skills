import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ADAPTERS, installAdapter, replaceInstall } from "../scripts/install.mjs";

const execFileAsync = promisify(execFile);

test("unified installer preserves env and outputs while installing the real adapter tree", async () => {
  const root = await mkdtemp(join(tmpdir(), "hiapi-product-video-installer-"));
  const target = join(root, "skills");
  const destination = join(target, ADAPTERS["food-commercial"].installFolder);
  try {
    await mkdir(join(destination, "outputs"), { recursive: true });
    await writeFile(join(destination, ".env"), "HIAPI_API_KEY=local-secret\n", "utf8");
    await writeFile(join(destination, "outputs", "draft.mp4"), "keep-me", "utf8");
    const result = await installAdapter("food-commercial", target);
    assert.deepEqual(result.preserved.sort(), [".env", "outputs"]);
    assert.equal(await readFile(join(destination, ".env"), "utf8"), "HIAPI_API_KEY=local-secret\n");
    assert.equal(await readFile(join(destination, "outputs", "draft.mp4"), "utf8"), "keep-me");
    await access(join(destination, "scripts", "hiapi-food-commercial-video.mjs"));
    await access(join(destination, "tests", "cli.test.mjs"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("atomic replacement restores the previous install after a failed swap", async () => {
  const root = await mkdtemp(join(tmpdir(), "hiapi-product-video-swap-"));
  const destination = join(root, "destination");
  const staging = join(root, "staging");
  const backup = join(root, "backup");
  try {
    await mkdir(destination);
    await writeFile(join(destination, "old.txt"), "old", "utf8");
    await mkdir(staging);
    await writeFile(join(staging, "new.txt"), "new", "utf8");
    await rm(staging, { recursive: true });
    await assert.rejects(replaceInstall(destination, staging, backup));
    assert.equal(await readFile(join(destination, "old.txt"), "utf8"), "old");
    await assert.rejects(access(backup));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("each legacy compatibility package installs from a local unified checkout", async () => {
  const root = await mkdtemp(join(tmpdir(), "hiapi-legacy-wrapper-"));
  const target = join(root, "skills");
  const wrappers = [
    ["hiapi-seedance-2-0-ugc-ad-video-skill", "hiapi-seedance-2-0-ugc-ad-video-skill"],
    ["hiapi-fashion-lookbook-video-skill", "hiapi-fashion-lookbook-video"],
    ["hiapi-food-commercial-video-skill", "hiapi-food-commercial-video"],
    ["hiapi-product-spokesperson-video-skill", "hiapi-product-spokesperson-video"],
  ];
  try {
    for (const [repository, folder] of wrappers) {
      const script = join("compat", repository, "scripts", "install.mjs");
      const { stdout } = await execFileAsync(process.execPath, [script, "--yes", `--target=${target}`], {
        cwd: new URL("..", import.meta.url),
        env: { ...process.env, HIAPI_PRODUCT_VIDEO_SKILLS_REPO: new URL("..", import.meta.url).pathname },
      });
      assert.match(stdout, /Installed/);
      await access(join(target, folder, "SKILL.md"));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
