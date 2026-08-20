# Agent installation

Install the HiAPI Seedance 2.0 UGC Ad Video skill:

1. Run:

   ```bash
   npx -y github:HiAPIAI/hiapi-seedance-2-0-ugc-ad-video-skill -y
   ```

2. Set `HIAPI_API_KEY` in the environment that starts the agent. Create a key at:
   <https://www.hiapi.ai/en/dashboard/api-keys>
3. Read the installed `SKILL.md` completely before performing a UGC task.
4. Copy `assets/ugc-brief.example.json` into the user's task workspace and replace every demo value.
5. Run `scripts/validate-ugc-brief.mjs`.
6. Run `scripts/run-ugc-seedance.mjs ... --dry-run` and inspect the redacted payload.
7. Run a paid generation only when the user asked for an actual video and all likeness, claim, media, cost, and compliance gates pass.
8. Do not report completion from an accepted task ID. Verify the downloaded video, frames, and complete audio.

If the installer cannot detect an agent, pass `--codex`, `--claude`, or `--target=/absolute/path/to/skills`.

The installer also installs the adjacent `hiapi-seedance-2-0-video-skill` when it is missing. If that base skill is stored elsewhere, set `HIAPI_SEEDANCE_SKILL_DIR` to its absolute directory.
