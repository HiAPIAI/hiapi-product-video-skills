# HiAPI API And Spend Boundary

## Fixed Endpoints

Use only `https://api.hiapi.ai`:

- `GET /api/pricing` for the public live catalog and cost estimate.
- `GET /v1/tasks?page=1&size=1` for the authenticated zero-cost check.
- `POST /v1/tasks` to create one paid task.
- `GET /v1/tasks/{taskId}` to poll or resume it.

Send the API key only as `Authorization: Bearer ...`. Do not allow a caller-controlled base URL.

## Routes

Text-to-video:

```json
{
  "model": "kling-3.0-omni/text-to-video",
  "storage": "temp",
  "input": {
    "prompt": "...",
    "resolution": "720p",
    "aspect_ratio": "9:16",
    "duration": 4,
    "sound": true
  }
}
```

One hero image:

```json
{
  "model": "kling-3.0-omni/image-to-video",
  "storage": "temp",
  "input": {
    "image_urls": ["..."],
    "prompt": "...",
    "resolution": "720p",
    "duration": 4,
    "sound": true
  }
}
```

One to nine reference images:

```json
{
  "model": "seedance-2.0-fast",
  "storage": "temp",
  "input": {
    "reference_image_urls": ["..."],
    "prompt": "...",
    "aspect_ratio": "9:16",
    "resolution": "480p",
    "duration": 4,
    "generate_audio": true,
    "web_search": false
  }
}
```

Kling image-to-video follows the source image framing, so do not send `aspect_ratio` for that route.

Kling text-to-video accepts `16:9`, `9:16`, or `1:1`. Seedance Fast accepts `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `21:9`, or `adaptive`.

Kling text-to-video and image-to-video accept any integer duration from 3 to 15 seconds. Seedance Fast accepts any integer duration from 4 to 15 seconds. The CLI keeps a 4-second default to preserve the low-cost behavior, while the Skill asks the user to choose a duration before live pricing.

## Pricing

Match the payload model against `model_name`. Require exactly one duration factor: `duration`, `seconds`, or `duration_seconds`. Prefer the most specific matching `policies[].rule`; use `usd_value` for fixed policies and `base_usd_value` multiplied by `times` or `pricing_value` for multiply policies. Otherwise use `base_usd_value` or the legacy `model_price`. Support only `match` and `with` conditions. Fail closed on unknown operators, malformed factors, unsupported policy types, missing USD values, or zero/null prices. Multiply the selected positive per-second USD value by duration.

Treat the result as a public-price estimate before any account group ratio. Enforce the local maximum before task submission, but never describe it as a server-side cap.

## Recovery And Retries

- Bind the generated `Idempotency-Key` to the first 12 characters of the approved request hash; only reuse the exact key printed for that payload.
- Require the exact request hash printed by the matching `--dry-run` before submission.
- Retry task creation only for HTTP `409`, `429`, or `503`, at most three attempts, with the same key. If a `409` already includes a task ID, stop and resume that task separately instead of attaching the current brief.
- Do not retry `400`, `401`, `402`, or `403`.
- Print the task ID immediately after creation.
- Resume an existing task with `--task-id`; do not recreate its original request.
- Accept terminal success statuses `success`, `succeeded`, or `completed` and terminal failure statuses `fail`, `failed`, `error`, `cancelled`, or `canceled`.
