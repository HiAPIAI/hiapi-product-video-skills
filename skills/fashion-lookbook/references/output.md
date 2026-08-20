# Output Package And Fashion QC

## Files

- `final.mp4`: a complete HTTP 200 download with a video or octet-stream content type, matching `Content-Length` when present, a valid `ftyp`, a `moov` containing movie and track metadata, and a non-empty `mdat`.
- `brief.md`: recipe, route, timing, framing, media-role map, user brief, and final generated prompt.
- `prompt.json`: API payload with every embedded or remote image value replaced by `[image omitted]`.
- `manifest.json`: skill, task identity, model, estimate, request hash, storage, timestamps, and semantic status.
- `qc.json`: fashion review checklist with every item initially `not_reviewed`.

Set automated semantic status to `generated_unreviewed`. Do not mark a result approved, publishable, identity-safe, garment-correct, or claim-safe without human review.

## Human QC

Review every generated video for:

1. Person identity, face, hair, skin tone, age presentation, and body proportions.
2. Garment silhouette, neckline, shoulders, sleeves, waist, hem, length, and layering.
3. Material appearance, drape, color, pattern, closures, seams, hardware, logos, and readable text.
4. Fabric folds, occlusion, contact points, reflections, gravity, and continuity.
5. Hands, feet, gait, joints, anatomy, and interaction with clothing.
6. Flicker, morphing, duplicate people, added accessories, garment merging, and later-frame degradation.
7. One continuous shot, one action, one camera movement, and exactly one transition only when requested.
8. Full-outfit visibility, mobile framing, obstruction, unintended speech, and audio synchronization.
9. Authorization and the absence of exact fit, size, tailoring, material-performance, endorsement, or certification claims.

If QC fails, report the defect, task ID, model, and affected time range. Do not trigger another paid generation without a new dry-run and explicit approval.
