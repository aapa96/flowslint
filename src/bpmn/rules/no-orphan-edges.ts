import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

export const noOrphanEdges: LintRule<BpmnDiagram> = {
  id: "bpmn/no-orphan-edges",
  description: "Every edge must reference valid source and target nodes.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const ids = new Set(nodes.map((n) => n.id));
    return edges
      .filter((e) => !ids.has(e.source) || !ids.has(e.target))
      .map((e) => ({
        ruleId: "bpmn/no-orphan-edges",
        severity: "error" as const,
        message: `Edge "${e.id}" references a node that does not exist.`,
        elementId: e.id,
      }));
  },
};
