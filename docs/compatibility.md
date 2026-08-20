# Compatibility and Migration Draft

The old repositories are Git-based installers, not registry aliases. A GitHub
rename only redirects browser URLs; it does not make
`npx -y github:old-repository -y` install the new monorepo. Each old repository
therefore needs a compatibility commit before it is archived.

## Legacy mapping

| Old repository | New adapter | Legacy package/bin | Legacy installed Skill folder/name |
| --- | --- | --- | --- |
| `hiapi-seedance-2-0-ugc-ad-video-skill` | `skills/ugc-ad` | `hiapi-seedance-2-0-ugc-ad-video-skill` | `hiapi-seedance-2-0-ugc-ad-video-skill` |
| `hiapi-fashion-lookbook-video-skill` | `skills/fashion-lookbook` | `hiapi-fashion-lookbook-video-skill` | `hiapi-fashion-lookbook-video` |
| `hiapi-food-commercial-video-skill` | `skills/food-commercial` | `hiapi-food-commercial-video-skill` | `hiapi-food-commercial-video` |
| `hiapi-product-spokesperson-video-skill` | `skills/product-spokesperson` | `hiapi-product-spokesperson-video-skill` | `hiapi-product-spokesperson-video` |

The exact old install commands are recorded in `manifest.json` under
`adapters[].legacy.installCommand`. They remain valid during the compatibility
window. The future monorepo command is recorded as `targetCommand` with an
explicit adapter ID, so it installs the same focused Skill as the old command.
It is not a replacement until the shared runner and the adapter parity fixtures
are released. Do not publish a README that tells users to rely on a GitHub rename
or silently rewrites an old `npx github:<repo>` command.

Each adapter also has an explicit `aliases` object. These are stable lookup
identifiers, not redirects: `skill`, `package`, and `bin` aliases must continue
to resolve to the same adapter and preserve the old install folder until the
compatibility window ends.

## Compatibility repository shape

The unified repository now ships a reference wrapper under `compat/<old-repo>`
with this shape:

```text
package.json             # old private package name and version line
SKILL.md                 # old frontmatter name, with migration notice
llms-install.md          # old npx command plus new command
scripts/install.mjs      # old flags; stages/copies the new adapter
scripts/legacy-cli.mjs   # forwards old CLI flags to the adapter
tests/compatibility.test.mjs
```

The wrapper source uses a staged copy and atomic directory swap. It preserves
`.env`, `.env.*`, and `outputs/` from an existing install, and restores the old
directory if cloning or copying the new adapter fails. The four reference
wrappers are exercised by `tests/monorepo-installer.test.mjs`; the old GitHub
repositories must receive the same files before they are archived.

The wrapper must preserve old flags and output JSON fields. It may clone a
tagged monorepo release, copy the adapter into the old Skill folder, and then
execute the adapter's CLI. It must stage before replacing an existing install,
preserve a user's `.env`, and roll back when the clone or copy fails.

Do not make old wrappers silently install a different model, relax a rights or
consent gate, or change the meaning of `--dry-run`/`--spend`.

## Minimum wrapper test contract

Every old repository must add `tests/compatibility.test.mjs` before it is
archive-ready. The test may use a mock runner and a local fixture; it must not
call a paid provider. The minimum cases are:

| Case | Required assertion |
| --- | --- |
| `--preview` | exits 0, makes no network request, creates no task, and emits the normalized adapter/brief when JSON output is requested |
| `--dry-run` | performs at most one public-price lookup, emits a redacted payload and stable `request_hash`, and creates no task |
| `--spend` | accepts only the matching approved `request_hash`; creates one task and returns `task_id` plus `status` |
| retry after unknown POST outcome | reuses the same idempotency key and never submits a second task |
| `--resume <task-id>` | performs no create-task POST and returns the existing terminal status/artifact metadata |
| failed install/update | exits non-zero, leaves the previous Skill folder intact, and preserves `.env` |
| policy gate | missing rights, consent, or claims approval fails before pricing/task creation |

For JSON mode, wrappers must retain the legacy field names used by their
current CLI. At minimum, the fixture records `status`, `adapter`,
`request_hash` (dry-run/spend), `task_id` (spend/resume when available), and a
machine-readable `error.code` on failure. A compatibility test must assert
that API keys, embedded media, and full claim/consent evidence are absent from
stdout and persisted redacted artifacts.

## Compatibility window

Keep the wrappers and old URLs live for at least 6--12 months after the new
monorepo has a tagged release and the old install command has been tested on
Codex, Claude Code, OpenClaw, and a generic `AGENT_SKILLS_DIR`. Archive old
repositories only after README links, manifest aliases, and install tests pass.
