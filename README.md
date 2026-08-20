# hiapi-product-video-skills

This monorepo consolidates four focused product-video Skills behind one shared
task runner. The former repositories remain available as archived compatibility
pages while users migrate to the scoped adapters here.

The repository would contain four focused product-video Skills behind one
shared task runner:

```text
hiapi-product-video-skills/
├── skills/
│   ├── ugc-ad/
│   ├── fashion-lookbook/
│   ├── food-commercial/
│   └── product-spokesperson/
├── packages/
│   └── task-runner/
├── docs/
├── manifest.json
└── package.json
```

The scenario adapters own creative and safety contracts. The shared runner
owns the mechanics that should behave identically across scenarios: preview,
live price estimation, explicit spend approval, request hashing,
idempotency, safe retries, polling, output download, redaction, and artifact
packaging.

The first release keeps the legacy wrapper contract explicit. Each adapter must
pass its parity fixture before the old repository is archived.

## Current adapters

| Adapter | Existing source | Distinct contract |
| --- | --- | --- |
| `ugc-ad` | `hiapi-seedance-2-0-ugc-ad-video-skill` | Grounded claims, talent consent, regulated-category review, Seedance 2.0 multimodal rules |
| `fashion-lookbook` | `hiapi-fashion-lookbook-video-skill` | Person/garment/style roles, asset rights and person consent, Kling vs Seedance routing |
| `food-commercial` | `hiapi-food-commercial-video-skill` | Food recipes, hero/reference routes, allergen/nutrition/health claim review |
| `product-spokesperson` | `hiapi-product-spokesperson-video-skill` | Synthetic spokesperson vs authorized talking head, consent, dialogue and lip-sync QC |

## Non-goals

- No GitHub repository creation, rename, archive, or deletion.
- No automatic provider or model selection beyond an adapter's documented
  route table.
- No removal of the old `npx github:...` installation commands.
- No shared prompt that weakens a scenario's rights, consent, claims, or
  regulated-content gate.

See [`docs/compatibility.md`](docs/compatibility.md) for the migration plan
and [`docs/hiapi-skills-catalog-extension.md`](docs/hiapi-skills-catalog-extension.md)
for the directory manifest changes needed in `hiapi-skills`.
