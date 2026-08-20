import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateBrief } from "../scripts/validate-ugc-brief.mjs";

const example = JSON.parse(
  await readFile(new URL("../assets/ugc-brief.example.json", import.meta.url), "utf8"),
);

function copyExample() {
  return structuredClone(example);
}

test("bundled UGC brief passes validation", () => {
  const result = validateBrief(copyExample());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("4k generation requires explicit cost confirmation", () => {
  const brief = copyExample();
  brief.creative.resolution = "4k";
  const result = validateBrief(brief);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /4k requires creative\.cost_confirmation=true/);
});

test("real or hired talent requires consent", () => {
  const brief = copyExample();
  brief.talent.source = "hired-creator";
  brief.talent.consent_confirmed = false;
  const result = validateBrief(brief);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /requires talent\.consent_confirmed=true/);
});

test("first-frame mode requires an actual first-frame reference", () => {
  const brief = copyExample();
  brief.production.mode = "first-frame";
  brief.production.first_frame_url = "";
  brief.production.first_frame_path = "";
  const result = validateBrief(brief);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /first-frame mode requires/);
});

test("spoken script must be present verbatim in the Seedance prompt", () => {
  const brief = copyExample();
  brief.creative.seedance_prompt = "Create a vertical product demo without the approved dialogue.";
  const result = validateBrief(brief);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /must contain creative\.script verbatim/);
});

test("regulated categories require approved compliance review", () => {
  const brief = copyExample();
  brief.product.category = "health-supplement";
  brief.compliance_review = { required: true, status: "pending" };
  const result = validateBrief(brief);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /requires compliance_review/);
});

test("client-supplied seed is rejected by the current production contract", () => {
  const brief = copyExample();
  brief.production.seed = 27072026;
  const result = validateBrief(brief);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /production\.seed is not supported/);
});
