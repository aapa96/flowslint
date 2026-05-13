import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";
import { poolAncestor } from "../types";

export const messageFlowValidEndpoints: LintRule<BpmnDiagram> = {
  id: "bpmn/message-flow-valid-endpoints",
  description: "A MessageFlow must connect elements in distinct pools.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const messageFlows = edges.filter((e) => e.type === "messageFlow");

    return messageFlows.flatMap((e) => {
      const sourceNode = nodeById.get(e.source);
      const targetNode = nodeById.get(e.target);
      if (!sourceNode || !targetNode) return [];

      const sourcePool = poolAncestor(sourceNode, nodeById);
      const targetPool = poolAncestor(targetNode, nodeById);

      // Both must be in a pool and in different pools
      if (sourcePool && targetPool && sourcePool.id === targetPool.id) {
        return [
          {
            ruleId: "bpmn/message-flow-valid-endpoints",
            severity: "error" as const,
            message: `MessageFlow "${e.id}" connects two elements within the same pool "${sourcePool.name ?? sourcePool.id}".`,
            elementId: e.id,
          },
        ];
      }

      // If one endpoint has no pool, source and target are in the same (global) process scope
      if (!sourcePool && !targetPool) {
        return [
          {
            ruleId: "bpmn/message-flow-valid-endpoints",
            severity: "error" as const,
            message: `MessageFlow "${e.id}" connects two elements with no pool — message flows must cross pool boundaries.`,
            elementId: e.id,
          },
        ];
      }

      return [];
    });
  },
};
