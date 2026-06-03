import { runRules } from "../core/runner";
import type { LintConfig, LintPreset, LintResult, LintRule } from "../core/types";
import type { LintEventBus } from "../core/events";
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
import { flowNodeHasIncoming } from "./rules/flow-node-has-incoming";
import { flowNodeHasOutgoing } from "./rules/flow-node-has-outgoing";
import { eventBasedGatewayMinOutgoing } from "./rules/event-based-gateway-min-outgoing";
import { eventBasedGatewayValidTargets } from "./rules/event-based-gateway-valid-targets";
import { endEventReachable, reachableFromStart } from "./rules/reachable-from-start";
import { sequenceFlowNoCrossPool } from "./rules/sequence-flow-no-cross-pool";
import { boundaryEventAttached } from "./rules/boundary-event-attached";
import { subprocessHasStartEnd } from "./rules/subprocess-has-start-end";
import { linkEventPair } from "./rules/link-event-pair";
import { cancelOnlyInTransaction } from "./rules/cancel-only-in-transaction";
import { choreographyHasParticipants } from "./rules/choreography-has-participants";
import { laneParentPool } from "./rules/lane-parent-pool";
import { boundaryNoIncoming } from "./rules/boundary-no-incoming";
import { eventDefinitionRefRequired } from "./rules/event-definition-ref-required";
import { eventTriggerCompatible } from "./rules/event-trigger-compatible";
import { eventSubprocessStartCompatible } from "./rules/event-subprocess-start-compatible";
import { gatewaySingleDefault } from "./rules/gateway-single-default";
import { boundaryNonInterruptingCompatible } from "./rules/boundary-non-interrupting-compatible";

// ── Warnings: best practices ───────────────────────────────────────────────────
import { poolChildrenInsideLanes } from "./rules/pool-children-inside-lanes";
import { processNodeOutsideParticipant } from "./rules/process-node-outside-participant";
import { boundaryHasOutgoing } from "./rules/boundary-has-outgoing";
import { scopeSingleStart } from "./rules/scope-single-start";
import { noDisconnectedNodes } from "./rules/no-disconnected-nodes";
import { noImplicitSplit } from "./rules/no-implicit-split";
import { noImplicitJoin } from "./rules/no-implicit-join";
import { noMultipleStartEvents } from "./rules/no-multiple-start-events";
import { noEmptyPool } from "./rules/no-empty-pool";
import { taskHasName } from "./rules/task-has-name";
import { gatewayHasName } from "./rules/gateway-has-name";
import { exclusiveGatewayCondition } from "./rules/exclusive-gateway-condition";

// ── Info: informational hints ──────────────────────────────────────────────────
import { cyclomaticComplexity } from "./rules/cyclomatic-complexity";
import { longProcess } from "./rules/long-process";
import { annotationHasText } from "./rules/annotation-has-text";
import { noDuplicateSequenceFlow } from "./rules/no-duplicate-sequence-flow";
import { messageFlowValidEndpoints } from "./rules/message-flow-valid-endpoints";
import { compensationFlowTarget } from "./rules/compensation-flow-target";
import { dataObjectConnected } from "./rules/data-object-connected";
import { dataReferenceTargetExists } from "./rules/data-reference-target-exists";
import { sequenceFlowValidEndpoints } from "./rules/sequence-flow-valid-endpoints";
import { dataAssociationValidEndpoints } from "./rules/data-association-valid-endpoints";
import { eventDefinitionPayloadRequired } from "./rules/event-definition-payload-required";
import { eventDefinitionRefDeclared } from "./rules/event-definition-ref-declared";

// ── AranzaFlows extensions ─────────────────────────────────────────────────────
import { taskHasOwner } from "./rules/aranza/task-has-owner";
import { criticalTaskHasSla } from "./rules/aranza/critical-task-has-sla";
import { slaFormat } from "./rules/aranza/sla-format";
import { automatableTaskAction } from "./rules/aranza/automatable-task-action";
import { serviceTaskConfig } from "./rules/aranza/service-task-config";
import { adhocHasCompletionCondition } from "./rules/aranza/adhoc-has-completion-condition";
import { userTaskHasForm } from "./rules/aranza/user-task-has-form";
import { userTaskHasDueDate } from "./rules/aranza/user-task-has-due-date";
import { userTaskHasAssignment } from "./rules/aranza/user-task-has-assignment";
import { multiInstanceHasCardinality } from "./rules/aranza/multi-instance-has-cardinality";
import { businessRuleTaskHasDecision } from "./rules/aranza/business-rule-task-has-decision";
import { callActivityHasCalledElement } from "./rules/aranza/call-activity-has-called-element";
import { callActivityCalledElementFormat } from "./rules/aranza/call-activity-called-element-format";
import { receiveTaskMessageContext } from "./rules/aranza/receive-task-message-context";
import { sendTaskMessageContext } from "./rules/aranza/send-task-message-context";
import { scriptTaskHasFormat } from "./rules/aranza/script-task-has-format";
import { scriptTaskHasScript } from "./rules/aranza/script-task-has-script";
import { variableExists } from "./rules/aranza/variable-exists";

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
  flowNodeHasIncoming,
  flowNodeHasOutgoing,
  eventBasedGatewayMinOutgoing,
  eventBasedGatewayValidTargets,
  endEventReachable,
  sequenceFlowNoCrossPool,
  boundaryEventAttached,
  subprocessHasStartEnd,
  linkEventPair,
  cancelOnlyInTransaction,
  choreographyHasParticipants,
  laneParentPool,
  boundaryNoIncoming,
  boundaryNonInterruptingCompatible,
  eventSubprocessStartCompatible,
  gatewaySingleDefault,
  noDuplicateSequenceFlow,
  messageFlowValidEndpoints,
  sequenceFlowValidEndpoints,
  dataAssociationValidEndpoints,
  eventDefinitionRefDeclared,
  eventTriggerCompatible,
  // Best-practice warnings
  poolChildrenInsideLanes,
  processNodeOutsideParticipant,
  boundaryHasOutgoing,
  scopeSingleStart,
  noDisconnectedNodes,
  reachableFromStart,
  noImplicitSplit,
  noImplicitJoin,
  noMultipleStartEvents,
  noEmptyPool,
  taskHasName,
  gatewayHasName,
  exclusiveGatewayCondition,
  compensationFlowTarget,
  eventDefinitionPayloadRequired,
  eventDefinitionRefRequired,
  // Informational hints
  cyclomaticComplexity,
  longProcess,
  annotationHasText,
  dataObjectConnected,
  dataReferenceTargetExists,
  // AranzaFlows extensions
  taskHasOwner,
  criticalTaskHasSla,
  slaFormat,
  automatableTaskAction,
  serviceTaskConfig,
  adhocHasCompletionCondition,
  userTaskHasForm,
  userTaskHasDueDate,
  userTaskHasAssignment,
  multiInstanceHasCardinality,
  businessRuleTaskHasDecision,
  callActivityHasCalledElement,
  callActivityCalledElementFormat,
  receiveTaskMessageContext,
  sendTaskMessageContext,
  scriptTaskHasFormat,
  scriptTaskHasScript,
  variableExists,
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
    "bpmn/data-reference-target-exists": "warning",
    "bpmn/aranza/task-has-owner": "error",
    "bpmn/aranza/critical-task-has-sla": "error",
    "bpmn/aranza/service-task-config": "error",
    "bpmn/aranza/automatable-task-action": "warning",
    "bpmn/aranza/call-activity-has-called-element": "error",
    "bpmn/aranza/call-activity-called-element-format": "warning",
    "bpmn/aranza/receive-task-message-context": "info",
    "bpmn/aranza/send-task-message-context": "info",
    "bpmn/aranza/business-rule-task-has-decision": "error",
    "bpmn/aranza/script-task-has-format": "warning",
    "bpmn/aranza/script-task-has-script": "warning",
    "bpmn/aranza/user-task-has-assignment": "info",
    "bpmn/aranza/multi-instance-has-cardinality": "warning",
    "bpmn/aranza/user-task-has-due-date": "info",
    "bpmn/aranza/variable-exists": "warning",
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
    "bpmn/data-reference-target-exists": "off",
    "bpmn/no-disconnected-nodes": "info",
    "bpmn/no-multiple-start-events": "info",
    "bpmn/aranza/task-has-owner": "off",
    "bpmn/aranza/critical-task-has-sla": "off",
    "bpmn/aranza/automatable-task-action": "off",
    "bpmn/aranza/service-task-config": "off",
    "bpmn/aranza/adhoc-has-completion-condition": "off",
    "bpmn/aranza/user-task-has-due-date": "off",
    "bpmn/aranza/multi-instance-has-cardinality": "off",
    "bpmn/aranza/business-rule-task-has-decision": "off",
    "bpmn/aranza/call-activity-has-called-element": "off",
    "bpmn/aranza/call-activity-called-element-format": "off",
    "bpmn/aranza/receive-task-message-context": "off",
    "bpmn/aranza/send-task-message-context": "off",
    "bpmn/aranza/script-task-has-format": "off",
    "bpmn/aranza/script-task-has-script": "off",
    "bpmn/aranza/user-task-has-assignment": "off",
    "bpmn/aranza/variable-exists": "off",
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
  /** Optional event bus for streaming rule-by-rule feedback. */
  bus?: LintEventBus;
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
  return runRules(diagram, BPMN_RULES, merged, { ...(config.bus !== undefined ? { bus: config.bus } : {}) });
}
