import { runRules } from "../core/runner";
import type { LintConfig, LintPreset, LintResult, LintRule } from "../core/types";
import type { BpmnDiagram } from "./types";

// ── Errors: structural violations ─────────────────────────────────────────────
import { startEventRequired } from "./rules/start-event-required";
import { endEventRequired } from "./rules/end-event-required";
import { noOrphanEdges } from "./rules/no-orphan-edges";
import { noSelfLoop } from "./rules/no-self-loop";
import { noOutgoingFromEndEvent } from "./rules/no-outgoing-from-end-event";
import { startEventNoIncoming } from "./rules/start-event-no-incoming";
import { endEventHasIncoming } from "./rules/end-event-has-incoming";
import { intermediateEventBothFlows } from "./rules/intermediate-event-both-flows";
import { gatewayHasOutgoing } from "./rules/gateway-has-outgoing";
import { gatewayHasIncoming } from "./rules/gateway-has-incoming";
import { eventBasedGatewayMinOutgoing } from "./rules/event-based-gateway-min-outgoing";
import { eventBasedGatewayValidTargets } from "./rules/event-based-gateway-valid-targets";
import { sequenceFlowNoCrossPool } from "./rules/sequence-flow-no-cross-pool";
import { boundaryEventAttached } from "./rules/boundary-event-attached";
import { subprocessHasStartEnd } from "./rules/subprocess-has-start-end";
import { linkEventPair } from "./rules/link-event-pair";
import { cancelOnlyInTransaction } from "./rules/cancel-only-in-transaction";
import { choreographyHasParticipants } from "./rules/choreography-has-participants";

// ── Warnings: best practices ───────────────────────────────────────────────────
import { noDisconnectedNodes } from "./rules/no-disconnected-nodes";
import { noImplicitSplit } from "./rules/no-implicit-split";
import { noImplicitJoin } from "./rules/no-implicit-join";
import { noMultipleStartEvents } from "./rules/no-multiple-start-events";
import { noEmptyPool } from "./rules/no-empty-pool";
import { taskHasName } from "./rules/task-has-name";
import { gatewayHasName } from "./rules/gateway-has-name";
import { exclusiveGatewayCondition } from "./rules/exclusive-gateway-condition";

// ── Info: informational hints ──────────────────────────────────────────────────
import { annotationHasText } from "./rules/annotation-has-text";
import { noDuplicateSequenceFlow } from "./rules/no-duplicate-sequence-flow";
import { messageFlowValidEndpoints } from "./rules/message-flow-valid-endpoints";
import { compensationFlowTarget } from "./rules/compensation-flow-target";
import { dataObjectConnected } from "./rules/data-object-connected";
import { sequenceFlowValidEndpoints } from "./rules/sequence-flow-valid-endpoints";
import { dataAssociationValidEndpoints } from "./rules/data-association-valid-endpoints";

export const BPMN_RULES: LintRule<BpmnDiagram>[] = [
  // Structural errors
  startEventRequired,
  endEventRequired,
  noOrphanEdges,
  noSelfLoop,
  noOutgoingFromEndEvent,
  startEventNoIncoming,
  endEventHasIncoming,
  intermediateEventBothFlows,
  gatewayHasOutgoing,
  gatewayHasIncoming,
  eventBasedGatewayMinOutgoing,
  eventBasedGatewayValidTargets,
  sequenceFlowNoCrossPool,
  boundaryEventAttached,
  subprocessHasStartEnd,
  linkEventPair,
  cancelOnlyInTransaction,
  choreographyHasParticipants,
  noDuplicateSequenceFlow,
  messageFlowValidEndpoints,
  sequenceFlowValidEndpoints,
  dataAssociationValidEndpoints,
  // Best-practice warnings
  noDisconnectedNodes,
  noImplicitSplit,
  noImplicitJoin,
  noMultipleStartEvents,
  noEmptyPool,
  taskHasName,
  gatewayHasName,
  exclusiveGatewayCondition,
  compensationFlowTarget,
  // Informational hints
  annotationHasText,
  dataObjectConnected,
];

const DEFAULT_CONFIG: LintConfig = {
  rules: Object.fromEntries(BPMN_RULES.map((r) => [r.id, r.defaultSeverity])),
};

export const BPMN_RECOMMENDED_PRESET: LintPreset = {
  name: "recommended",
  description: "Balanced BPMN linting for active modeling.",
  rules: { ...DEFAULT_CONFIG.rules },
};

export const BPMN_STRICT_PRESET: LintPreset = {
  name: "strict",
  description: "Stricter BPMN linting for publish/export gates.",
  rules: {
    ...DEFAULT_CONFIG.rules,
    "bpmn/no-multiple-start-events": "error",
    "bpmn/task-has-name": "error",
    "bpmn/gateway-has-name": "warning",
    "bpmn/data-object-connected": "warning",
  },
};

export const BPMN_DESIGN_PRESET: LintPreset = {
  name: "design",
  description: "Softer BPMN hints while users are still sketching.",
  rules: {
    ...DEFAULT_CONFIG.rules,
    "bpmn/task-has-name": "info",
    "bpmn/gateway-has-name": "info",
    "bpmn/data-object-connected": "off",
    "bpmn/no-disconnected-nodes": "info",
    "bpmn/no-multiple-start-events": "info",
  },
};

export const BPMN_PRESETS = {
  recommended: BPMN_RECOMMENDED_PRESET,
  strict: BPMN_STRICT_PRESET,
  design: BPMN_DESIGN_PRESET,
};

export type BpmnLintPresetName = keyof typeof BPMN_PRESETS;

export interface BpmnLintConfig extends Partial<LintConfig> {
  preset?: BpmnLintPresetName | LintPreset;
}

function resolvePreset(config: BpmnLintConfig): LintPreset {
  if (!config.preset) return BPMN_RECOMMENDED_PRESET;
  if (typeof config.preset === "string") return BPMN_PRESETS[config.preset];
  return config.preset;
}

export function runBpmnLint(
  diagram: BpmnDiagram,
  config: BpmnLintConfig = {},
): LintResult {
  const preset = resolvePreset(config);
  const merged: LintConfig = {
    rules: { ...preset.rules, ...config.rules },
  };
  return runRules(diagram, BPMN_RULES, merged);
}
