#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { argv, env, exit, stdin, stdout } from "node:process";
import readline from "node:readline/promises";

const DISPLAY_NAME = "HiAPI Seedance 2.0 UGC Ad Video Skill";
const SKILL_FOLDER = "hiapi-seedance-2-0-ugc-ad-video-skill";
const SKILL_REPO = "https://github.com/HiAPIAI/hiapi-seedance-2-0-ugc-ad-video-skill.git";
const BASE_SKILL_FOLDER = "hiapi-seedance-2-0-video-skill";
const BASE_SKILL_REPO = "https://github.com/HiAPIAI/hiapi-seedance-2-0-video-skill.git";
const API_KEY_PAGE = "https://www.hiapi.ai/en/dashboard/api-keys";

const args = argv.slice(2);
const yes = args.includes("-y") || args.includes("--yes") || !stdin.isTTY;

function flagValue(name) {
  const prefix = `--${name}=`;
  const hit = args.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length).replace(/^~(?=$|\/)/, homedir()) : null;
}

function detectedTargets() {
  const targets = [];
  const codexHome = env.CODEX_HOME || join(homedir(), ".codex");
  if (existsSync(codexHome)) targets.push({ label: "Codex", dir: join(codexHome, "skills") });
  const claudeHome = join(homedir(), ".claude");
  if (existsSync(claudeHome)) targets.push({ label: "Claude Code", dir: join(claudeHome, "skills") });
  return targets;
}

async function resolveTargets() {
  const explicit = flagValue("target") || flagValue("skills-dir");
  if (explicit) return [{ label: "explicit", dir: explicit }];
  if (env.AGENT_SKILLS_DIR) return [{ label: "$AGENT_SKILLS_DIR", dir: env.AGENT_SKILLS_DIR }];

  const detected = detectedTargets();
  if (args.includes("--codex")) {
    return [{ label: "Codex", dir: join(env.CODEX_HOME || join(homedir(), ".codex"), "skills") }];
  }
  if (args.includes("--claude")) {
    return [{ label: "Claude Code", dir: join(homedir(), ".claude", "skills") }];
  }
  if (detected.length === 0) {
    throw new Error("No agent skills directory detected. Pass --codex, --claude, or --target=/path/to/skills.");
  }
  if (detected.length === 1 || yes) return detected;

  console.log("Detected agent skill directories:");
  detected.forEach((target, index) => console.log(`  ${index + 1}) ${target.label} → ${target.dir}`));
  console.log("  a) all");
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question("Choose [1-N / a]: ")).trim().toLowerCase();
  rl.close();
  if (answer === "a" || answer === "all") return detected;
  const index = Number.parseInt(answer, 10);
  if (Number.isInteger(index) && index >= 1 && index <= detected.length) return [detected[index - 1]];
  throw new Error("Invalid target choice.");
}

function ensureGit() {
  execFileSync("git", ["--version"], { stdio: "ignore" });
}

function clone(repo, destination) {
  execFileSync("git", ["clone", "--depth", "1", repo, destination], { stdio: "inherit" });
}

function hasBaseSkill(targetDirectory) {
  const candidates = [
    join(targetDirectory, "hiapi-seedance-2-0-video-skill"),
    join(targetDirectory, "hiapi-seedance-2-0-video"),
  ];
  return candidates.some((directory) => existsSync(join(directory, "scripts/lib/seedance-2-video.mjs")));
}

function installTarget(target) {
  mkdirSync(target.dir, { recursive: true });

  if (!hasBaseSkill(target.dir)) {
    const baseDestination = join(target.dir, BASE_SKILL_FOLDER);
    if (existsSync(baseDestination)) rmSync(baseDestination, { recursive: true, force: true });
    console.log(`[${DISPLAY_NAME}] Installing required Seedance base skill → ${baseDestination}`);
    clone(BASE_SKILL_REPO, baseDestination);
  } else {
    console.log(`[${DISPLAY_NAME}] Required Seedance base skill is already available.`);
  }

  const destination = join(target.dir, SKILL_FOLDER);
  if (existsSync(destination)) {
    console.log(`[${DISPLAY_NAME}] Replacing ${destination}`);
    rmSync(destination, { recursive: true, force: true });
  }
  console.log(`[${DISPLAY_NAME}] Installing UGC workflow → ${destination}`);
  clone(SKILL_REPO, destination);
}

try {
  ensureGit();
  const targets = await resolveTargets();
  for (const target of targets) installTarget(target);
  console.log("");
  if (env.HIAPI_API_KEY) {
    console.log(`[${DISPLAY_NAME}] HIAPI_API_KEY is set.`);
  } else {
    console.log(`[${DISPLAY_NAME}] HIAPI_API_KEY is not set.`);
    console.log(`Get a key: ${API_KEY_PAGE}`);
  }
  console.log(`[${DISPLAY_NAME}] Done. Restart the agent if it caches skills.`);
} catch (error) {
  console.error(`[${DISPLAY_NAME}] Failed: ${error.message}`);
  exit(1);
}
