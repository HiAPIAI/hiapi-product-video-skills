#!/usr/bin/env node
import { runLegacyInstaller } from "../../legacy-install.mjs";
runLegacyInstaller({ repository: "hiapi-product-spokesperson-video-skill", adapterId: "product-spokesperson", installFolder: "hiapi-product-spokesperson-video", displayName: "HiAPI Product Spokesperson Video Skill" }).catch((error) => { console.error(`[HiAPI Product Spokesperson Video Skill] Failed: ${error?.message ?? error}`); process.exitCode = 1; });
