#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { argv, env, exit, stdin, stdout } from "node:process";
import readline from "node:readline/promises";
import { pathToFileURL } from "node:url";

const SKILL_FOLDER = "hiapi-food-commercial-video";
const REPO_URL = "https://github.com/HiAPIAI/hiapi-food-commercial-video-skill.git";
const DISPLAY_NAME = "HiAPI Food Commercial Video Skill";
const API_KEY_PAGE = "https://www.hiapi.ai/en/dashboard/api-keys";

const args = argv.slice(2);
const yes = args.includes("-y") || args.includes("--yes") || !stdin.isTTY;

function flagValue(name) {
  const prefix = `--${name}=`;
  const match = args.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length).replace(/^~(?=$|[\\/])/, homedir()) : null;
}

const explicitTarget = flagValue("target") ?? flagValue("skills-dir");
const forceCodex = args.includes("--codex");
const forceClaude = args.includes("--claude");
const forceReplace = args.includes("--force");

function detectCandidates() {
  const candidates = [];
  const codexHome = env.CODEX_HOME || join(homedir(), ".codex");
  if (existsSync(codexHome)) candidates.push({ label: "Codex", dir: join(codexHome, "skills") });

  const claudeHome = join(homedir(), ".claude");
  if (existsSync(claudeHome)) candidates.push({ label: "Claude Code", dir: join(claudeHome, "skills") });
  return candidates;
}

async function resolveTargets() {
  if (forceCodex && forceClaude) {
    throw new Error("Choose either --codex or --claude, not both.");
  }
  if (explicitTarget) return [{ label: "explicit", dir: explicitTarget }];
  if (env.AGENT_SKILLS_DIR) return [{ label: "$AGENT_SKILLS_DIR", dir: env.AGENT_SKILLS_DIR }];

  const detected = detectCandidates();
  if (forceCodex) {
    return [detected.find((candidate) => candidate.label === "Codex")
      ?? { label: "Codex", dir: join(env.CODEX_HOME || join(homedir(), ".codex"), "skills") }];
  }
  if (forceClaude) {
    return [detected.find((candidate) => candidate.label === "Claude Code")
      ?? { label: "Claude Code", dir: join(homedir(), ".claude", "skills") }];
  }
  if (detected.length === 0) {
    throw new Error("No agent skills directory detected. Pass --codex, --claude, --target=/path, or AGENT_SKILLS_DIR=/path.");
  }
  if (detected.length === 1) return detected;
  if (yes) return detected;

  console.log("Detected agent skill directories:");
  detected.forEach((candidate, index) => console.log(`  ${index + 1}) ${candidate.label}: ${candidate.dir}`));
  console.log("  a) all");
  const prompt = readline.createInterface({ input: stdin, output: stdout });
  const answer = (await prompt.question("Choose [1-N / a]: ")).trim().toLowerCase();
  prompt.close();
  if (answer === "a" || answer === "all") return detected;

  const index = Number.parseInt(answer, 10);
  if (Number.isInteger(index) && index >= 1 && index <= detected.length) return [detected[index - 1]];
  throw new Error("Invalid installation target selection.");
}

function ensureGit() {
  execFileSync("git", ["--version"], { stdio: "ignore" });
}

export function hasLocalChanges(destination) {
  if (!existsSync(join(destination, ".git"))) return true;
  try {
    const status = execFileSync("git", [
      "-C", destination, "status", "--porcelain", "--ignored", "--untracked-files=all",
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (status.trim().length > 0) return true;

    const localCommits = execFileSync("git", [
      "-C", destination, "rev-list", "--count", "--all", "--not", "--remotes",
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return Number.parseInt(localCommits.trim(), 10) > 0;
  } catch {
    return true;
  }
}

export function replaceInstall(destination, staging, backup, protectLocalChanges = false) {
  if (!existsSync(destination)) {
    renameSync(staging, destination);
    return null;
  }

  renameSync(destination, backup);
  try {
    renameSync(staging, destination);
  } catch (error) {
    renameSync(backup, destination);
    throw error;
  }

  if (protectLocalChanges && hasLocalChanges(backup)) return backup;

  try {
    rmSync(backup, { recursive: true, force: true });
    return null;
  } catch {
    return backup;
  }
}

function installTo(target) {
  mkdirSync(target.dir, { recursive: true });
  const destination = join(target.dir, SKILL_FOLDER);
  if (existsSync(destination) && hasLocalChanges(destination) && !forceReplace) {
    throw new Error(`Existing install has local changes: ${destination}. Preserve them or rerun with --force.`);
  }

  const nonce = `${process.pid}-${Date.now()}`;
  const staging = join(target.dir, `.${SKILL_FOLDER}.install-${nonce}`);
  const backup = join(target.dir, `.${SKILL_FOLDER}.backup-${nonce}`);
  console.log(`[${DISPLAY_NAME}] Downloading a verified copy for ${destination}.`);

  try {
    execFileSync("git", ["clone", "--depth", "1", REPO_URL, staging], { stdio: "inherit" });
    for (const required of ["SKILL.md", "package.json", "scripts/hiapi-food-commercial-video.mjs"]) {
      if (!existsSync(join(staging, required))) throw new Error(`Downloaded copy is missing ${required}.`);
    }

    if (existsSync(destination) && hasLocalChanges(destination) && !forceReplace) {
      throw new Error(`Existing install changed during download: ${destination}. Preserve it or rerun with --force.`);
    }

    const preservedBackup = replaceInstall(destination, staging, backup, !forceReplace);
    if (preservedBackup) {
      console.warn(`[${DISPLAY_NAME}] Previous install remains at ${preservedBackup}; review it before removal.`);
    }
  } catch (error) {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

function reportApiKey() {
  if (env.HIAPI_API_KEY) {
    console.log(`[${DISPLAY_NAME}] HIAPI_API_KEY is set.`);
    return;
  }
  console.log(`[${DISPLAY_NAME}] HIAPI_API_KEY is not set.`);
  console.log(`Create one at ${API_KEY_PAGE}`);
}

export async function runInstaller() {
  ensureGit();
  for (const target of await resolveTargets()) installTo(target);
  reportApiKey();
  console.log(`[${DISPLAY_NAME}] Done. Restart the agent if it caches skills.`);
}

if (argv[1] && import.meta.url === pathToFileURL(resolve(argv[1])).href) {
  runInstaller().catch((error) => {
    console.error(`[${DISPLAY_NAME}] ${error?.message ?? error}`);
    exit(1);
  });
}
