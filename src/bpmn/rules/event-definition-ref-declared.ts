import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

function triggerOf(node: BpmnDiagram["nodes"][number]): string | undefined {
  return node.eventDefinition?.type ?? node.trigger;
}

export const eventDefinitionRefDeclared: LintRule<BpmnDiagram> = {
  id: "bpmn/event-definition-ref-declared",
  description: "Message, signal, error, and escalation event references should point to declared global definitions.",
  defaultSeverity: "error",
  check({ nodes, definitions }) {
    const messageIds = new Set((definitions?.messages ?? []).map((item) => item.id));
    const signalIds = new Set((definitions?.signals ?? []).map((item) => item.id));
    const errorIds = new Set((definitions?.errors ?? []).map((item) => item.id));
    const escalationIds = new Set((definitions?.escalations ?? []).map((item) => item.id));
    const issues = [];

    for (const node of nodes) {
      const trigger = triggerOf(node);
      if (trigger === "message") {
        const ref = node.eventDefinition?.messageRef;
        if (ref && messageIds.size > 0 && !messageIds.has(ref)) {
          issues.push({
            ruleId: "bpmn/event-definition-ref-declared",
            severity: "error" as const,
            message: `Message event "${node.name ?? node.id}" references undeclared message "${ref}".`,
            elementId: node.id,
            elementType: node.type,
          });
        }
      }
      if (trigger === "signal") {
        const ref = node.eventDefinition?.signalRef;
        if (ref && signalIds.size > 0 && !signalIds.has(ref)) {
          issues.push({
            ruleId: "bpmn/event-definition-ref-declared",
            severity: "error" as const,
            message: `Signal event "${node.name ?? node.id}" references undeclared signal "${ref}".`,
            elementId: node.id,
            elementType: node.type,
          });
        }
      }
      if (trigger === "error") {
        const ref = node.eventDefinition?.errorRef;
        if (ref && errorIds.size > 0 && !errorIds.has(ref)) {
          issues.push({
            ruleId: "bpmn/event-definition-ref-declared",
            severity: "error" as const,
            message: `Error event "${node.name ?? node.id}" references undeclared error "${ref}".`,
            elementId: node.id,
            elementType: node.type,
          });
        }
      }
      if (trigger === "escalation") {
        const ref = node.eventDefinition?.escalationRef;
        if (ref && escalationIds.size > 0 && !escalationIds.has(ref)) {
          issues.push({
            ruleId: "bpmn/event-definition-ref-declared",
            severity: "error" as const,
            message: `Escalation event "${node.name ?? node.id}" references undeclared escalation "${ref}".`,
            elementId: node.id,
            elementType: node.type,
          });
        }
      }
    }

    return issues;
  },
};
