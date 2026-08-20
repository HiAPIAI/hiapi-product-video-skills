---
name: hiapi-fashion-lookbook-video
description: Plan, preview, price, and generate short single-shot fashion videos through HiAPI. Use for runway walks, one target-outfit transition, editorial lookbook poses, and non-speaking person showcases for clothing brands, fashion creators, and ecommerce sellers. Route text-only briefs to Kling 3.0 Omni text-to-video, one authorized person or complete-look image to Kling image-to-video, and person plus garment/style references to Seedance 2.0 Fast. Do not use for exact virtual try-on or fit guarantees, multi-outfit montages, deterministic motion transfer, talking presenters, captions, logos, CTA compositing, or multi-shot editing.
---

# HiAPI Fashion Lookbook Video

Create one short fashion shot. Keep the person authorized, the garment recognizable, the reference roles explicit, and paid generation separately approved.

## Route The Request

Choose one recipe:

| Recipe | Best for |
| --- | --- |
| `runway-walk` | A full-body walk ending in one controlled pose |
| `outfit-transition` | Exactly one initial-to-target outfit transformation |
| `lookbook-pose` | A slow turn or pose that shows one complete look |
| `person-showcase` | A non-speaking fashion portrait with restrained motion |

Choose the media route from the supplied assets:

| Media input | Route | Model |
| --- | --- | --- |
| No image | Text-to-video | `kling-3.0-omni/text-to-video` |
| Exactly one person or complete-look image, no other image | Image-to-video | `kling-3.0-omni/image-to-video` |
| Any garment or style reference, up to 9 images total | Multireference generation | `seedance-2.0-fast` |

Use at most one person image, six garment images for one target look, and two style images. The combined limit is nine. Reference-driven `outfit-transition` requires one person image and at least one garment image. Text-only `outfit-transition` is fictional and cannot promise a specific garment or identity.

Delegate a speaking presenter to `$hiapi-product-spokesperson-video`. Delegate action or camera guidance from a video to `$hiapi-reference-motion-transfer`. Delegate multi-shot assembly, captions, music, logos, or CTA compositing to a video editing workflow.

## Confirm Rights And Scope

Before using any image, confirm that the user owns it or is authorized to use it. Require `--asset-rights-confirmed` for every media request and additionally require `--person-consent-confirmed` when a person image is supplied. Do not infer consent, ownership, or a clean commercial license from the image itself.

Describe generated output as creative fashion visualization. Do not describe it as evidence of exact fit, size, tailoring, fabric performance, or how a garment will look on a buyer. Do not make body-shape, age, ethnicity, medical, or attractiveness claims.

Confirm the recipe, one primary action, one camera movement, duration, output ratio, target garment details, and whether audio is needed. Generated audio is off by default. Read `references/prompting.md` for recipe defaults, reference roles, timing, and fashion truth constraints.

## Preview Before Spending

Preview the complete redacted payload offline:

```powershell
node scripts/hiapi-fashion-lookbook-video.mjs `
  --recipe lookbook-pose `
  --prompt "An adult model presents one structured black evening look" `
  --duration 5 `
  --ratio 9:16 `
  --preview
```

For an authorized person and target garment:

```powershell
node scripts/hiapi-fashion-lookbook-video.mjs `
  --recipe outfit-transition `
  --person-image-file "D:\media\person.jpg" `
  --garment-image-file "D:\media\dress-front.jpg" `
  --garment-image-file "D:\media\dress-back.jpg" `
  --person-consent-confirmed `
  --asset-rights-confirmed `
  --prompt "One clean change into the supplied evening dress" `
  --garment-details "Preserve the square neckline, fitted waist, ankle hem, and silver buttons" `
  --duration 5 `
  --ratio 9:16 `
  --preview
```

Run live checks only after telling the user that they contact HiAPI but create no paid task:

```powershell
node scripts/hiapi-fashion-lookbook-video.mjs --check --env-file "D:\path\to\.env.local"
```

Then price the exact request with `--dry-run`. It reads the public live catalog and creates no task. The default local estimate limit is `$1.00`; override `--max-cost-usd` only within an approved budget. Public pricing is not a server-side final-charge cap because account group ratios may apply.

Use `--spend --approved-request-hash HASH` only after the user explicitly approves the matching live estimate, budget, and request hash. One invocation creates at most one paid task. Read the API key from `HIAPI_API_KEY` or `--env-file`; never print or persist it.

## Resume Safely

The CLI binds its idempotency key to the approved request hash and prints the task ID immediately after creation. Reuse the exact printed `--idempotency-key` only if submission was interrupted before a task ID returned. After a task ID exists, resume without resubmitting:

```powershell
node scripts/hiapi-fashion-lookbook-video.mjs --task-id TASK_ID --env-file "D:\path\to\.env.local"
```

Never automatically create a replacement task after polling, download, or quality-review failure.

## Review The Package

Preserve `final.mp4`, `brief.md`, redacted `prompt.json`, `manifest.json`, and `qc.json`. Treat `generated_unreviewed` as the final automated status. Require human review before publication, ecommerce use, paid advertising, or making garment, identity, fit, size, material, origin, certification, or performance claims.

Read `references/output.md` for artifact semantics and the fashion QC checklist. Read `references/api.md` before changing models, routes, pricing, retries, or task handling.
