# HiAPI Product Spokesperson Video Skill

Generate short product spokesperson, brand introduction, synthetic presenter, and authorized talking-head advertising videos through [HiAPI](https://www.hiapi.ai).

[Get API Key](https://www.hiapi.ai/en/register) | [Pricing](https://www.hiapi.ai/en/pricing) | [HiAPI Docs](https://docs.hiapi.ai) | [All HiAPI Skills](https://github.com/HiAPIAI/hiapi-skills)

Languages: [English](README.md) | [简体中文](README.zh-CN.md)

> AI agent? Read [llms-install.md](llms-install.md) for installation and operating rules.

## What It Does

This focused workflow creates a new 3-15 second, single-shot video from a prompt and optional reference images. It routes each use case to the appropriate HiAPI model:

| Scenario | Model | Input | Duration |
| --- | --- | --- | --- |
| Synthetic spokesperson | Kling 3.0 Omni text-to-video | Prompt and optional dialogue | 3-15s |
| Authorized talking head | Kling 3.0 Omni image-to-video | Exactly one authorized person image, prompt, and consent | 3-15s |
| Product introduction | Seedance 2.0 Fast | Prompt and 1-9 product images | 4-15s |
| Brand promotion | Seedance 2.0 Fast | Prompt and 1-9 brand or product images | 4-15s |

This Skill creates new videos. It does not edit, replace subjects in, or assemble existing footage.

## Install

Recommended:

```bash
npx -y github:HiAPIAI/hiapi-product-spokesperson-video-skill -y
```

The installer detects Codex (`~/.codex/skills`) and Claude Code (`~/.claude/skills`). Select a target explicitly when needed:

```bash
npx -y github:HiAPIAI/hiapi-product-spokesperson-video-skill --codex
npx -y github:HiAPIAI/hiapi-product-spokesperson-video-skill --claude
npx -y github:HiAPIAI/hiapi-product-spokesperson-video-skill --target=/path/to/skills
```

OpenClaw:

```bash
openclaw skills add https://github.com/HiAPIAI/hiapi-product-spokesperson-video-skill
```

Manual installation:

```bash
git clone https://github.com/HiAPIAI/hiapi-product-spokesperson-video-skill.git
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R hiapi-product-spokesperson-video-skill "${CODEX_HOME:-$HOME/.codex}/skills/hiapi-product-spokesperson-video"
```

Restart the agent after installation if it caches Skills.

## Configure

Set the key in the environment used by your agent:

```bash
export HIAPI_API_KEY="your_hiapi_api_key_here"
```

Alternatively, keep it in a Git-ignored environment file and pass `--env-file`. Never commit or print the key.

Run the zero-cost authentication and live-pricing check:

```bash
node scripts/hiapi-product-spokesperson-video.mjs --check --env-file "/path/to/.env.local"
```

## Required Workflow

1. Choose one scenario.
2. Ask for and confirm the duration. Kling supports 3-15 seconds; Seedance supports 4-15 seconds.
3. For a real person's image, confirm authorization and include `--consent-confirmed`.
4. Run `--dry-run` to validate the request and retrieve a live public-price estimate.
5. Run one paid request with `--spend` only after the user explicitly approves the estimate and budget.

The cost guard is a client-side estimate. Account-specific pricing ratios may affect the final precharge, so leave budget headroom.

## Examples

Synthetic spokesperson estimate:

```bash
node scripts/hiapi-product-spokesperson-video.mjs \
  --scenario synthetic-spokesperson \
  --prompt "A fictional presenter in a clean studio, fixed camera" \
  --dialogue "Meet the new compact travel brewer." \
  --duration 3 \
  --max-cost-usd 0.50 \
  --dry-run
```

Authorized talking-head estimate:

```bash
node scripts/hiapi-product-spokesperson-video.mjs \
  --scenario talking-head \
  --image-file "/path/to/authorized-person.jpg" \
  --prompt "Natural eye contact and restrained movement" \
  --dialogue "Our latest collection is now available." \
  --duration 3 \
  --consent-confirmed \
  --dry-run
```

Product introduction estimate:

```bash
node scripts/hiapi-product-spokesperson-video.mjs \
  --scenario product-intro \
  --reference-image-file "/path/to/product-front.jpg" \
  --reference-image-file "/path/to/product-detail.jpg" \
  --prompt "A clean vertical product introduction with accurate materials and proportions" \
  --duration 4 \
  --dry-run
```

After approval, repeat the reviewed command with `--spend` instead of `--dry-run` and include the configured key or `--env-file`.

Successful runs save `final.mp4`, script and captions, a redacted prompt, manifest, and QC checklist under `outputs/`. The user must review speech, lip sync, visual consistency, and claim accuracy before publishing.

## Development

```bash
npm test
node --check scripts/hiapi-product-spokesperson-video.mjs
node --check scripts/install.mjs
```

## License

[MIT](LICENSE)
