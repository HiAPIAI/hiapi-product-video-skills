# Architecture Draft

## Boundary

An adapter converts a scenario brief into a provider payload. It must not
perform HTTP, sleep, download, or write output files directly.

```js
export function createAdapter() {
  return {
    id: "fashion-lookbook",
    parseArgs(argv),
    validateBrief(brief),
    buildRequest(brief),
    estimateInput(payload, pricing),
    redactPayload(payload),
    artifactPolicy,
    qcChecklist,
  };
}
```

`buildRequest` returns a normalized request envelope:

```js
{
  adapter: "fashion-lookbook",
  model: "kling-3.0-omni/image-to-video",
  input: {},
  route: undefined,
  media: { roles: [] },
  rights: { assetRightsConfirmed: false, personConsentConfirmed: false },
  claims: { approved: [], forbidden: [] },
  output: { durationSeconds: 5, ratio: "9:16", resolution: "720p" }
}
```

## Shared task runner

The runner exposes four modes with explicit state transitions:

```text
preview -> normalized brief only (offline, no key, no pricing request)
dry-run -> live public pricing + redacted payload + request hash (no task)
spend -> requires matching approved request hash, creates at most one task
resume -> task-id only; poll/download existing task, never resubmit
```

The runner owns:

- API base URL allowlisting and `HIAPI_API_KEY`/env-file loading;
- live price lookup, conservative policy matching, and local budget enforcement;
- canonical JSON request hashing and an idempotency key bound to that hash;
- retrying only 409/429/503 with the same key, and never retrying a keyless
  POST after an unknown network outcome;
- terminal status recognition, polling timeout, task identity checks, and
  recovery by task ID;
- output URL extraction, MP4 signature/box validation, unique output folders,
  redacted `prompt.json`, `manifest.json`, and `qc.json`.

The runner must never print API keys, persist embedded media, or claim that a
task succeeded before a terminal success response and usable local artifact.

## Adapter-owned rules

| Adapter | Must remain local to the adapter |
| --- | --- |
| UGC | Source-grounded product facts, spoken script inclusion, talent source/consent, regulated category review, Seedance first-frame vs multimodal constraints |
| Fashion | Person/garment/style media role ordering, asset rights and person consent, fictional-fit disclaimer, Kling/Seedance route selection |
| Food | Recipe defaults, food texture direction, hero/reference route, allergen/alcohol/nutrition/health claim review |
| Spokesperson | Synthetic vs real-person route, consent gate, dialogue handling, lip-sync and endorsement QC |

The runner can carry these fields through artifacts but must not decide whether
they are satisfied. A missing consent or claims approval is a validation error
before pricing or task creation.

## Migration order

1. Add parity fixtures for each existing CLI: normalized payload, redacted
   payload, estimate, and representative failure paths.
2. Implement the runner against those fixtures without changing CLI behavior.
3. Move one adapter at a time, starting with food/fashion because their
   runners share the largest mechanical surface.
4. Keep UGC and spokesperson safety tests separate after extraction.
5. Only then replace old repositories with compatibility installers.
