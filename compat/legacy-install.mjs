#!/usr/bin/env node

import { cp, mkdir, readdir, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { argv, env, exit, stdin, stdout } from "node:process";
import readline from "node:readline/promises";

const MONOREPO_URL = "https://github.com/HiAPIAI/hiapi-product-video-skills.git";
const BASE_SKILL_REPO = "https://github.com/HiAPIAI/hiapi-seedance-2-0-video-skill.git";

function value(args, names) {
  for (const name of names) {
    const index = args.indexOf(name);
    if (index >= 0) return args[index + 1] || "";
    const prefix = `${name}=`;
    const hit = args.find((arg) => arg.startsWith(prefix));
    if (hit) return hit.slice(prefix.length);
  }
  return "";
}

async function targets(args) {
  const explicit = value(args, ["--target", "--skills-dir"]);
  if (explicit) return [{ label: "explicit", dir: resolve(explicit.replace(/^~(?=$|[\\/])/, homedir())) }];
  if (env.AGENT_SKILLS_DIR) return [{ label: "$AGENT_SKILLS_DIR", dir: resolve(env.AGENT_SKILLS_DIR) }];
  if (args.includes("--codex")) return [{ label: "Codex", dir: join(env.CODEX_HOME || join(homedir(), ".codex"), "skills") }];
  if (args.includes("--claude")) return [{ label: "Claude Code", dir: join(homedir(), ".claude", "skills") }];
  const detected = [];
  const codexHome = env.CODEX_HOME || join(homedir(), ".codex");
  if (existsSync(codexHome)) detected.push({ label: "Codex", dir: join(codexHome, "skills") });
  const claudeHome = join(homedir(), ".claude");
  if (existsSync(claudeHome)) detected.push({ label: "Claude Code", dir: join(claudeHome, "skills") });
  if (detected.length === 0) throw new Error("No agent skills directory detected. Pass --target, --codex, or --claude.");
  if (detected.length === 1 || args.includes("-y") || args.includes("--yes") || !stdin.isTTY) return detected;
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question("Choose a target [1-N / a]: ")).trim().toLowerCase();
  rl.close();
  if (answer === "a" || answer === "all") return detected;
  const index = Number.parseInt(answer, 10);
  if (index >= 1 && index <= detected.length) return [detected[index - 1]];
  throw new Error("Invalid target choice.");
}

async function preserve(destination, staging) {
  if (!existsSync(destination)) return [];
  const kept = [];
  for (const entry of await readdir(destination, { withFileTypes: true })) {
    if (!(entry.name === ".env" || entry.name.startsWith(".env.") || entry.name === "outputs")) continue;
    await cp(join(destination, entry.name), join(staging, entry.name), { recursive: true, force: true });
    kept.push(entry.name);
  }
  return kept;
}

async function swap(destination, staging, backup) {
  const hadDestination = existsSync(destination);
  try {
    if (hadDestination) await rename(destination, backup);
    await rename(staging, destination);
    if (hadDestination) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    if (existsSync(destination)) await rm(destination, { recursive: true, force: true }).catch(() => {});
    if (hadDestination && existsSync(backup)) await rename(backup, destination).catch(() => {});
    throw error;
  }
}

async function ensureSeedanceBaseSkill(adapterId, targetDir) {
  if (adapterId !== "ugc-ad") return;
  const candidates = ["hiapi-seedance-2-0-video-skill", "hiapi-seedance-2-0-video"];
  if (candidates.some((folder) => existsSync(join(targetDir, folder, "scripts/lib/seedance-2-video.mjs")))) return;
  if (env.HIAPI_SKIP_BASE_SKILL === "1") return;
  const override = env.HIAPI_SEEDANCE_SKILL_DIR?.trim();
  if (override && existsSync(join(resolve(override), "scripts/lib/seedance-2-video.mjs"))) {
    await cp(resolve(override), join(targetDir, candidates[0]), { recursive: true, force: true });
    return;
  }
  const destination = join(targetDir, candidates[0]);
  if (existsSync(destination)) await rm(destination, { recursive: true, force: true });
  execFileSync("git", ["clone", "--depth", "1", BASE_SKILL_REPO, destination], { stdio: "inherit" });
}

function materializeSource(source) {
  if (source && existsSync(resolve(source))) return { root: resolve(source), cleanup: async () => {} };
  const checkout = join(tmpdir(), `hiapi-product-video-skills-${process.pid}-${Date.now()}`);
  const repo = source || MONOREPO_URL;
  execFileSync("git", ["clone", "--depth", "1", repo, checkout], { stdio: "inherit" });
  return { root: checkout, cleanup: async () => rm(checkout, { recursive: true, force: true }) };
}

export async function runLegacyInstaller(config, args = argv.slice(2)) {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: npx -y github:HiAPIAI/${config.repository} -y [--codex|--claude|--target PATH]`);
    return [];
  }
  const source = env.HIAPI_PRODUCT_VIDEO_SKILLS_REPO || MONOREPO_URL;
  const checkout = materializeSource(source);
  const results = [];
  try {
    const adapterSource = join(checkout.root, "skills", config.adapterId);
    if (!existsSync(adapterSource)) throw new Error(`Unified adapter is missing: ${config.adapterId}`);
    for (const target of await targets(args)) {
      await mkdir(target.dir, { recursive: true });
      const destination = join(target.dir, config.installFolder);
      const token = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const staging = join(target.dir, `.hiapi-${config.adapterId}-${token}.staging`);
      const backup = join(target.dir, `.hiapi-${config.adapterId}-${token}.backup`);
      try {
        await cp(adapterSource, staging, { recursive: true, force: true });
        const preserved = await preserve(destination, staging);
        await ensureSeedanceBaseSkill(config.adapterId, target.dir);
        await swap(destination, staging, backup);
        results.push({ destination, preserved });
      } finally {
        if (existsSync(staging)) await rm(staging, { recursive: true, force: true }).catch(() => {});
        if (existsSync(backup)) await rm(backup, { recursive: true, force: true }).catch(() => {});
      }
    }
  } finally {
    await checkout.cleanup();
  }
  for (const result of results) console.log(`[${config.displayName}] Installed -> ${result.destination}`);
  return results;
}

const invoked = basename(process.argv[1] || "");
if (invoked === basename(new URL(import.meta.url).pathname)) {
  console.error("This module is a helper. Import runLegacyInstaller from a repository-specific scripts/install.mjs.");
  exit(1);
}
