# HiAPI API And Spend Boundary

## Fixed Endpoints

Use only `https://api.hiapi.ai`:

- `GET /api/pricing` for the public catalog and estimate.
- `GET /v1/tasks?page=1&size=1` for an authenticated zero-cost check.
- `POST /v1/tasks` to create one paid task.
- `GET /v1/tasks/{taskId}` to poll or resume.

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
    "duration": 6,
    "sound": false
  }
}
```

One person or complete-look image:

```json
{
  "model": "kling-3.0-omni/image-to-video",
  "storage": "temp",
  "input": {
    "image_urls": ["..."],
    "prompt": "...",
    "resolution": "720p",
    "duration": 5,
    "sound": false
  }
}
```

Person plus garment/style references, or garment/style references without a person:

```json
{
  "model": "seedance-2.0-fast",
  "storage": "temp",
  "input": {
    "reference_image_urls": ["..."],
    "prompt": "...",
    "aspect_ratio": "9:16",
    "resolution": "480p",
    "duration": 5,
    "generate_audio": false,
    "web_search": false
  }
}
```

Kling image-to-video follows the source image ratio, so omit `aspect_ratio` on that route. Kling accepts `16:9`, `9:16`, or `1:1`; Seedance Fast also accepts `4:3`, `3:4`, `21:9`, and `adaptive`.

Kling accepts integer duration 3-15 seconds. Seedance Fast accepts integer duration 4-15 seconds. The recipe defaults are planning defaults, not model restrictions.

## Pricing

Match the payload model against `model_name`. Require exactly one duration factor: `duration`, `seconds`, or `duration_seconds`. Prefer the most specific matching policy; use the highest price among equally specific matches. Support only `match` and `with` conditions and fixed or multiply policy types. Fail closed on unknown operators, malformed factors, missing or non-positive prices, unsupported policy types, and quota-only rows.

Multiply the selected positive per-second USD value by duration. Treat the result as public pricing before any account group ratio. Enforce the local maximum before submission, but never describe it as a server-side final-charge cap.

## Approval, Recovery, And Retries

- Require the exact request hash from the matching `--dry-run` before `--spend`.
- Bind a generated `Idempotency-Key` to the first 12 request-hash characters.
- Retry task creation only for HTTP `409`, `429`, or `503`, at most three attempts, with the same key.
- If a duplicate-key response includes a task ID, stop and tell the user to resume that task separately.
- Do not retry `400`, `401`, `402`, or `403`.
- Print the task ID immediately after creation.
- Resume with `--task-id`; never reconstruct and resubmit an old request.
- Accept success states `success`, `succeeded`, and `completed`; accept failure states `fail`, `failed`, `error`, `cancelled`, and `canceled`.

Use temporary storage. Do not persist user images, signed URLs, API keys, or unredacted media payloads in the output package.
