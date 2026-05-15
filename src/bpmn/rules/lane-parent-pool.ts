import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

export const laneParentPool: LintRule<BpmnDiagram> = {
  id: "bpmn/lane-parent-pool",
  description: "A Lane must be directly contained by a Pool.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    return nodes
      .filter((n) => n.type === "Lane")
      .filter((n) => {
        if (!n.parentId) return true;
        const parent = nodeById.get(n.parentId);
        return !parent || parent.type !== "Pool";
      })
      .map((n) => ({
        ruleId: "bpmn/lane-parent-pool",
        severity: "error" as const,
        message: `Lane "${n.name ?? n.id}" must be directly contained by a Pool.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
