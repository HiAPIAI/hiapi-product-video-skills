#!/usr/bin/env node
// Run with: npx -y github:HiAPIAI/hiapi-product-spokesperson-video-skill -y
// Flags: -y / --yes, --target=<dir>, --codex, --claude, --skills-dir=<dir>
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { argv, env, exit, stdin, stdout } from "node:process";
import readline from "node:readline/promises";

const SKILL_FOLDER = "hiapi-product-spokesperson-video";
const REPO_URL = "https://github.com/HiAPIAI/hiapi-product-spokesperson-video-skill.git";
const DISPLAY_NAME = "HiAPI Product Spokesperson Video Skill";
const API_KEY_PAGE = "https://www.hiapi.ai/en/dashboard/api-keys";

const args = argv.slice(2);
const yes = args.includes("-y") || args.includes("--yes") || !stdin.isTTY;
const forceCodex = args.includes("--codex");
const forceClaude = args.includes("--claude");

function flagValue(name) {
  const prefix = `--${name}=`;
  const hit = args.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length).replace(/^~(?=$|[\\/])/, homedir()) : null;
}

const explicitTarget = flagValue("target") ?? flagValue("skills-dir");

function detectedTargets() {
  const targets = [];
  const codexHome = env.CODEX_HOME || join(homedir(), ".codex");
  if (existsSync(codexHome)) targets.push({ label: "Codex", dir: join(codexHome, "skills") });
  const claudeHome = join(homedir(), ".claude");
  if (existsSync(claudeHome)) targets.push({ label: "Claude Code", dir: join(claudeHome, "skills") });
  return targets;
}

async function resolveTargets() {
  if (explicitTarget) return [{ label: "custom", dir: explicitTarget }];
  if (env.AGENT_SKILLS_DIR) return [{ label: "$AGENT_SKILLS_DIR", dir: env.AGENT_SKILLS_DIR }];

  const detected = detectedTargets();
  if (forceCodex) {
    return [detected.find((target) => target.label === "Codex") || {
      label: "Codex",
      dir: join(env.CODEX_HOME || join(homedir(), ".codex"), "skills"),
    }];
  }
  if (forceClaude) {
    return [detected.find((target) => target.label === "Claude Code") || {
      label: "Claude Code",
      dir: join(homedir(), ".claude", "skills"),
    }];
  }
  if (detected.length === 0) {
    console.error(`[${DISPLAY_NAME}] No agent skills directory detected.`);
    console.error("Pass --codex, --claude, --target=<dir>, or set AGENT_SKILLS_DIR.");
    exit(1);
  }
  if (detected.length === 1 || yes) return detected;

  console.log("Detected agent skill directories:");
  detected.forEach((target, index) => console.log(`  ${index + 1}) ${target.label}: ${target.dir}`));
  console.log("  a) all");
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question("Choose [1-N / a]: ")).trim().toLowerCase();
  rl.close();
  if (answer === "a" || answer === "all") return detected;
  const index = Number.parseInt(answer, 10) - 1;
  if (index >= 0 && index < detected.length) return [detected[index]];
  throw new Error("Invalid choice.");
}

function installTo(target) {
  mkdirSync(target.dir, { recursive: true });
  const destination = join(target.dir, SKILL_FOLDER);
  if (existsSync(destination)) {
    console.log(`[${DISPLAY_NAME}] Replacing ${destination}.`);
    rmSync(destination, { recursive: true, force: true });
  }
  console.log(`[${DISPLAY_NAME}] Installing for ${target.label}: ${destination}`);
  execFileSync("git", ["clone", "--depth", "1", REPO_URL, destination], { stdio: "inherit" });
}

function reportApiKey() {
  if (env.HIAPI_API_KEY) {
    console.log(`[${DISPLAY_NAME}] HIAPI_API_KEY is set.`);
  } else {
    console.log(`[${DISPLAY_NAME}] HIAPI_API_KEY is not set. Create one at ${API_KEY_PAGE}.`);
  }
}

(async () => {
  execFileSync("git", ["--version"], { stdio: "ignore" });
  for (const target of await resolveTargets()) installTo(target);
  reportApiKey();
  console.log(`[${DISPLAY_NAME}] Done. Restart the agent if it caches skills.`);
})().catch((error) => {
  console.error(`[${DISPLAY_NAME}] Failed: ${error?.message || error}`);
  exit(1);
});
