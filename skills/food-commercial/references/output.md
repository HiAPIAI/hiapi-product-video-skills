# Output Package And QC

## Files

- `final.mp4`: a complete HTTP `200` download with a video content type or octet-stream response, matching `Content-Length` when present, a valid `ftyp`, a `moov` containing `mvhd` and `trak`, and a non-empty `mdat`.
- `brief.md`: recipe, route, timing, framing, user brief, and final generated prompt.
- `prompt.json`: the API payload with every embedded or remote image value replaced by `[image omitted]`.
- `manifest.json`: task identity, model, estimate, request hash, storage, timestamps, and semantic status.
- `qc.json`: food-commercial review checklist.

Set the automated semantic status to `generated_unreviewed`. Do not mark an asset approved, publishable, claim-safe, or brand-correct without human review.

## Human QC

Review every generated video for:

1. Product and package geometry, label position, and brand color.
2. Food texture, doneness, portion, garnish, and visible ingredient truth.
3. Liquid, steam, condensation, fizz, melting, splash, and gravity physics.
4. Hands, utensils, cup rims, plates, and contact continuity.
5. Hygiene, cleanliness, color, and appetite appeal.
6. Unsupported claims, allergens, alcohol implications, certifications, and health language.
7. One continuous shot, one primary action, one camera movement, and mobile-safe framing.
8. Audio synchronization, intelligibility of natural sound, and absence of unintended speech.

If QC fails, report the defects and task ID. Do not trigger another paid generation without explicit approval.
