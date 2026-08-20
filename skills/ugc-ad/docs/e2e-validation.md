# Authenticated E2E validation

Date: 2026-07-27

This repository was tested against the production HiAPI `seedance-2.0` task API with an internal QA fixture:

- synthetic generic adult actor
- fictional unbranded clip light
- first-frame image-to-video
- 10 seconds
- 720p
- 9:16
- native English audio
- temporary storage

## Result

- HiAPI task reached `success`.
- The MP4 downloaded locally.
- Output SHA-256: `26e6cb50eb911a6380aab85ffdb289ee4aa6f3691719da1365f043e7747469e8`
- Container: MP4
- Video: H.264 High, 720 × 1280, 24 fps, 10.042 seconds
- Audio: AAC-LC stereo, 44.1 kHz, 10.054 seconds
- Full FFmpeg decode: passed
- Audio mean/max volume: -22.0 dB / -4.1 dB
- Offline transcript contained the complete approved dialogue and CTA.
- Visual sampling showed one continuous shot, stable actor and product geometry, a visible brightness demonstration, and no duplicate product, generated text, logo, caption, or watermark.

The static-frame review did not prove three visually discrete button presses/brightness plateaus. The fixture therefore passes integration and artifact QC, but is not represented as a publication-ready commercial or as evidence for a real product claim.

## Runtime findings

The production task schema rejected a client-supplied `seed` as an additional property. Version `0.1.1` removes `seed` from generated payloads and rejects it during brief validation.

The first local polling process later encountered a transient `fetch failed` error while the HiAPI task continued running. Version `0.1.1` now:

- prints the task ID immediately after creation
- retries transient polling/download failures
- supports `--resume-task-id` so an existing paid task can be recovered without creating a duplicate

No API key, real-person likeness, real product, real testimonial, offer, private brief, task response, or internal QC working file is committed to this public repository.

## Public homepage example

Version `0.1.2` publishes a sanitized copy of this synthetic QA fixture on the repository homepage:

- `assets/examples/ugc-clip-light-e2e-preview.gif` — muted 320 × 568 animated README preview
- `assets/examples/ugc-clip-light-e2e.mp4` — H.264/AAC version with native dialogue

The public MP4 was remuxed with metadata removed and fast-start enabled. Its SHA-256 is `bf3dc27fd0d736982fb54eb155a2be510ce696430b47db0e4ead12389b7fc31b`.

This exception publishes only the synthetic, fictional QA fixture selected by the repository owner for demonstration. API keys, private briefs, task responses, and internal QC working files remain excluded.
