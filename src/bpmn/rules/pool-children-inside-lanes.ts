import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";
import { FLOW_NODE_TYPES } from "../types";

export const poolChildrenInsideLanes: LintRule<BpmnDiagram> = {
  id: "bpmn/pool-children-inside-lanes",
  description: "When a Pool contains Lanes, all flow nodes should be placed inside a Lane.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const issues = [];
    const pools = nodes.filter((n) => n.type === "Pool");

    for (const pool of pools) {
      const directChildren = nodes.filter((n) => n.parentId === pool.id);
      const lanes = directChildren.filter((n) => n.type === "Lane");
      if (lanes.length === 0) continue;

      const looseFlowNodes = directChildren.filter(
        (n) => n.type !== "Lane" && FLOW_NODE_TYPES.has(n.type),
      );
      if (looseFlowNodes.length > 0) {
        issues.push({
          ruleId: "bpmn/pool-children-inside-lanes",
          severity: "warning" as const,
          message: `Pool "${pool.name ?? pool.id}" has lanes; place flow nodes inside a lane instead of directly in the pool.`,
          elementId: pool.id,
          elementType: pool.type,
        });
      }
    }
    return issues;
  },
};
