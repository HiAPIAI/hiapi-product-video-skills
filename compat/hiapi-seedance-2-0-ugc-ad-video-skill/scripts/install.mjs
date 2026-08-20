#!/usr/bin/env node
import { runLegacyInstaller } from "../../legacy-install.mjs";
runLegacyInstaller({ repository: "hiapi-seedance-2-0-ugc-ad-video-skill", adapterId: "ugc-ad", installFolder: "hiapi-seedance-2-0-ugc-ad-video-skill", displayName: "HiAPI Seedance 2.0 UGC Ad Video Skill" }).catch((error) => { console.error(`[HiAPI Seedance 2.0 UGC Ad Video Skill] Failed: ${error?.message ?? error}`); process.exitCode = 1; });
