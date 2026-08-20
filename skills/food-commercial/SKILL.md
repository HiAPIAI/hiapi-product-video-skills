---
name: hiapi-food-commercial-video
description: Plan, preview, price, and generate single-shot food and beverage commercial videos through HiAPI, with 3-15 second Kling output or 4-15 second Seedance Fast output. Use for coffee pours, beverage splashes, food macro shots, packaged-product hero ads, restaurant atmosphere spots, and ecommerce food promos. Route text-only requests to Kling 3.0 Omni text-to-video, one hero image to Kling image-to-video, and 1-9 reference images to Seedance 2.0 Fast. Do not use for human spokespersons, reference-motion transfer, editing, multi-shot assembly, captions, added logos, or CTA compositing.
---

# HiAPI Food Commercial Video

Create one short, appetizing commercial shot. Keep the product truthful, the physics plausible, and the paid-task boundary explicit.

## Route The Request

Choose one recipe and one media route:

| Recipe | Best for |
| --- | --- |
| `product-hero` | Packaged food, cans, bottles, jars, ecommerce hero shots |
| `coffee-pour` | Coffee, tea, milk, crema, steam, cafe drinks |
| `beverage-splash` | Soda, juice, sparkling water, energetic drink shots |
| `food-macro` | Texture, doneness, drizzle, cheese pull, plated details |
| `restaurant-atmosphere` | A dish arriving in a dining-room or counter-service setting |

| Media input | Route | Model |
| --- | --- | --- |
| No image | Text-to-video | `kling-3.0-omni/text-to-video` |
| Exactly one `--hero-image-*` | Hero image-to-video | `kling-3.0-omni/image-to-video` |
| 1-9 `--reference-image-*` | Multireference generation | `seedance-2.0-fast` |

Do not mix hero and reference images. Prefer a hero or reference image whenever package geometry, label placement, brand color, or a specific dish must remain recognizable.

Do not handle a person speaking, tasting, or presenting, or action and camera guidance from an existing video. Route those requests to a dedicated installed spokesperson or reference-motion skill; if none is available, explain that this skill does not support the workflow.

## Build The Brief

Confirm the product or dish, one primary action, one camera movement, output ratio, duration, and any claims that must be avoided. If the user omitted duration, route the request first, offer a short tailored menu, and wait for a choice or explicit acceptance of the 4-second low-cost default before `--dry-run`.

Accept every whole second in the selected model's range: Kling text-to-video and hero image-to-video support 3-15 seconds; Seedance Fast reference-image generation supports 4-15 seconds. Use these planning bands without turning them into hard presets:

| Duration | Best fit |
| --- | --- |
| 3-4 seconds | Immediate hook, splash, or pack reveal; 3 seconds is Kling-only |
| 5-6 seconds | Fast social or ecommerce hero shot with a short product hold |
| 7-9 seconds | Complete pour, drizzle, texture, or reveal with readable settling time |
| 10-12 seconds | Premium slow reveal or restaurant atmosphere with restrained pacing |
| 13-15 seconds | Deliberate long take only when motion stays meaningful; highest cost and continuity risk |

Longer duration does not permit extra cuts or unrelated beats: keep one action, one camera movement, and one continuous shot. The recipe supplies concise defaults; override them with `--action`, `--setting`, `--lighting`, `--texture`, `--camera`, or `--sound` when the brief requires it.

Read `references/prompting.md` for recipe defaults and food-specific truth constraints.

## Protect Spend And Secrets

Preview the complete redacted payload offline first:

```powershell
node scripts/hiapi-food-commercial-video.mjs `
  --recipe coffee-pour `
  --prompt "A ceramic cup of dark-roast coffee for a premium cafe" `
  --duration 4 `
  --ratio 9:16 `
  --preview
```

Run real checks only after telling the user they contact HiAPI but create no paid task:

```powershell
node scripts/hiapi-food-commercial-video.mjs --check --env-file "D:\path\to\.env.local"
```

Then price the intended request from the public live catalog:

```powershell
node scripts/hiapi-food-commercial-video.mjs `
  --recipe product-hero `
  --hero-image-file "D:\media\product.jpg" `
  --prompt "The supplied sparkling-water can on a clean chilled counter" `
  --duration 4 `
  --dry-run
```

Use `--spend --approved-request-hash HASH` only after the user explicitly approves the live estimate, budget, and hash printed by the matching `--dry-run`. The default client estimate limit is `$0.50`; override `--max-cost-usd` only within an approved budget. This is not a server-enforced final-charge cap because account group ratios may apply. Create at most one paid task per invocation.

Read `HIAPI_API_KEY` from the process environment or `--env-file`. Never print, persist, or include it in artifacts. Keep the fixed API host and temporary output storage.

## Resume Safely

The CLI binds its idempotency key to the approved request hash, prints it before submission, and prints the task ID immediately after creation. Reuse that exact `--idempotency-key` if submission is interrupted before a task ID is returned. If a duplicate-key response already contains a task ID, do not attach the current brief; resume the existing task separately. After a task ID exists, resume only with:

```powershell
node scripts/hiapi-food-commercial-video.mjs --task-id TASK_ID --env-file "D:\path\to\.env.local"
```

Never submit a replacement automatically after polling or quality-review failures.

## Review The Package

Preserve `final.mp4`, `brief.md`, redacted `prompt.json`, `manifest.json`, and food-specific `qc.json`. Treat `generated_unreviewed` as the final automated status. Require human review before publishing or making product, ingredient, allergen, alcohol, nutrition, certification, or health claims.

Read `references/output.md` for artifact semantics and the QC checklist. Read `references/api.md` when changing routes, pricing logic, retries, or task handling.
