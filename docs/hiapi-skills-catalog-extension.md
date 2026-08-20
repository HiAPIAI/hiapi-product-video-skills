# `hiapi-skills` Catalog Extension Draft

The current catalog treats every entry as a single installable model Skill.
That cannot represent scene adapters, compatibility repositories, bundles, or
SDKs. Add a discriminated `kind` and explicit source/compatibility fields.

```json
{
  "id": "hiapi-fashion-lookbook-video",
  "kind": "scene",
  "version": "0.2.0",
  "repository": "https://github.com/HiAPIAI/hiapi-product-video-skills",
  "source": "skills/fashion-lookbook",
  "skillName": "hiapi-fashion-lookbook-video",
  "installFolder": "hiapi-fashion-lookbook-video",
  "package": "@hiapi/product-video-skills",
  "models": ["kling-3.0-omni/*", "seedance-2.0-fast"],
  "capabilities": ["lookbook", "outfit-transition", "person-consent"],
  "aliases": {
    "adapter": ["fashion-lookbook"],
    "skill": ["hiapi-fashion-lookbook-video"],
    "package": ["hiapi-fashion-lookbook-video-skill"],
    "bin": ["hiapi-fashion-lookbook-video-skill"]
  },
  "legacy": [
    {
      "repository": "https://github.com/HiAPIAI/hiapi-fashion-lookbook-video-skill",
      "package": "hiapi-fashion-lookbook-video-skill",
      "bin": "hiapi-fashion-lookbook-video-skill",
      "installFolder": "hiapi-fashion-lookbook-video",
      "installCommand": "npx -y github:HiAPIAI/hiapi-fashion-lookbook-video-skill -y",
      "targetCommand": "npx -y github:HiAPIAI/hiapi-product-video-skills -y",
      "wrapper": {
        "status": "planned",
        "path": "compat/hiapi-fashion-lookbook-video-skill",
        "test": "tests/legacy-wrapper-contract.test.mjs"
      },
      "supportedUntil": "2027-08-20"
    }
  ],
  "updatePolicy": {
    "latestVersion": "0.2.0",
    "minimumVersion": "0.2.0",
    "updateCommand": "npx -y github:HiAPIAI/hiapi-product-video-skills -y"
  }
}
```

Recommended values:

- `executor`: one model-specific generation Skill;
- `prompt`: model-agnostic or prompt-only Skill;
- `scene`: a product/use-case adapter over one or more executors;
- `bundle`: an installer that installs multiple independent Skills;
- `sdk`: language package source and contract metadata.

## CI checks

The catalog validator should:

1. Check every repository URL and every `source` path in the monorepo.
2. Parse each source `package.json` and `SKILL.md`; require package version,
   bin, Skill frontmatter name, and install folder to agree with the catalog.
3. Require every legacy alias to have a migration README and the minimum
   wrapper test contract from `docs/compatibility.md` before an old repository
   is marked archive-ready.
4. Check that update commands reference the current source repository and that
   `latestVersion`/`minimumVersion` are valid semver.
5. Validate model IDs, adapter capabilities, and bundle `installs` entries.
6. Fail when a public organization repository is missing from the catalog or
   is referenced by README/install docs but absent from the catalog.

Do not use the catalog to silently redirect a legacy model ID. Keep an explicit
`aliases` field, preserve each old `npx github:<repo>` command during the
compatibility window, and test normalization at the adapter boundary.
