import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";
import { isFlowNode } from "../types";

// A pool must contain at least one flow node (task, event, gateway).
// A pool that only has lanes but no flow nodes is an empty collaboration participant.

export const noEmptyPool: LintRule<BpmnDiagram> = {
  id: "bpmn/no-empty-pool",
  description: "A pool must contain at least one flow node.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const pools = nodes.filter((n) => n.type === "Pool");
    if (pools.length === 0) return [];

    // Collect all Lane IDs that belong to each pool (direct children)
    const lanesByPool = new Map<string, string[]>();
    for (const pool of pools) {
      lanesByPool.set(pool.id, nodes.filter((n) => n.type === "Lane" && n.parentId === pool.id).map((n) => n.id));
    }

    return pools
      .filter((pool) => {
        const laneIds = new Set(lanesByPool.get(pool.id) ?? []);
        // Flow nodes directly in the pool or in its lanes
        const hasFlowNode = nodes.some(
          (n) =>
            isFlowNode(n) &&
            (n.parentId === pool.id || (n.parentId !== undefined && laneIds.has(n.parentId))),
        );
        return !hasFlowNode;
      })
      .map((pool) => ({
        ruleId: "bpmn/no-empty-pool",
        severity: "warning" as const,
        message: `El pool "${pool.name ?? pool.id}" está vacío. Agrega al menos un evento de inicio, tarea o evento de fin.`,
        elementId: pool.id,
        elementType: pool.type,
      }));
  },
};
