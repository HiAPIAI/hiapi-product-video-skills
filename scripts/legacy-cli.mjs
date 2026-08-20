#!/usr/bin/env node

// The legacy package bin is an installer. This dispatcher is intentionally
// separate so old repositories can also forward their historical generation
// command without rewriting its flags or JSON output.
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COMMANDS = Object.freeze({
  "hiapi-fashion-lookbook-video": ["fashion-lookbook", "scripts/hiapi-fashion-lookbook-video.mjs"],
  "hiapi-food-commercial-video": ["food-commercial", "scripts/hiapi-food-commercial-video.mjs"],
  "hiapi-product-spokesperson-video": ["product-spokesperson", "scripts/hiapi-product-spokesperson-video.mjs"],
});

export async function dispatch(command, args = process.argv.slice(2)) {
  const entry = COMMANDS[command];
  if (!entry) {
    throw new Error(`Unknown legacy CLI "${command}". Use an adapter command: ${Object.keys(COMMANDS).join(", ")}.`);
  }
  const modulePath = resolve(ROOT, "skills", entry[0], entry[1]);
  const module = await import(pathToFileURL(modulePath).href);
  if (typeof module.main !== "function") throw new Error(`Adapter CLI does not export main(): ${modulePath}`);
  return module.main(args);
}

const invoked = basename(process.argv[1] || "");
if (invoked === basename(new URL(import.meta.url).pathname)) {
  dispatch(process.env.HIAPI_LEGACY_CLI || invoked).catch((error) => {
    console.error(error?.message ?? error);
    process.exitCode = 1;
  });
}
