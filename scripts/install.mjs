#!/usr/bin/env node

import { cp, mkdir, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { argv, env, exit, stdin, stdout } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import readline from "node:readline/promises";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DISPLAY_NAME = "HiAPI Product Video Skills";
const API_KEY_PAGE = "https://www.hiapi.ai/en/dashboard/api-keys";

const ADAPTERS = Object.freeze({
  "ugc-ad": {
    source: "skills/ugc-ad",
    installFolder: "hiapi-seedance-2-0-ugc-ad-video-skill",
    legacyBin: "hiapi-seedance-2-0-ugc-ad-video-skill",
  },
  "fashion-lookbook": {
    source: "skills/fashion-lookbook",
    installFolder: "hiapi-fashion-lookbook-video",
    legacyBin: "hiapi-fashion-lookbook-video-skill",
  },
  "food-commercial": {
    source: "skills/food-commercial",
    installFolder: "hiapi-food-commercial-video",
    legacyBin: "hiapi-food-commercial-video-skill",
  },
  "product-spokesperson": {
    source: "skills/product-spokesperson",
    installFolder: "hiapi-product-spokesperson-video",
    legacyBin: "hiapi-product-spokesperson-video-skill",
  },
});

const ALIAS_TO_ADAPTER = new Map([
  ["hiapi-product-video-skills", null],
  ...Object.entries(ADAPTERS).flatMap(([id, adapter]) => [
    [id, id],
    [adapter.legacyBin, id],
  ]),
]);

function flagValue(args, names) {
  for (const name of names) {
    const exact = args.indexOf(name);
    if (exact >= 0) return args[exact + 1] ?? "";
    const prefix = `${name}=`;
    const hit = args.find((arg) => arg.startsWith(prefix));
    if (hit) return hit.slice(prefix.length);
  }
  return "";
}

function parseArgs(args, invoked = basename(process.argv[1] || "")) {
  const options = {
    adapterIds: [],
    yes: args.includes("-y") || args.includes("--yes") || !stdin.isTTY,
    target: flagValue(args, ["--target", "--skills-dir"]),
    codex: args.includes("--codex"),
    claude: args.includes("--claude"),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--adapter") {
      const value = String(args[++index] ?? "").trim();
      if (!value) throw new Error("--adapter requires a value.");
      options.adapterIds.push(...value.split(",").map((item) => item.trim()).filter(Boolean));
    } else if (arg.startsWith("--adapter=")) {
      options.adapterIds.push(...arg.slice("--adapter=".length).split(",").map((item) => item.trim()).filter(Boolean));
    } else if (["--target", "--skills-dir"].includes(arg)) {
      index += 1;
      if (!args[index]) throw new Error(`${arg} requires a value.`);
    } else if (arg.startsWith("--target=") || arg.startsWith("--skills-dir=")) {
      // Parsed by flagValue above.
    } else if (!["-y", "--yes", "--codex", "--claude", "--help", "-h"].includes(arg)) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.adapterIds.length === 0) {
    const inferred = ALIAS_TO_ADAPTER.get(invoked);
    if (inferred) options.adapterIds.push(inferred);
  }
  if (options.adapterIds.length === 0) options.adapterIds.push(...Object.keys(ADAPTERS));
  options.adapterIds = [...new Set(options.adapterIds)];
  for (const id of options.adapterIds) {
    if (!ADAPTERS[id]) throw new Error(`Unknown adapter "${id}". Choose ${Object.keys(ADAPTERS).join(", ")}.`);
  }
  return options;
}

function detectedTargets() {
  const targets = [];
  const codexHome = env.CODEX_HOME || join(homedir(), ".codex");
  if (existsSync(codexHome)) targets.push({ label: "Codex", dir: join(codexHome, "skills") });
  const claudeHome = join(homedir(), ".claude");
  if (existsSync(claudeHome)) targets.push({ label: "Claude Code", dir: join(claudeHome, "skills") });
  return targets;
}

async function resolveTargets(options) {
  if (options.target) return [{ label: "explicit", dir: resolve(options.target.replace(/^~(?=$|[\\/])/, homedir())) }];
  if (env.AGENT_SKILLS_DIR) return [{ label: "$AGENT_SKILLS_DIR", dir: resolve(env.AGENT_SKILLS_DIR) }];
  if (options.codex) return [{ label: "Codex", dir: join(env.CODEX_HOME || join(homedir(), ".codex"), "skills") }];
  if (options.claude) return [{ label: "Claude Code", dir: join(homedir(), ".claude", "skills") }];

  const detected = detectedTargets();
  if (detected.length === 0) {
    throw new Error("No agent skills directory detected. Pass --codex, --claude, --target=/path/to/skills, or set AGENT_SKILLS_DIR.");
  }
  if (detected.length === 1 || options.yes) return detected;

  console.log("Detected agent skill directories:");
  detected.forEach((target, index) => console.log(`  ${index + 1}) ${target.label} -> ${target.dir}`));
  console.log("  a) all");
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question("Choose [1-N / a]: ")).trim().toLowerCase();
  rl.close();
  if (answer === "a" || answer === "all") return detected;
  const index = Number.parseInt(answer, 10);
  if (Number.isInteger(index) && index >= 1 && index <= detected.length) return [detected[index - 1]];
  throw new Error("Invalid target choice.");
}

async function preserveLocalState(destination, staging) {
  if (!existsSync(destination)) return [];
  const entries = await readdir(destination, { withFileTypes: true });
  const preserved = [];
  for (const entry of entries) {
    if (!(entry.name === ".env" || entry.name.startsWith(".env.") || entry.name === "outputs")) continue;
    const source = join(destination, entry.name);
    const target = join(staging, entry.name);
    await cp(source, target, { recursive: true, force: true });
    preserved.push(entry.name);
  }
  return preserved;
}

/**
 * Atomically replaces one installed Skill. The old copy is retained until the
 * new tree is in place and can be restored if the swap fails.
 */
export async function replaceInstall(destination, staging, backup) {
  const destinationExists = existsSync(destination);
  try {
    if (destinationExists) await rename(destination, backup);
    await rename(staging, destination);
    if (destinationExists) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    if (existsSync(destination)) await rm(destination, { recursive: true, force: true }).catch(() => {});
    if (destinationExists && existsSync(backup)) await rename(backup, destination).catch(() => {});
    throw error;
  }
}

export async function installAdapter(adapterId, targetDir, { sourceRoot = ROOT } = {}) {
  const adapter = ADAPTERS[adapterId];
  if (!adapter) throw new Error(`Unknown adapter "${adapterId}".`);
  await mkdir(targetDir, { recursive: true });
  const source = resolve(sourceRoot, adapter.source);
  const destination = join(targetDir, adapter.installFolder);
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const staging = join(targetDir, `.hiapi-${adapterId}-${token}.staging`);
  const backup = join(targetDir, `.hiapi-${adapterId}-${token}.backup`);
  if (!(await stat(source)).isDirectory()) throw new Error(`Adapter source is missing: ${source}`);

  try {
    await cp(source, staging, { recursive: true, force: true, filter: (name) => !name.includes(`${join("assets", "examples")}/`) });
    const preserved = await preserveLocalState(destination, staging);
    await replaceInstall(destination, staging, backup);
    return { adapter: adapterId, destination, preserved };
  } finally {
    if (existsSync(staging)) await rm(staging, { recursive: true, force: true }).catch(() => {});
    if (existsSync(backup)) await rm(backup, { recursive: true, force: true }).catch(() => {});
  }
}

export async function install(options, targets, deps = {}) {
  const results = [];
  for (const target of targets) {
    for (const adapterId of options.adapterIds) {
      results.push(await (deps.installAdapter || installAdapter)(adapterId, target.dir, deps));
    }
  }
  return results;
}

export { ADAPTERS, parseArgs, resolveTargets };

async function run() {
  const options = parseArgs(argv.slice(2));
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: npx -y github:HiAPIAI/hiapi-product-video-skills -y [--adapter ID] [--codex|--claude|--target PATH]");
    return;
  }
  const targets = await resolveTargets(options);
  const results = await install(options, targets);
  for (const result of results) {
    console.log(`[${DISPLAY_NAME}] ${result.adapter} -> ${result.destination}`);
  }
  console.log(`[${DISPLAY_NAME}] Installed ${results.length} adapter(s).`);
  console.log(env.HIAPI_API_KEY ? `[${DISPLAY_NAME}] HIAPI_API_KEY is set.` : `[${DISPLAY_NAME}] HIAPI_API_KEY is not set. Create one at ${API_KEY_PAGE}.`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  run().catch((error) => {
    console.error(`[${DISPLAY_NAME}] Failed: ${error?.message ?? error}`);
    exit(1);
  });
}
