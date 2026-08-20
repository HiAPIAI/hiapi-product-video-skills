---
name: hiapi-product-spokesperson-video
description: Generate product spokesperson, brand introduction, and on-camera advertising videos locally through HiAPI. Use for synthetic presenters, authorized talking-head videos from a person image, product introductions, or brand promotions from product and brand reference images. Route synthetic spokespersons to Kling 3.0 Omni text-to-video, talking heads to Kling 3.0 Omni image-to-video, and product or brand promos to Seedance 2.0 Fast. Do not use to edit or assemble existing footage.
---

# HiAPI Product Spokesperson Video

Create 3-15 second, single-shot product videos with the local CLI. Always estimate with `--dry-run` before a paid request. Create a paid task only when the user explicitly approves generation and the command includes `--spend`.

## Route The Scenario

Choose exactly one scenario:

| Scenario | Model | Required input | P0 default |
| --- | --- | --- | --- |
| `synthetic-spokesperson` | `kling-3.0-omni/text-to-video` | Prompt and optional dialogue | 3s, 720p, 9:16, audio |
| `talking-head` | `kling-3.0-omni/image-to-video` | One authorized person image, prompt, dialogue, consent | 3s, 720p, audio |
| `product-intro` | `seedance-2.0-fast` | Prompt and 1-9 product images | 4s, 480p, 9:16, audio |
| `brand-promo` | `seedance-2.0-fast` | Prompt and 1-9 brand or product images | 4s, 480p, 9:16, audio |

Before building the request, confirm the target duration. If the user did not specify it, ask how many seconds the video should be and state the supported range: Kling 3-15 seconds; Seedance 4-15 seconds. Offer the P0 default from the table, but do not proceed to `--dry-run` until the user chooses a duration or explicitly accepts the default.

Refuse `talking-head` generation unless the user confirms authorization and the command includes `--consent-confirmed`. Do not invent product claims, endorsements, prices, certifications, or brand facts.

## Protect Spend And Secrets

Run the zero-cost checks first:

```powershell
node scripts/hiapi-product-spokesperson-video.mjs --check --env-file "D:\path\to\.env.local"
```

Then run the intended request with `--dry-run`. Confirm the public-pricing estimate is within the user's limit before replacing `--dry-run` with `--spend`. The default client-side estimate limit is `$0.50`; override it only within an explicit user-approved budget. Create no more than one paid task per invocation.

Treat this as an estimate guard, not a server-enforced final-charge cap. HiAPI may apply an account-specific group ratio during task precharge. Until the task API supports a server-side maximum-cost field, disclose this limitation before paid generation and keep substantial headroom below the user's total budget.

Read `HIAPI_API_KEY` from the process environment or `--env-file`. Never print, return, persist, or include the key in previews, artifacts, manifests, errors, or logs. Use temporary storage in P0.

After installation, copy `.env.example` to an ignored `.env`, or point `--env-file` at an existing ignored environment file. Never commit the populated file. Redact both embedded image data and remote image URLs from previews and saved request artifacts.

## Run Locally

Estimate an authorized talking-head request without spending:

```powershell
node scripts/hiapi-product-spokesperson-video.mjs `
  --scenario talking-head `
  --image-file "D:\media\authorized-person.jpg" `
  --prompt "Fixed camera, natural eye contact, restrained movement" `
  --dialogue "New product, now available." `
  --consent-confirmed `
  --env-file "D:\path\to\.env.local" `
  --max-cost-usd 0.50 `
  --dry-run
```

For `synthetic-spokesperson`, omit the image and consent options. For product and brand scenarios, repeat `--reference-image-file` or `--reference-image-url`. Local JPEG, PNG, and WebP files are converted to data URIs and must not exceed 20 MiB each.

## Resume Without Spending Again

The CLI prints the idempotency key before submission and prints the task ID immediately after creation. If submission is interrupted before a task ID is returned, retry with the same `--idempotency-key`. If polling is interrupted after creation, run only `--task-id ID`, `--env-file`, and the desired `--output-dir`. This resumes polling and downloads the existing result without rebuilding or resubmitting the original request.

## Preserve The Output Package

Write each successful run under `outputs/` unless `--output-dir` is supplied. Preserve:

- `final.mp4`;
- `script.md` and `captions.srt`;
- `prompt.json` with embedded media and remote image URLs redacted;
- `manifest.json` with scenario, model, task ID, status, estimate, request hash, storage, timestamp, and expiry;
- `qc.json` marked for human review of speech, lip sync, consistency, continuity, and claim accuracy.

Never claim success without a terminal successful task and a usable local video.

## Handle Failures

- Do not retry HTTP `400`, `401`, `402`, or `403`.
- Retry submission HTTP `409`, `429`, or `503` at most three times with the original idempotency key.
- Resume polling interruptions with `--task-id`; never submit a replacement automatically.
- Do not regenerate after a quality failure without explicit approval for another paid run.
- Report the task ID, terminal status, estimate, local output path, and pending human QC checks.
