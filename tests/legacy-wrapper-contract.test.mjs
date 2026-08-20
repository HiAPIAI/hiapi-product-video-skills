import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(
  await readFile(new URL("../manifest.json", import.meta.url), "utf8"),
);
const compatibility = await readFile(
  new URL("../docs/compatibility.md", import.meta.url),
  "utf8",
);

// These are the cases every legacy repository must implement in its own
// compatibility.test.mjs. Keeping the list here makes the archive gate
// reviewable before any wrapper code is copied into an old repository.
export const LEGACY_WRAPPER_CASES = Object.freeze([
  "preview-no-network-or-task",
  "dry-run-redacted-payload-and-request-hash",
  "spend-requires-matching-request-hash",
  "unknown-post-outcome-reuses-idempotency-key",
  "resume-does-not-create-task",
  "failed-install-preserves-existing-folder-and-env",
  "policy-gate-runs-before-pricing",
]);

test("every adapter declares explicit legacy aliases", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.ok(manifest.adapters.length > 0);

  for (const adapter of manifest.adapters) {
    const aliases = adapter.aliases;
    assert.ok(aliases, `${adapter.id}: aliases are required`);
    for (const kind of ["adapter", "skill", "package", "bin"]) {
      assert.ok(Array.isArray(aliases[kind]) && aliases[kind].length > 0,
        `${adapter.id}: aliases.${kind} must be non-empty`);
    }
    assert.ok(aliases.adapter.includes(adapter.id),
      `${adapter.id}: adapter id must remain an explicit alias`);
    assert.ok(aliases.skill.includes(adapter.skillName),
      `${adapter.id}: skillName must remain an explicit alias`);
  }
});

test("legacy install commands are explicit and are not rename redirects", () => {
  for (const adapter of manifest.adapters) {
    const legacy = adapter.legacy;
    assert.match(legacy.repository, /^https:\/\/github\.com\/HiAPIAI\//);
    assert.match(legacy.installCommand, /^npx -y github:HiAPIAI\//);
    assert.match(legacy.targetCommand, /^npx -y github:HiAPIAI\/hiapi-product-video-skills/);
    assert.notEqual(legacy.installCommand, legacy.targetCommand,
      `${adapter.id}: old and target commands must not be conflated`);
    assert.deepEqual(legacy.wrapper.test, "tests/legacy-wrapper-contract.test.mjs");
  }
});

test("compatibility documentation defines the minimum wrapper contract", () => {
  for (const marker of [
    "GitHub rename",
    "legacy.installCommand",
    "Minimum wrapper test contract",
    "--preview",
    "--dry-run",
    "--spend",
    "--resume <task-id>",
    "preserves `.env`",
  ]) {
    assert.ok(compatibility.includes(marker), `missing compatibility marker: ${marker}`);
  }
  for (const caseName of LEGACY_WRAPPER_CASES) {
    assert.ok(caseName.length > 0);
  }
});
