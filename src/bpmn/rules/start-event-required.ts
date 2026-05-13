import type { LintRule } from "../../core/types";
import type { BpmnNode, BpmnDiagram } from "../types";

function isInsideSubProcess(n: BpmnNode, nodeById: Map<string, BpmnNode>): boolean {
  if (!n.parentId) return false;
  const parent = nodeById.get(n.parentId);
  if (!parent) return false;
  return parent.type === "SubProcess" ? true : isInsideSubProcess(parent, nodeById);
}

export const startEventRequired: LintRule<BpmnDiagram> = {
  id: "bpmn/start-event-required",
  description: "Every process scope must have at least one start event.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const pools = nodes.filter((n) => n.type === "Pool");

    // Diagram with no pools — check global process scope
    if (pools.length === 0) {
      const hasStart = nodes.some(
        (n) => n.type === "StartEvent" && !isInsideSubProcess(n, nodeById),
      );
      return hasStart
        ? []
        : [{ ruleId: "bpmn/start-event-required", severity: "error", message: "The process has no start event." }];
    }

    // Diagram with pools — each pool is a separate process scope
    const issues = [];
    for (const pool of pools) {
      const laneIds = new Set(nodes.filter((n) => n.type === "Lane" && n.parentId === pool.id).map((n) => n.id));
      const inPool = (n: BpmnNode) =>
        n.parentId === pool.id || (n.parentId !== undefined && laneIds.has(n.parentId));

      const hasStart = nodes.some(
        (n) => n.type === "StartEvent" && inPool(n) && !isInsideSubProcess(n, nodeById),
      );
      if (!hasStart) {
        issues.push({
          ruleId: "bpmn/start-event-required",
          severity: "error" as const,
          message: `Pool "${pool.name ?? pool.id}" has no start event.`,
          elementId: pool.id,
          elementType: pool.type,
        });
      }
    }
    return issues;
  },
};
