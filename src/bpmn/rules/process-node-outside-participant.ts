import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";
import { FLOW_NODE_TYPES } from "../types";

export const processNodeOutsideParticipant: LintRule<BpmnDiagram> = {
  id: "bpmn/process-node-outside-participant",
  description: "In a collaboration diagram (one or more Pools present), flow nodes should be placed inside a participant.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const hasPools = nodes.some((n) => n.type === "Pool");
    if (!hasPools) return [];

    return nodes
      .filter(
        (n) =>
          !n.parentId &&
          FLOW_NODE_TYPES.has(n.type) &&
          n.type !== "BoundaryEvent",
      )
      .map((n) => ({
        ruleId: "bpmn/process-node-outside-participant",
        severity: "warning" as const,
        message: `Flow node "${n.name ?? n.id}" is outside any pool. In a collaboration, place it inside a participant.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
