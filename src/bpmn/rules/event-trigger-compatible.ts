import type { LintRule } from "../../core/types";
import type { BpmnDiagram, EventTrigger, BpmnNodeType } from "../types";

function triggerOf(node: BpmnDiagram["nodes"][number]): EventTrigger | undefined {
  return node.eventDefinition?.type ?? node.trigger;
}

const ALLOWED_TRIGGERS: Record<
  Extract<BpmnNodeType, "StartEvent" | "EndEvent" | "IntermediateCatchEvent" | "IntermediateThrowEvent" | "BoundaryEvent">,
  Set<EventTrigger>
> = {
  StartEvent: new Set(["none", "message", "timer", "conditional", "signal", "multiple", "parallelMultiple"]),
  EndEvent: new Set(["none", "message", "signal", "error", "escalation", "terminate", "compensation", "cancel", "multiple"]),
  IntermediateCatchEvent: new Set(["none", "message", "timer", "conditional", "signal", "link", "multiple", "parallelMultiple"]),
  IntermediateThrowEvent: new Set(["none", "message", "signal", "link", "escalation", "compensation", "multiple"]),
  BoundaryEvent: new Set(["message", "timer", "conditional", "signal", "error", "escalation", "cancel", "compensation"]),
};

export const eventTriggerCompatible: LintRule<BpmnDiagram> = {
  id: "bpmn/event-trigger-compatible",
  description: "Each BPMN event base type only allows a subset of triggers.",
  defaultSeverity: "error",
  check({ nodes }) {
    const issues = [];

    for (const node of nodes) {
      if (
        node.type !== "StartEvent" &&
        node.type !== "EndEvent" &&
        node.type !== "IntermediateCatchEvent" &&
        node.type !== "IntermediateThrowEvent" &&
        node.type !== "BoundaryEvent"
      ) {
        continue;
      }

      const trigger = triggerOf(node);
      if (!trigger) continue;

      if (!ALLOWED_TRIGGERS[node.type].has(trigger)) {
        issues.push({
          ruleId: "bpmn/event-trigger-compatible",
          severity: "error" as const,
          message: `El evento "${node.name ?? node.id}" (${node.type}) no admite el trigger "${trigger}". Revisa el subtipo BPMN seleccionado.`,
          elementId: node.id,
          elementType: node.type,
        });
      }
    }

    return issues;
  },
};
