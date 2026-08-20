# HiAPI Food Commercial Video Skill - Agent Install Guide

Use this file when the user asks an AI Agent to install or use the food commercial video skill.

Repository: https://github.com/HiAPIAI/hiapi-food-commercial-video-skill

Skill directory: `hiapi-food-commercial-video`

## Purpose

Generate one short, continuous coffee, beverage, food, restaurant, or ecommerce commercial shot through HiAPI.

Routes:

- Text only: Kling 3.0 Omni text-to-video, integer duration 3-15 seconds.
- One hero image: Kling 3.0 Omni image-to-video, integer duration 3-15 seconds.
- 1-9 reference images: Seedance 2.0 Fast, integer duration 4-15 seconds.

Do not route spokespersons, reference-motion transfer, source-video editing, multi-shot assembly, captions, logos, or CTA compositing here.

## Requirements

- Node.js 18 or newer.
- `git` on PATH for one-command installation.
- `HIAPI_API_KEY` only for `--check` and `--spend`.

## Install

```bash
npx -y github:HiAPIAI/hiapi-food-commercial-video-skill -y
```

Use `--codex`, `--claude`, `--target=/path`, or `AGENT_SKILLS_DIR=/path` to select the installation directory. The installer refuses to overwrite local files, ignored configuration or outputs, local branch commits, and stashes unless the user explicitly passes `--force`. It checks again around the swap and preserves the previous copy if it changes during download.

Manual Codex install:

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
git clone https://github.com/HiAPIAI/hiapi-food-commercial-video-skill.git "${CODEX_HOME:-$HOME/.codex}/skills/hiapi-food-commercial-video"
```

OpenClaw:

```bash
openclaw skills add https://github.com/HiAPIAI/hiapi-food-commercial-video-skill
```

## Configure

```bash
export HIAPI_API_KEY="your_hiapi_api_key_here"
```

Never print or commit a real API key.

## Required Execution Order

1. Read `SKILL.md` and route the media input.
2. Confirm the recipe, one action, one camera movement, ratio, and duration.
3. If duration is omitted, offer a short route-specific menu and wait for a choice or explicit acceptance of the 4-second low-cost default.
4. Run `--preview` first. Preview is fully offline and needs no API key.
5. Tell the user before `--check`; it contacts HiAPI but creates no paid task.
6. Run `--dry-run` for the exact request. It contacts the public pricing catalog only and prints a cost estimate plus request hash.
7. Do not run `--spend` until the user explicitly approves the live estimate, budget, and exact hash.
8. Pass that exact hash with `--spend --approved-request-hash HASH` and create at most one paid task.
9. Return the local output package path or remote result URL. Never fabricate output.

The default `--max-cost-usd` value is `0.50`. It is a client-side estimate guard, not a server-enforced final charge cap.

## Commands

Offline preview:

```bash
node scripts/hiapi-food-commercial-video.mjs \
  --recipe coffee-pour \
  --prompt "A ceramic cup of dark-roast coffee for a premium cafe" \
  --duration 6 \
  --ratio 9:16 \
  --preview
```

Configuration check:

```bash
node scripts/hiapi-food-commercial-video.mjs --check
```

Dry-run pricing:

```bash
node scripts/hiapi-food-commercial-video.mjs \
  --recipe product-hero \
  --hero-image-file "/path/to/product.jpg" \
  --prompt "The supplied product on a clean chilled counter" \
  --duration 5 \
  --dry-run
```

## Error Handling

- Missing or invalid key: point the user to https://www.hiapi.ai/en/dashboard/api-keys.
- Insufficient balance or quota: point the user to https://www.hiapi.ai/en/dashboard and pricing.
- HTTP 400: check route, duration, resolution, ratio, media count, and image format.
- HTTP 429 or transient server errors: wait and retry using the same idempotency key.
- Estimate above budget: stop and ask the user to shorten the request or approve a different budget.
- Task timeout: report the task ID and resume it with `--task-id`; do not submit a duplicate paid task.

Run `npm test` after installation when verification is requested. Tests are offline.
