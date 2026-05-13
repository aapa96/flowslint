import type { LintRule } from "../../core/types";
import type { BpmnNode, BpmnDiagram } from "../types";

function isInsideSubProcess(n: BpmnNode, nodeById: Map<string, BpmnNode>): boolean {
  if (!n.parentId) return false;
  const parent = nodeById.get(n.parentId);
  if (!parent) return false;
  return parent.type === "SubProcess" ? true : isInsideSubProcess(parent, nodeById);
}

export const noMultipleStartEvents: LintRule<BpmnDiagram> = {
  id: "bpmn/no-multiple-start-events",
  description: "A process scope should have at most one start event.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const pools = nodes.filter((n) => n.type === "Pool");
    const issues = [];

    // Group start events by process scope (pool, or global if no pools)
    if (pools.length === 0) {
      const starts = nodes.filter(
        (n) => n.type === "StartEvent" && !isInsideSubProcess(n, nodeById),
      );
      if (starts.length > 1) {
        for (const n of starts) {
          issues.push({
            ruleId: "bpmn/no-multiple-start-events",
            severity: "warning" as const,
            message: `The process has ${starts.length} start events at process level. Consider consolidating into one.`,
            elementId: n.id,
            elementType: n.type,
          });
        }
      }
      return issues;
    }

    for (const pool of pools) {
      const laneIds = new Set(nodes.filter((n) => n.type === "Lane" && n.parentId === pool.id).map((n) => n.id));
      const inPool = (n: BpmnNode) =>
        n.parentId === pool.id || (n.parentId !== undefined && laneIds.has(n.parentId));

      const starts = nodes.filter(
        (n) => n.type === "StartEvent" && inPool(n) && !isInsideSubProcess(n, nodeById),
      );
      if (starts.length > 1) {
        for (const n of starts) {
          issues.push({
            ruleId: "bpmn/no-multiple-start-events",
            severity: "warning" as const,
            message: `Pool "${pool.name ?? pool.id}" has ${starts.length} start events. Consider consolidating into one.`,
            elementId: n.id,
            elementType: n.type,
          });
        }
      }
    }
    return issues;
  },
};
