# Food Commercial Prompting

## Prompt Formula

Build every prompt in this order:

1. Shot type.
2. Product or food subject and known brand truth.
3. One primary action.
4. Setting.
5. Lighting.
6. Appetite texture.
7. One camera movement.
8. Sound.

End with the truth and continuity constraints. Keep one continuous shot with no cuts, montage, dialogue, captions, added logo, or CTA.

## Duration And Pacing

Accept every whole second supported by the selected route: Kling text-to-video and hero image-to-video use 3-15 seconds; Seedance Fast reference-image generation uses 4-15 seconds. The CLI defaults to 4 seconds, but the agent must confirm the duration before live pricing.

| Duration | Recommended use | Pacing direction |
| --- | --- | --- |
| 3 seconds | Micro-hook, instant pack reveal, or contained splash on Kling | Start the action immediately and finish on a brief clean hold |
| 4-5 seconds | Fast social or ecommerce shot | One simple action, minimal setup, short product hold |
| 6-8 seconds | Standard food action or product reveal | Let the action develop, allow texture or liquid to settle, then hold |
| 9-12 seconds | Restaurant atmosphere or slower premium reveal | Use roughly 20% setup, 60% primary action, and 20% settle-and-hold |
| 13-15 seconds | Deliberate premium long take | Use only when motion remains meaningful throughout; do not add a second action |

Useful recipe starting points are 4-6 seconds for `product-hero`, 5-8 for `coffee-pour`, 3-5 for `beverage-splash` (3 only on Kling), 5-8 for `food-macro`, and 8-12 for `restaurant-atmosphere`. Longer output costs more per second and raises continuity risk.

## Recipe Defaults

| Recipe | Shot | Primary action | Setting | Lighting | Texture | Camera | Sound |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `product-hero` | Tight commercial hero close-up | One controlled turntable reveal | Clean uncluttered counter | Crisp key light and edge highlights | Real package materials and condensation | One slow push-in | Restrained room tone and product handling |
| `coffee-pour` | Macro three-quarter close-up | One continuous pour into the cup | Clean cafe counter | Warm side light | Real crema, steam, and liquid flow | One slow push-in | Natural pour and cup ambience |
| `beverage-splash` | High-speed product close-up | One contained splash around the container | Chilled studio surface | Bright backlight and crisp highlights | Real fizz, droplets, ice, and condensation | One short lateral slide | One crisp splash with natural fizz |
| `food-macro` | Extreme food macro | One slow finishing drizzle | Clean plated surface | Soft directional food light | Truthful doneness, crumb, sauce, and moisture | One slow macro push-in | Subtle kitchen ambience |
| `restaurant-atmosphere` | Intimate table-level medium close-up | One server places the featured dish | Recognizable dining-room setting | Warm practical light with clean food highlights | Fresh steam and truthful plating | One slow dolly-in | Restrained dining-room ambience |

Override a default when it conflicts with the product. Keep the override singular: one action and one camera movement.

## Truth Constraints

- Preserve supplied package shape, proportions, color, cap, label position, and existing logo placement.
- Do not invent or rewrite readable package text, ingredients, prices, nutrition facts, certifications, awards, endorsements, origin claims, or health claims.
- Keep liquid flow, bubbles, fizz, foam, steam, melting, splashes, gravity, reflections, and contact points physically plausible.
- Keep food texture, doneness, portion, garnish, and visible ingredients consistent with the brief and references.
- Keep hands, utensils, cup rims, plates, pours, cuts, and contact continuity coherent.
- Avoid unhygienic contact, impossible residue, malformed food, excess grease, or unappetizing color shifts.
- Do not imply allergen-free, vegan, halal, kosher, organic, low-sugar, alcohol-free, medical, or nutritional properties without supplied evidence.
- Add no overlay text, subtitles, CTA, or new logo. Preserve only existing package graphics from references and leave clean negative space for deterministic post-production.
