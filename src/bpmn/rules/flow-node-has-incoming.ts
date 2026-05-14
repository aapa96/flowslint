import type { LintRule } from "../../core/types";
import type { BpmnDiagram, BpmnNode } from "../types";
import { isSubProcessLike, isTask } from "../types";

const EXEMPT: Set<BpmnNode["type"]> = new Set([
  "StartEvent",
  "BoundaryEvent",
  "EventSubProcess",
]);

function shouldHaveIncoming(node: BpmnNode): boolean {
  return (
    isTask(node) ||
    isSubProcessLike(node) ||
    node.type === "ChoreographyTask" ||
    node.type === "SubChoreography" ||
    node.type === "CallChoreography"
  ) && !EXEMPT.has(node.type);
}

export const flowNodeHasIncoming: LintRule<BpmnDiagram> = {
  id: "bpmn/flow-node-has-incoming",
  description: "Flow nodes should have an incoming sequence flow unless BPMN defines them as entry points.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const incoming = new Set<string>();
    for (const edge of edges) {
      if (edge.type === "sequenceFlow") incoming.add(edge.target);
    }

    return nodes
      .filter((node) => shouldHaveIncoming(node) && !incoming.has(node.id))
      .map((node) => ({
        ruleId: "bpmn/flow-node-has-incoming",
        severity: "error" as const,
        message: `"${node.name ?? node.id}" (${node.type}) has no incoming sequence flow.`,
        elementId: node.id,
        elementType: node.type,
      }));
  },
};
