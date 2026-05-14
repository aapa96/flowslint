import type { LintRule } from "../../core/types";
import type { BpmnDiagram, BpmnNode } from "../types";
import { isContainer } from "../types";

const EXEMPT: Set<BpmnNode["type"]> = new Set([
  "Pool", "Lane", "Annotation", "Group",
  "DataObject", "DataStore",
]);

export const noDisconnectedNodes: LintRule<BpmnDiagram> = {
  id: "bpmn/no-disconnected-nodes",
  description: "Every flow node must have at least one sequence flow connection.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const connected = new Set<string>();
    for (const e of edges) {
      if (e.type === "sequenceFlow") {
        connected.add(e.source);
        connected.add(e.target);
      }
    }
    return nodes
      .filter((n) => !EXEMPT.has(n.type) && !isContainer(n) && !connected.has(n.id))
      .map((n) => ({
        ruleId: "bpmn/no-disconnected-nodes",
        severity: "warning" as const,
        message: `"${n.name ?? n.id}" (${n.type}) has no sequence flow connections.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
