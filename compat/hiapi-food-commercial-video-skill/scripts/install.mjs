#!/usr/bin/env node
import { runLegacyInstaller } from "../../legacy-install.mjs";
runLegacyInstaller({ repository: "hiapi-food-commercial-video-skill", adapterId: "food-commercial", installFolder: "hiapi-food-commercial-video", displayName: "HiAPI Food Commercial Video Skill" }).catch((error) => { console.error(`[HiAPI Food Commercial Video Skill] Failed: ${error?.message ?? error}`); process.exitCode = 1; });
