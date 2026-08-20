# UGC Product Ad Playbook

Use this reference when choosing an ad format, writing a script, planning a batch, or diagnosing an output that feels like a polished commercial instead of social-native UGC.

## Contents

1. Format selection
2. Beat maps
3. Authenticity direction
4. Product and talent continuity
5. Prompt construction
6. Platform variants
7. Campaign batches
8. Quality control

## 1. Format selection

| Format | Best input | Core action | Strongest use | Avoid |
| --- | --- | --- | --- | --- |
| `direct-to-camera-demo` | Actor + product reference | Hold, point, operate once | Simple products, apps shown on a second device, clear feature | Long feature lists |
| `unboxing-reveal` | Sealed package + approved actor | Open, reveal, bring closer | Packaging, tactile goods, gifts | Multiple nested packages in one 10s clip |
| `first-use-demo` | Product already open | Apply, pour, switch on, assemble one step | Beauty, home, electronics, food prep | Unsupported result claims |
| `try-on` | Full/upper body + wearable product | Put on or adjust once | Apparel, accessories | Complex outfit changes |
| `problem-solution` | Two short clips or one simple prop | Show problem, then product fix | Performance ads with a clear pain point | Forcing five scenes into one generation |
| `creator-comparison` | Real comparison evidence | Show old/new state or two products | Sourced tests and measurable differences | Invented competitor weaknesses |

Call a synthetic performance a `creator demo`, not a customer testimonial. Reserve testimonial language for an authorized real person describing their own supported experience.

## 2. Beat maps

### 10-second one-shot default

| Time | Beat | Direction |
| --- | --- | --- |
| 0.0–1.5s | Hook | Start mid-thought or with the product already entering frame. |
| 1.5–4.0s | Physical reveal | Open, hold, apply, wear, or activate once. |
| 4.0–8.0s | Proof/demo | Show one visible sourced feature or outcome. |
| 8.0–10.0s | Reaction + CTA | Small smile/nod and one direct next step. |

### 15-second one-shot

| Time | Beat | Direction |
| --- | --- | --- |
| 0.0–2.0s | Hook | Name one recognizable pain or surprising discovery. |
| 2.0–6.0s | Product reveal | Keep the item large enough to identify. |
| 6.0–11.5s | Demonstration | Use one control/action; do not introduce a second product. |
| 11.5–15.0s | Supported benefit + CTA | Tie the visible action to one sourced benefit. |

### 20–30 second assembled ad

Generate separate clips:

1. `Clip A`, 5–8s: actor hook
2. `Clip B`, 5–10s: product demonstration or unboxing
3. `Clip C`, 5–8s: actor reaction and CTA

Keep each clip independently valid. Assemble only after dialogue and visual continuity pass.

## 3. Authenticity direction

Use a small number of believable signals:

- handheld phone framing with minor micro-reframing
- ordinary home, bathroom, kitchen, desk, car, gym, or storefront context
- natural daylight or practical room light
- mild exposure/autofocus breathing
- realistic skin texture and normal clothing folds
- imperfect but intentional product placement
- brief eye-line shifts to the product
- small breaths, blinks, pauses, and hand adjustments
- package tear, cap click, spray, pour, fabric, or button sound

Avoid piling on “authenticity” adjectives. Direct concrete behavior.

Reject these common anti-signals unless the brief asks for a hybrid commercial:

- flawless beauty lighting
- luxury showroom background
- exaggerated influencer gestures
- symmetrical center framing for the entire clip
- constant toothy smile
- large cinematic camera moves
- shallow-focus product glamour shots that hide use
- random floating captions or price badges
- a perfectly rehearsed brand voice

## 4. Product and talent continuity

### Product lock

Describe and verify:

- package geometry and size relative to the hand
- dominant and secondary colors
- lid, cap, zipper, button, or connector orientation
- label/logo location without asking the model to invent unreadable text
- surface finish: matte, glossy, fabric, glass, metal
- exact number of products visible
- permitted state changes: sealed → open, off → on, folded → worn

Use a first-frame plate when label, packaging, or talent-product composition must be exact.

### Talent lock

Describe and verify:

- consent source and whether the person is real or synthetic
- face, hair, skin tone, age range, wardrobe, and accessories
- hand that holds or uses the product
- camera eye line and speaking language
- disclosure needed for synthetic or sponsored content

Do not silently change demographics between variants. Vary talent only when the campaign brief explicitly calls for it.

## 5. Prompt construction

Build the final Seedance prompt in this order:

1. **Output contract** — duration, `9:16`, one continuous shot or named clip.
2. **Locked references** — identify which image is the actor and which is the product.
3. **Starting frame** — actor position, product position, camera distance, setting.
4. **Timed behavior** — one dominant action per beat.
5. **Exact dialogue** — quote the complete approved script.
6. **Performance** — energy, eye line, pauses, gestures, reaction.
7. **Camera and light** — handheld phone, natural exposure, ordinary background.
8. **Audio** — dialogue, room tone, product sounds, music policy.
9. **Continuity lock** — face, hands, packaging, product count, wardrobe.
10. **Negative constraints** — no mutations, invented text, subtitles, watermark, or unrelated logo.

### Direct-to-camera pattern

```text
Create a {duration}-second vertical 9:16 creator-style product demo in one uninterrupted handheld phone shot.
Use reference image 1 as the approved talent and reference image 2 as the exact product.

[0–{hook_end}s] Start mid-thought, relaxed eye contact, product already visible near chest height.
[{hook_end}–{demo_start}s] Bring the product closer and perform exactly one natural action: {action}.
[{demo_start}–{cta_start}s] Show the visible result while keeping the package geometry and colors unchanged.
[{cta_start}–{duration}s] Return eye contact, small nod, and finish the CTA.

Exact natural dialogue: "{script}"

Phone-camera realism, ordinary {setting}, natural room light, mild autofocus breathing, real skin texture,
subtle hand movement, intelligible {language} dialogue, quiet room tone and accurate product-use sound.
No cuts, no beauty filter, no face drift, no extra fingers, no duplicate product, no product or label mutation,
no invented text, no captions, no watermark, no unrelated logo.
```

### Unboxing pattern

Keep the package sealed and visible at the start. Use one continuous opening action. Do not ask for a full review, assembly, multiple inserts, and a CTA in the same 10-second clip.

### Try-on pattern

Use one wearable item only. Start with the item already in hand or partially worn. Direct one adjustment and one natural reaction. Avoid full outfit transformations when identity or garment fidelity matters.

## 6. Platform variants

### TikTok

- Start faster and more conversational.
- Let the spoken hook feel like a discovery or interruption.
- Keep an optional post-production hook overlay to roughly 2–6 words.
- Preserve the lower and right UI zones when adding captions later.

### Instagram Reels

- Keep the same vertical master but allow a slightly cleaner first frame.
- Make the product readable when the clip is viewed without context in the feed.
- Prepare a caption that can stand alone without “link in bio” when the actual CTA is Shop Now or Learn More.

Do not force the same CTA across organic creator posts and paid placements. Use the destination and button the user actually intends.

## 7. Campaign batches

Use a controlled matrix:

| Variant | Hook | Body | CTA | Change |
| --- | --- | --- | --- | --- |
| A | Pain recognition | Direct demo | Shop/learn | Hook only |
| B | Unexpected discovery | Same direct demo | Same CTA | Hook only |
| C | Product-first reveal | Same direct demo | Same CTA | Hook only |

After identifying a winning hook, test a body variable:

- unboxing vs first use
- creator reaction vs feature demonstration
- product close-up vs wider lifestyle context

Track for every variant:

- campaign ID and variant ID
- brief path
- sources and claims
- task ID
- output path
- QC status
- platform/caption version
- published state, if a later workflow publishes it

## 8. Quality control

### Before generation

- Confirm talent rights and synthetic disclosure.
- Confirm product image is native resolution and readable.
- Confirm every claim has a source.
- Confirm the script fits the speaking budget.
- Confirm only one media mode is configured.
- Confirm `4k` and persistent storage are off unless explicitly approved.

### After generation

- Watch with sound and without sound.
- Check the first 1.5 seconds independently.
- Pause when hands contact the product.
- Check packaging at start, middle, and end.
- Confirm the dialogue is complete and in the intended language.
- Confirm the CTA is audible and not rushed.
- Confirm no unexpected on-screen text or logo appeared.
- Confirm the ad still communicates one promise.

Regenerate when identity, hands, product, language, or claim integrity fails. Use post-production only for captions, safe-zone copy, pacing trims, audio leveling, and platform formatting—not to conceal a false or deformed product demonstration.
