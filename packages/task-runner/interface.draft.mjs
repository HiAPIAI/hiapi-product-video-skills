// Contract-only draft. This file intentionally has no network or filesystem
// implementation and must not be imported by the existing Skills yet.

/**
 * @typedef {Object} NormalizedRequest
 * @property {string} adapter
 * @property {string} model
 * @property {Object} input
 * @property {Object|undefined} route
 * @property {Object} output
 * @property {Object} rights
 * @property {Object} claims
 */

/**
 * @typedef {Object} ScenarioAdapter
 * @property {string} id
 * @property {(argv: string[]) => Object} parseArgs
 * @property {(brief: Object) => void} validateBrief
 * @property {(brief: Object) => Promise<NormalizedRequest>} buildRequest
 * @property {(request: NormalizedRequest, pricing: Object) => Object} estimateInput
 * @property {(request: NormalizedRequest) => Object} redactPayload
 * @property {Object} artifactPolicy
 * @property {Object} qcChecklist
 */

/**
 * @typedef {Object} TaskRunner
 * @property {(adapter: ScenarioAdapter, argv: string[]) => Promise<Object>} preview
 * @property {(adapter: ScenarioAdapter, argv: string[]) => Promise<Object>} dryRun
 * @property {(adapter: ScenarioAdapter, argv: string[]) => Promise<Object>} spend
 * @property {(taskId: string, options: Object) => Promise<Object>} resume
 */

export const CONTRACT_VERSION = 1;

export function assertContractOnly() {
  return {
    contractVersion: CONTRACT_VERSION,
    implementation: "pending",
    note: "Implement after parity fixtures pass for all four legacy CLIs.",
  };
}
