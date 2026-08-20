#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const folder = process.env.HIAPI_LEGACY_SKILL_DIR || join(process.env.CODEX_HOME || join(homedir(), ".codex"), "skills", "hiapi-seedance-2-0-ugc-ad-video-skill");
const script = resolve(folder, "scripts/run-ugc-seedance.mjs");
if (!existsSync(script)) throw new Error(`Installed adapter is missing: ${script}`);
const result = spawnSync(process.execPath, [script, ...process.argv.slice(2)], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
