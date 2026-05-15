import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

function triggerOf(node: BpmnDiagram["nodes"][number]): string | undefined {
  return node.eventDefinition?.type ?? node.trigger;
}

export const eventDefinitionRefRequired: LintRule<BpmnDiagram> = {
  id: "bpmn/event-definition-ref-required",
  description: "Message, signal, error, and escalation events must reference a declared definition via the appropriate ref field.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const issues = [];

    for (const node of nodes) {
      const trigger = triggerOf(node);

      if (trigger === "message" && !node.eventDefinition?.messageRef) {
        issues.push({
          ruleId: "bpmn/event-definition-ref-required",
          severity: "warning" as const,
          message: `Message event "${node.name ?? node.id}" must set a message reference.`,
          elementId: node.id,
          elementType: node.type,
        });
      }
      if (trigger === "signal" && !node.eventDefinition?.signalRef) {
        issues.push({
          ruleId: "bpmn/event-definition-ref-required",
          severity: "warning" as const,
          message: `Signal event "${node.name ?? node.id}" must set a signal reference.`,
          elementId: node.id,
          elementType: node.type,
        });
      }
      if (trigger === "error" && !node.eventDefinition?.errorRef) {
        issues.push({
          ruleId: "bpmn/event-definition-ref-required",
          severity: "warning" as const,
          message: `Error event "${node.name ?? node.id}" must set an error reference.`,
          elementId: node.id,
          elementType: node.type,
        });
      }
      if (trigger === "escalation" && !node.eventDefinition?.escalationRef) {
        issues.push({
          ruleId: "bpmn/event-definition-ref-required",
          severity: "warning" as const,
          message: `Escalation event "${node.name ?? node.id}" must set an escalation reference.`,
          elementId: node.id,
          elementType: node.type,
        });
      }
    }

    return issues;
  },
};
