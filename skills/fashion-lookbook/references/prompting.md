# Fashion Lookbook Prompting

## Prompt Order

Build every prompt in this order:

1. Duration and single-shot format.
2. Shot type and framing.
3. Creative brief.
4. Reference role map.
5. Garment truth.
6. One primary action and, only for `outfit-transition`, one transition.
7. Setting, lighting, and one camera movement.
8. Optional sound.
9. Identity, garment, anatomy, continuity, claim, and text constraints.

Keep one continuous shot. Do not convert a longer duration into extra looks, cuts, locations, or unrelated actions.

## Reference Roles

The CLI orders resolved references and labels them in the prompt:

| Slot order | Role | Controls | Must not control |
| --- | --- | --- | --- |
| First, when present | Person | Identity, face, hair, skin tone, body proportions | Target garment or setting |
| Next 1-6 | Garment | Silhouette, construction, material, color, pattern, closures, existing branding | Person identity or setting |
| Last 1-2 | Style | Setting, lighting, palette, editorial mood | People, clothing, readable text, logos |

Use multiple garment views only for one coherent target look. Do not submit unrelated outfits and ask the model to choose. State that roles must not cross-transfer.

This role separation adapts the strongest operational idea from virtual try-on research: identity, garment, pose, and environment need distinct conditioning responsibilities. The Skill uses HiAPI references and prompt contracts only; it does not embed third-party preprocessing, checkpoints, masks, DensePose, or non-commercial model weights.

## Recipe Defaults

| Recipe | Default | Recommended use | Continuity priority |
| --- | ---: | --- | --- |
| `runway-walk` | 6s | 5-10s full-body walk and final pose | Face, gait, full outfit, footwear |
| `outfit-transition` | 5s | 4-7s one-change reveal | One target outfit, no garment merging |
| `lookbook-pose` | 5s | 4-8s turn or pose | Silhouette, material, complete look |
| `person-showcase` | 5s | 4-8s restrained portrait motion | Face, hair, body proportions, styling |

Kling accepts 3-15 seconds. Seedance Fast reference generation accepts 4-15 seconds. Longer clips cost more and increase face, garment, anatomy, and later-frame drift risk. Confirm duration before live pricing.

## Garment Description

When supplied evidence supports it, describe:

- garment category and complete layering order;
- silhouette and fit language without claiming an exact size;
- neckline, collar, shoulders, sleeves, waist, rise, hem, and length;
- material appearance, drape, sheen, transparency, and texture;
- color, pattern scale, print placement, seams, closures, buttons, and hardware;
- existing logo position or readable design elements that must not be rewritten.

Do not invent fiber content, manufacturing origin, sustainability, certification, price, performance, exact measurements, or fit claims.

## Truth And Continuity

- Preserve the authorized person's face, hair, skin tone, age presentation, and body proportions.
- Do not slim, enlarge, sexualize, age-shift, ethnicity-shift, or otherwise reshape the person.
- Preserve garment silhouette, neckline, sleeves, waist, hem, layers, material, color, pattern, closures, seams, and logo placement.
- Keep fabric drape, folds, occlusion, skin contact, hands, feet, gait, joints, reflections, and gravity coherent.
- Keep the outfit stable in later frames; reject flicker, texture boiling, accessory invention, garment merging, or unexplained changes.
- `outfit-transition` may contain exactly one change to one target outfit. Other recipes keep one wardrobe throughout.
- Add no captions, CTA, watermark, readable promotional copy, or new logo.
- Treat results as creative visualization, not exact virtual try-on or proof of product fit.

## Failure Fixes

Change one variable per approved retake:

| Symptom | First correction |
| --- | --- |
| Face drifts | Simplify motion and camera; strengthen the person-role sentence |
| Garment details merge | Remove unrelated garment references and restate one target look |
| Outfit changes twice | Shorten the clip and state exactly one midpoint transition |
| Later frames lose texture | Reduce duration or action density before changing style |
| Feet or hands deform | Use calmer motion and wider, unobstructed framing |
| Style image changes identity | Strengthen that style references transfer no people or clothes |
| Product text mutates | Require no readable text invention and reject the result in QC |

Never trigger a paid retake without a new dry-run and explicit approval.
