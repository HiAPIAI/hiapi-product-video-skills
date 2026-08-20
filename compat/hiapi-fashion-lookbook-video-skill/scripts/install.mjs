#!/usr/bin/env node
import { runLegacyInstaller } from "../../legacy-install.mjs";
runLegacyInstaller({ repository: "hiapi-fashion-lookbook-video-skill", adapterId: "fashion-lookbook", installFolder: "hiapi-fashion-lookbook-video", displayName: "HiAPI Fashion Lookbook Video Skill" }).catch((error) => { console.error(`[HiAPI Fashion Lookbook Video Skill] Failed: ${error?.message ?? error}`); process.exitCode = 1; });
