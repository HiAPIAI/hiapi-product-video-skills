# HiAPI Product Spokesperson Video Skill - Agent Notes

Read this file before installing or using the Skill.

Important links:

- Repository: https://github.com/HiAPIAI/hiapi-product-spokesperson-video-skill
- Get an API key: https://www.hiapi.ai/en/register
- Pricing: https://www.hiapi.ai/en/pricing
- HiAPI documentation: https://docs.hiapi.ai
- HiAPI Skills directory: https://github.com/HiAPIAI/hiapi-skills

## Purpose

Install `hiapi-product-spokesperson-video`, a focused workflow for generating new short product spokesperson, brand introduction, synthetic presenter, and authorized talking-head advertising videos through HiAPI. It does not edit or assemble existing footage.

## Requirements

- Node.js 18 or newer.
- Git for installation.
- `HIAPI_API_KEY` in the process environment or an ignored file passed with `--env-file`.

## Install

Automatic installation for Codex or Claude Code:

```bash
npx -y github:HiAPIAI/hiapi-product-spokesperson-video-skill -y
```

Target one runtime:

```bash
npx -y github:HiAPIAI/hiapi-product-spokesperson-video-skill --codex
npx -y github:HiAPIAI/hiapi-product-spokesperson-video-skill --claude
npx -y github:HiAPIAI/hiapi-product-spokesperson-video-skill --target=/path/to/skills
```

OpenClaw:

```bash
openclaw skills add https://github.com/HiAPIAI/hiapi-product-spokesperson-video-skill
```

Manual Codex installation:

```bash
git clone https://github.com/HiAPIAI/hiapi-product-spokesperson-video-skill.git
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R hiapi-product-spokesperson-video-skill "${CODEX_HOME:-$HOME/.codex}/skills/hiapi-product-spokesperson-video"
```

Restart the agent if it caches Skills.

## Routing

Choose exactly one scenario:

| Scenario | Model | Required input | Supported duration |
| --- | --- | --- | --- |
| `synthetic-spokesperson` | Kling 3.0 Omni (`kling-3.0-omni/text-to-video`) | Prompt, optional dialogue | 3-15s |
| `talking-head` | Kling 3.0 Omni (`kling-3.0-omni/image-to-video`) | One authorized person image, prompt, consent | 3-15s |
| `product-intro` | Seedance 2.0 Fast (`seedance-2.0-fast`) | Prompt, 1-9 product images | 4-15s |
| `brand-promo` | Seedance 2.0 Fast (`seedance-2.0-fast`) | Prompt, 1-9 brand or product images | 4-15s |

Do not route source-video editing, subject replacement in existing footage, or multi-clip assembly to this Skill.

## Mandatory Agent Behavior

1. Read `SKILL.md`.
2. Ask the user for the target duration if it is missing. State the supported range and offer the scenario default, but wait for a choice or explicit acceptance.
3. Never invent product claims, prices, endorsements, certifications, or brand facts.
4. For `talking-head`, confirm the person-image authorization and include `--consent-confirmed`. Refuse without consent.
5. Keep `HIAPI_API_KEY` secret. Never print, return, log, or persist it.
6. Run the zero-cost `--check` before generation.
7. Run the exact intended request with `--dry-run` and report the live public-price estimate and client-side budget limit.
8. Explain that account pricing ratios may affect final precharge and leave budget headroom.
9. Use `--spend` only after explicit user approval. Submit no more than one paid task per invocation.
10. Return the task ID, terminal status, estimate, local video path, and pending human QC checks. Never fabricate a path or success state.

## Commands

Zero-cost check:

```bash
node scripts/hiapi-product-spokesperson-video.mjs \
  --check \
  --env-file "/path/to/.env.local"
```

Dry-run template:

```bash
node scripts/hiapi-product-spokesperson-video.mjs \
  --scenario synthetic-spokesperson \
  --prompt "A fictional presenter in a clean studio" \
  --dialogue "Meet the new compact travel brewer." \
  --duration 3 \
  --max-cost-usd 0.50 \
  --dry-run
```

After explicit approval, rerun the reviewed command with `--spend` instead of `--dry-run`, and supply the key through the environment or `--env-file`.

For `talking-head`, add exactly one `--image-file` or `--image-url` plus `--consent-confirmed`. For `product-intro` and `brand-promo`, repeat `--reference-image-file` or `--reference-image-url` for 1-9 images.

## Recovery And Errors

- If polling is interrupted after task creation, resume with `--task-id ID`; do not submit a replacement task.
- Do not retry HTTP 400, 401, 402, or 403.
- The CLI retries submission HTTP 409, 429, and 503 up to three times with the same idempotency key.
- A timeout does not prove task failure. Resume the existing task.
- Do not regenerate after a quality problem without approval for another paid task.
- Human review is required for speech, lip sync, identity or product consistency, continuity, and claim accuracy.
