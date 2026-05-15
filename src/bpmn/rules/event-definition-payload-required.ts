import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

function triggerOf(node: BpmnDiagram["nodes"][number]): string | undefined {
  return node.eventDefinition?.type ?? node.trigger;
}

export const eventDefinitionPayloadRequired: LintRule<BpmnDiagram> = {
  id: "bpmn/event-definition-payload-required",
  description: "Certain BPMN event definitions require additional payload such as refs, expressions, or link names.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const issues = [];

    for (const node of nodes) {
      const trigger = triggerOf(node);
      if (!trigger || trigger === "none") continue;

      if (trigger === "timer" && !node.eventDefinition?.timer?.value?.trim()) {
        issues.push({
          ruleId: "bpmn/event-definition-payload-required",
          severity: "warning" as const,
          message: `Timer event "${node.name ?? node.id}" requires a timer expression.`,
          elementId: node.id,
          elementType: node.type,
        });
      }

      if (trigger === "conditional" && !node.eventDefinition?.conditionExpression?.trim()) {
        issues.push({
          ruleId: "bpmn/event-definition-payload-required",
          severity: "warning" as const,
          message: `Conditional event "${node.name ?? node.id}" requires a condition expression.`,
          elementId: node.id,
          elementType: node.type,
        });
      }

      if (trigger === "link" && !(node.eventDefinition?.linkName?.trim() || node.name?.trim())) {
        issues.push({
          ruleId: "bpmn/event-definition-payload-required",
          severity: "warning" as const,
          message: `Link event "${node.name ?? node.id}" requires a link name.`,
          elementId: node.id,
          elementType: node.type,
        });
      }
    }

    return issues;
  },
};
