# HiAPI Seedance 2.0 UGC Ad Video Skill

![HiAPI Seedance 2.0 UGC Ad Video Skill social preview](assets/social-preview-ugc-ad-video.png)

Create source-grounded, creator-style product ads for TikTok and Instagram Reels with HiAPI Seedance 2.0.

**UGC brief → claim and consent checks → 9:16 Seedance video → media QC**

[Get a HiAPI API key](https://www.hiapi.ai/en/dashboard/api-keys) · [Seedance 2.0 model](https://www.hiapi.ai/en/models/seedance-2-0) · [HiAPI docs](https://docs.hiapi.ai)

Languages: [English](README.md) | [简体中文](README.zh-CN.md)

> AI agent? Read [llms-install.md](llms-install.md), install the skill, then follow `SKILL.md`.

## What it does

This is a workflow skill for ecommerce sellers, UGC creators, and paid-social teams. It adds the advertising layer around the existing [HiAPI Seedance 2.0 video skill](https://github.com/HiAPIAI/hiapi-seedance-2-0-video-skill):

- TikTok/Reels-first `9:16` creative planning
- unboxing, first-use, direct-to-camera, problem-solution, try-on, and comparison formats
- sourced product-claim ledger
- talent-consent and synthetic-actor checks
- exact-dialogue and speaking-speed validation
- first-frame, multimodal-reference, and text-only modes
- paid-generation guards and post-generation QC

The transport, polling, and download logic is reused from the adjacent Seedance skill rather than duplicated.

## Real output example

This authenticated production E2E sample uses a synthetic adult actor and a fictional unbranded clip light. It is a creator demo, not a real customer testimonial.

[![Animated preview of a synthetic creator demonstrating a white clip light](assets/examples/ugc-clip-light-e2e-preview.gif)](assets/examples/ugc-clip-light-e2e.mp4)

**[▶ Watch the 10-second MP4 with native English dialogue](assets/examples/ugc-clip-light-e2e.mp4)**

`Seedance 2.0` · `10s` · `720 × 1280` · `9:16` · native audio · first-frame image-to-video

The inline GIF is muted and compressed for the README. The linked H.264 MP4 contains the original generated audio. Read the [authenticated E2E and QC evidence](docs/e2e-validation.md), including the limitation found during review.

## Open-source foundations

The workflow adapts patterns from established open-source projects instead of starting from a blank slate:

- [SamurAIGPT/Generative-Media-Skills](https://github.com/SamurAIGPT/Generative-Media-Skills): person + product references, a verified hero frame, and a short vertical Seedance generation flow.
- [mutonby/openshorts](https://github.com/mutonby/openshorts): product research, hook/problem/demo/CTA structure, audio-derived captions, and final QC.

See [references/github-foundations.md](references/github-foundations.md) for the dated star/license audit and adaptation boundaries. No OpenShorts `cloud/` code is included.

## Install

### One command

```bash
npx -y github:HiAPIAI/hiapi-seedance-2-0-ugc-ad-video-skill -y
```

The installer detects Codex and Claude Code skill folders. It also installs the required HiAPI Seedance 2.0 base skill when missing.

```bash
npx -y github:HiAPIAI/hiapi-seedance-2-0-ugc-ad-video-skill --codex
npx -y github:HiAPIAI/hiapi-seedance-2-0-ugc-ad-video-skill --claude
npx -y github:HiAPIAI/hiapi-seedance-2-0-ugc-ad-video-skill --target=/path/to/skills
```

Then set your key in the environment that launches the agent:

```bash
export HIAPI_API_KEY="your_hiapi_api_key"
export HIAPI_BASE_URL="https://api.hiapi.ai"
```

Do not commit `.env` or API keys.

## Quick start

Copy the machine-checkable brief:

```bash
cp assets/ugc-brief.example.json /absolute/path/to/ugc-brief.json
```

Replace all demo values and media URLs. The bundled example deliberately uses `example.com`, and the real-generation command rejects it.

Validate:

```bash
node scripts/validate-ugc-brief.mjs /absolute/path/to/ugc-brief.json
```

Inspect the real Seedance request without spending credits:

```bash
node scripts/run-ugc-seedance.mjs /absolute/path/to/ugc-brief.json --dry-run
```

Generate only after the brief, claims, talent rights, media, cost, and disclosure are approved:

```bash
node scripts/run-ugc-seedance.mjs /absolute/path/to/ugc-brief.json
```

The runner prints the HiAPI task ID as soon as creation succeeds. If local polling is interrupted, resume the same task instead of paying for a duplicate:

```bash
node scripts/run-ugc-seedance.mjs /absolute/path/to/ugc-brief.json \
  --resume-task-id "tk-hiapi-..."
```

## Default creative

| Setting | Default |
| --- | --- |
| Platforms | TikTok and Instagram Reels |
| Format | One continuous creator-style product demo |
| Duration | 10 seconds |
| Ratio | `9:16` |
| Resolution | `720p` draft |
| Audio | Native dialogue enabled |
| Storage | Temporary, downloaded locally |
| Batch strategy | Three controlled hook variants |

Each task must be 4–15 seconds. Build 20–30 second ads from separately verified clips.

## Safety and truthfulness

- Use a real person's likeness only with permission.
- Label synthetic actors in the brief and follow current platform disclosure rules before publishing.
- Do not fabricate personal experience, testimonials, reviews, results, prices, discounts, or scarcity.
- Regulated categories require current policy research and compliance approval.
- `4k` and paid persistent storage require explicit cost confirmation.
- This skill generates and verifies media; it never publishes unless the user separately requests publishing.

## Test

```bash
npm test
npm run check
```

`npm test` checks the claim/consent/media/cost gates. A successful dry-run is not proof of a successful paid generation; inspect the downloaded MP4 and complete audio before calling an ad finished.

Authenticated production E2E validation has been completed with a synthetic actor and fictional unbranded product. See [docs/e2e-validation.md](docs/e2e-validation.md) for the artifact, transcript, runtime-fix, and QC evidence.

## File structure

```text
.
├── SKILL.md
├── agents/openai.yaml
├── assets/
│   ├── examples/
│   │   ├── ugc-clip-light-e2e-preview.gif
│   │   └── ugc-clip-light-e2e.mp4
│   ├── social-preview-ugc-ad-video.png
│   └── ugc-brief.example.json
├── references/
│   ├── github-foundations.md
│   └── ugc-playbook.md
├── scripts/
│   ├── install.mjs
│   ├── run-ugc-seedance.mjs
│   └── validate-ugc-brief.mjs
└── tests/validate-ugc-brief.test.mjs
```

## License

MIT. Upstream projects retain their own licenses and trademarks.
