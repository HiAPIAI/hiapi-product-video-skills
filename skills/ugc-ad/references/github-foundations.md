# GitHub Foundations

This skill adapts proven open-source workflow structures instead of inventing a new media pipeline. Star counts are a point-in-time snapshot from the GitHub API on 2026-07-27 and will change.

## Selected foundations

| Repository | Snapshot | License | Reused structure |
| --- | ---: | --- | --- |
| [SamurAIGPT/Generative-Media-Skills](https://github.com/SamurAIGPT/Generative-Media-Skills) | 3,913 stars | MIT | Its UGC Lifestyle Try-On, UGC Video Factory, UGC Ads Workflow, and Seedance recipes establish the person + product → verified hero/reference → vertical Seedance video pattern. |
| [mutonby/openshorts](https://github.com/mutonby/openshorts) | 2,759 stars | MIT for the core application; `cloud/` has a commercial-license exception | Its AI Shorts flow establishes grounded product analysis → hook/problem/solution/demo/CTA → actor/B-roll → audio-derived captions → final QC. |

## Adaptation decisions

- Replace MuAPI, fal.ai, ElevenLabs, Hailuo, Kling, and Upload-Post calls with the user's existing HiAPI Seedance 2.0 skill and native-audio task flow.
- Keep the successful 10-second, 9:16, one-shot UGC default from the UGC Video Factory recipe.
- Keep product research and a structured claim ledger, but do not scrape or reuse unsupported reviews as ad claims.
- Keep separate actor and product references or a composed hero plate as the visual-control layer.
- Keep audio verification before caption generation.
- Keep campaign variants as controlled changes to hook, body, or CTA.
- Add likeness consent, synthetic-actor disclosure, regulated-category review, paid-generation gates, and native artifact inspection.

No code from OpenShorts `cloud/` is used. This skill does not require either upstream repository at runtime.

## Evaluated but not selected as the main base

| Repository | Snapshot | Reason |
| --- | ---: | --- |
| [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | 54,431 stars | Excellent optional renderer for captions and multi-clip assembly, but it is not a UGC generation workflow and has its own licensing model. Do not vendor it into this skill. |
| [KlingAIResearch/LivePortrait](https://github.com/KlingAIResearch/LivePortrait) | 18,818 stars | Strong portrait animation, but it does not solve product interaction, unboxing, grounded claims, or complete social-ad structure. |
| [OpenTalker/SadTalker](https://github.com/OpenTalker/SadTalker) | 13,972 stars | Useful talking-head research, but a talking face alone is not a product trial or unboxing workflow. |
| [google-marketing-solutions/vigenair](https://github.com/google-marketing-solutions/vigenair) | 227 stars | Good ad-recrafting concepts and Apache-2.0 license, but it is GCP-specific and oriented toward adapting existing long-form ads. |
| [Anil-matcha/Open-AI-UGC](https://github.com/Anil-matcha/Open-AI-UGC) | 207 stars | Very close product scope and MIT license, but below the user's high-star preference; use only as a market-reference signal. |

## Maintenance rule

When updating this skill:

1. Recheck repository activity, license, and star counts.
2. Read the current upstream UGC recipe files, not only their README descriptions.
3. Preserve HiAPI's current model contract from the installed adjacent skill.
4. Do not claim that any upstream repository endorses HiAPI.
5. Do not copy vendor-specific credentials, hosted-cloud code, publishing integrations, or pricing claims.

