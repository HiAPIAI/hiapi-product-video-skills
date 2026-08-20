---
name: hiapi-seedance-2-0-ugc-ad-video-skill
description: Create source-grounded, real-person or consented synthetic-actor UGC product ads with HiAPI Seedance 2.0 for TikTok and Instagram Reels. Use for ecommerce product trials, unboxings, direct-to-camera demos, creator-style scripts, paid-social variants, 9:16 video generation, or UGC campaign batches that need authentic phone-shot direction, native dialogue, claim controls, and final media QC.
---

# HiAPI Seedance 2.0 UGC Ad Video

Create vertical product ads that feel like a creator genuinely demonstrating a product, while keeping every product claim, likeness, and output artifact auditable.

Reuse the installed `hiapi-seedance-2-0-video` implementation for payload validation, task submission, polling, and download. Do not rewrite the HiAPI transport. This skill adds the UGC research, scripting, reference-asset, campaign-variant, and QC layers.

## Hard gates

- Use a real person's image only when the user supplied it or identified an approved asset and confirmed permission to use that likeness. Do not imitate a celebrity, public figure, customer, or creator endorsement.
- Label a generated actor as synthetic in the brief. Do not present a synthetic performance as an unscripted customer testimonial.
- Ground benefits, specifications, prices, discounts, comparisons, and results in the user's materials or current primary sources. Do not invent reviews, usage history, before/after results, scarcity, or personal experience.
- Treat health, medical, supplement, weight-loss, finance, alcohol, gambling, and other regulated categories as review-required. Check current official platform and jurisdiction rules before producing final ad copy.
- Do not place unverified text, labels, prices, or badges inside the generated video. Add captions and offer text in post only after verifying the spoken audio.
- Do not publish, schedule, or upload publicly unless the user explicitly asks for that separate action.
- Do not generate at `4k` or use paid persistent storage without explicit cost confirmation.

## Defaults

Use these when the request does not specify them:

- Platforms: TikTok and Instagram Reels
- Aspect ratio: `9:16`
- Duration: `10` seconds
- Resolution: `720p` for a draft; use `1080p` when the user requests delivery quality
- Audio: Seedance native dialogue enabled
- Structure: one continuous handheld shot with four micro-beats
- Language: match the user or the target market they name
- Storage: temporary output, downloaded locally
- Batch: three independent creative variants rather than one overloaded multi-cut generation

Keep each Seedance task between `4` and `15` seconds. For a 20–30 second ad, plan two or three independently valid clips and assemble them only after every clip passes QC.

## Workflow

### 1. Build a grounded product brief

Collect or infer only safe creative choices:

- product name, category, URL, and clear product images
- target buyer, problem, differentiator, offer, and CTA
- source-backed claim ledger and forbidden claims
- platform, target market, language, duration, and batch size
- format: `unboxing-reveal`, `first-use-demo`, `direct-to-camera-demo`, `problem-solution`, `try-on`, or `creator-comparison`
- talent source: `user-provided`, `hired-creator`, or `synthetic-generic`
- approved actor image, product image, first-frame plate, or reference media

Research a supplied product URL when the visible page does not contain enough information. Prefer the official product page, product manual, verified merchant listing, and current official policies. Separate sourced facts from creative staging.

Copy `assets/ugc-brief.example.json` into the task workspace and replace the demo values. Keep the exact spoken line in both `creative.script` and `creative.seedance_prompt`.

Run:

```bash
node scripts/validate-ugc-brief.mjs /absolute/path/to/ugc-brief.json
```

Fix every error before generation. Treat warnings as explicit review items.

### 2. Choose one creative angle

Read `references/ugc-playbook.md` when selecting formats, beat timing, authenticity signals, batch variants, or platform adaptations.

Choose one promise per ad. Prefer a visible product action over adjectives:

- unbox one package
- apply or use the product once
- show one control or feature
- compare one before/after state only when real evidence exists
- name one benefit and one CTA

Use a spoken hook, not generated overlay text. Save the optional short hook overlay and captions for post-production.

For a campaign batch, vary one dimension at a time:

- Hook A: pain recognition
- Hook B: unexpected discovery
- Hook C: product-first visual reveal

Keep the product facts, offer, talent rights, and CTA source consistent across the batch.

### 3. Write for natural speech

Write contractions, pauses, self-corrections, and simple words that fit the target market. Avoid polished brand-copy cadence.

Use these speaking budgets:

- English: aim for about `2.0–2.8` words per second
- Chinese: aim for about `3.5–5.0` spoken characters per second

Build a 10-second ad with this default beat map:

1. `0.0–1.5s` — spoken or visual hook; product already visible
2. `1.5–4.0s` — unbox, apply, wear, or bring the product closer
3. `4.0–8.0s` — demonstrate one sourced feature or visible result
4. `8.0–10.0s` — natural reaction and one CTA

Do not claim “I have used this for weeks,” “this cured,” “everyone loves,” or equivalent experience/result language unless the claim ledger supports it and the talent is authorized to say it.

### 4. Choose the Seedance media mode

Use exactly one mode:

1. **First-frame plate** — best control. Use a verified 9:16 image already showing the approved talent with the exact product. Pass it as `production.first_frame_url` or `production.first_frame_path`.
2. **Multimodal references** — use separate approved actor and product images. Put them in `production.reference_image_urls` or `production.reference_image_paths`.
3. **Text only** — use only for generic concept drafts. Warn that product, packaging, and talent fidelity will be lower.

Do not mix first/last-frame inputs with multimodal references. Keep actor identity, product geometry, packaging colors, cap orientation, label placement, and approved wardrobe stable.

If a hero plate must be created first, use an available image editing skill with the actor and product references, then visually inspect the native-resolution image before calling Seedance. Do not accept a plate with mutated packaging, fabricated text, extra fingers, or an altered face.

### 5. Direct the performance

Make the Seedance prompt include:

- exact duration, `9:16`, and one-shot or clip topology
- exact approved dialogue in quotation marks
- product starting position and one dominant physical action per beat
- relaxed eye line, small hand gestures, natural blinks, breath, and micro-pauses
- handheld phone feel, slight autofocus/exposure breathing, realistic skin texture, ordinary room light, and modest background detail
- useful native sound: dialogue, room tone, package tear/click, or product-use sound
- negative constraints: no cuts unless planned, no beauty filter, no actor drift, no product mutation, no duplicate product, no invented label text, no extra fingers, no unrelated logo, no subtitles, no watermark

Avoid “cinematic commercial,” perfect symmetry, luxury studio lighting, aggressive dolly shots, or model-like posing unless the brief explicitly calls for a polished hybrid ad.

### 6. Dry-run the real payload

Locate the installed adjacent skill in this order:

- `~/.codex/skills/hiapi-seedance-2-0-video-skill`
- `~/.codex/skills/hiapi-seedance-2-0-video`
- `HIAPI_SEEDANCE_SKILL_DIR` when explicitly configured

Run the wrapper from this skill directory:

```bash
node scripts/run-ugc-seedance.mjs /absolute/path/to/ugc-brief.json --dry-run
```

The wrapper imports the adjacent skill's tested payload builder. It converts local media paths to data URIs inside Node, so large references are not passed through shell arguments. Review the redacted payload and confirm:

- model is `seedance-2.0`
- duration is `4–15`
- ratio is `9:16`
- resolution is intended
- `generate_audio` matches the brief
- exactly one media mode is present
- only approved references are present

### 7. Generate only when requested

For an actual video request, require `HIAPI_API_KEY` in the environment, then run:

```bash
node scripts/run-ugc-seedance.mjs /absolute/path/to/ugc-brief.json
```

If the user only asks for concepts, scripts, prompts, or a production plan, stop before this command and return the complete brief.

For a batch, use one brief per variant and preserve a stable campaign ID plus variant label. Change the intended angle; do not silently change product claims. The current HiAPI Seedance 2.0 task schema does not accept a client-supplied `seed`.

The runner prints the HiAPI task ID immediately after task creation. If polling or download is interrupted by a transient network error, resume that exact task instead of creating and billing a duplicate:

```bash
node scripts/run-ugc-seedance.mjs /absolute/path/to/ugc-brief.json \
  --resume-task-id "tk-hiapi-..."
```

### 8. Verify the artifact

Never infer success from an accepted request or task ID.

After download:

1. Probe the MP4 with `ffprobe`; record duration, dimensions, frame rate, codecs, and audio presence.
2. Extract the opening, demonstration, and final frames.
3. Inspect face identity, hands, mouth, product geometry, packaging, label, product count, and background continuity.
4. Listen to the complete audio or transcribe it. Verify exact language, intelligibility, lip sync, product sounds, and the complete CTA.
5. Reject outputs with fabricated text, clipped speech, face drift, deformed hands, product mutation, disclosure conflicts, or a missing visible demonstration.
6. Add platform captions, safe-zone text, music, or CTA overlays only after the raw generation passes.

If any core product or likeness failure appears, regenerate from a cleaner reference plate or simplify the action. Do not hide a material failure with cropping.

## Output contract

Return these sections in the user's language:

1. **Assumptions**
2. **Product Sources and Claim Ledger**
3. **Chosen UGC Format and Audience Angle**
4. **Hook Variants**
5. **Final Script with Time Beats**
6. **Reference Asset Plan**
7. **Copy-Ready Seedance Prompt**
8. **Validated Payload or Exact Run Command**
9. **Compliance and Disclosure Notes**
10. **QC Results**
11. **Artifact Paths** — only after real files exist

For a generated result, distinguish `created`, `still processing`, `failed`, and `downloaded`. Never say “finished” without a real local file or verified remote result URL.

## Resources

- Read `references/ugc-playbook.md` for format selection, timing, prompt patterns, batch design, and QC.
- Read `references/github-foundations.md` when auditing or updating the skill's open-source basis.
- Copy `assets/ugc-brief.example.json` as the machine-checkable brief.
- Run `scripts/validate-ugc-brief.mjs` before every paid generation.
- Run `scripts/run-ugc-seedance.mjs` for payload dry-runs and real HiAPI execution.
