# HiAPI Food Commercial Video Skill

Create short, single-shot coffee, beverage, restaurant, food, and ecommerce commercials through HiAPI.

[Get API Key](https://www.hiapi.ai/en/dashboard/api-keys) | [Pricing](https://www.hiapi.ai/en/pricing) | [HiAPI Docs](https://docs.hiapi.ai) | [All HiAPI Skills](https://github.com/HiAPIAI/hiapi-skills)

Languages: [English](README.md) | [Simplified Chinese](README.zh-CN.md)

> AI Agent? Read [llms-install.md](llms-install.md) for installation and spend-control rules.

## What It Does

The skill plans, previews, prices, and generates one continuous commercial shot. It selects the media route automatically:

| Input | Route | Model | Duration |
| --- | --- | --- | --- |
| Text only | Text-to-video | Kling 3.0 Omni | Any integer from 3 to 15 seconds |
| One hero image | Image-to-video | Kling 3.0 Omni | Any integer from 3 to 15 seconds |
| 1-9 reference images | Multireference video | Seedance 2.0 Fast | Any integer from 4 to 15 seconds |

Recipes cover packaged-product hero shots, coffee pours, beverage splashes, food macro shots, and restaurant atmosphere videos. The workflow keeps one action, one camera movement, realistic food physics, and truthful package appearance.

Use a different skill for spokesperson videos, reference-motion transfer, editing existing footage, multi-shot assembly, captions, logos, or CTA compositing.

## Install

Recommended:

```bash
npx -y github:HiAPIAI/hiapi-food-commercial-video-skill -y
```

Target a specific runtime:

```bash
npx -y github:HiAPIAI/hiapi-food-commercial-video-skill --codex
npx -y github:HiAPIAI/hiapi-food-commercial-video-skill --claude
npx -y github:HiAPIAI/hiapi-food-commercial-video-skill --target=/path/to/skills
```

The installer downloads and validates a new copy before replacing a clean existing install. It treats local files, ignored configuration or outputs, local branch commits, and stashes as local changes. It checks again around the directory swap and preserves the previous copy if it changed during download. Preserve local work or pass `--force` to replace it explicitly.

OpenClaw:

```bash
openclaw skills add https://github.com/HiAPIAI/hiapi-food-commercial-video-skill
```

Manual Codex install:

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
git clone https://github.com/HiAPIAI/hiapi-food-commercial-video-skill.git "${CODEX_HOME:-$HOME/.codex}/skills/hiapi-food-commercial-video"
```

## Configure

```bash
export HIAPI_API_KEY="your_hiapi_api_key_here"
```

An optional env file may contain the same variable. Never commit a real key.

Check configuration without creating a paid task:

```bash
node scripts/hiapi-food-commercial-video.mjs --check
```

## Spend-Safe Workflow

1. Preview the complete redacted payload offline with `--preview`.
2. Run `--check` only after telling the user it contacts HiAPI but creates no paid task.
3. Run `--dry-run` to fetch public pricing and print the estimate plus request hash. It creates no paid task.
4. Run `--spend --approved-request-hash HASH` only after the user explicitly approves that estimate, budget, and hash.

The default client estimate limit is `$0.50`. It is a client-side approval guard, not a server-enforced final charge cap.

Offline preview:

```bash
node scripts/hiapi-food-commercial-video.mjs \
  --recipe coffee-pour \
  --prompt "A ceramic cup of dark-roast coffee for a premium cafe" \
  --duration 6 \
  --ratio 9:16 \
  --preview
```

Price a hero-image request:

```bash
node scripts/hiapi-food-commercial-video.mjs \
  --recipe product-hero \
  --hero-image-file "/path/to/product.jpg" \
  --prompt "The supplied sparkling-water can on a clean chilled counter" \
  --duration 5 \
  --dry-run
```

Read [SKILL.md](SKILL.md) for the complete agent workflow and [references/api.md](references/api.md) for request constraints.

## Verify

```bash
npm test
```

The test suite is offline and does not create paid tasks.

## License

MIT
