import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

function triggerOf(node: BpmnDiagram["nodes"][number]) {
  return node.eventDefinition?.type ?? node.trigger;
}

const NON_INTERRUPTIBLE_BOUNDARY_TRIGGERS = new Set([
  "error",
  "cancel",
  "compensation",
]);

export const boundaryNonInterruptingCompatible: LintRule<BpmnDiagram> = {
  id: "bpmn/boundary-non-interrupting-compatible",
  description: "Non-interrupting boundary events are not valid for error, cancel, or compensation triggers.",
  defaultSeverity: "error",
  check({ nodes }) {
    return nodes
      .filter((node) => node.type === "BoundaryEvent" && node.isNonInterrupting === true)
      .filter((node) => NON_INTERRUPTIBLE_BOUNDARY_TRIGGERS.has(triggerOf(node) ?? ""))
      .map((node) => ({
        ruleId: "bpmn/boundary-non-interrupting-compatible",
        severity: "error" as const,
        message: `El boundary event "${node.name ?? node.id}" no puede ser no interruptivo cuando usa trigger "${triggerOf(node)}".`,
        elementId: node.id,
        elementType: node.type,
      }));
  },
};
