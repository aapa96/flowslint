import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

const ALLOWED_EVENT_SUBPROCESS_START_TRIGGERS = new Set([
  "message",
  "timer",
  "escalation",
  "conditional",
  "error",
  "compensation",
  "signal",
  "multiple",
  "parallelMultiple",
]);

const NON_INTERRUPTIBLE_EVENT_SUBPROCESS_START_TRIGGERS = new Set([
  "message",
  "timer",
  "escalation",
  "conditional",
  "signal",
  "multiple",
  "parallelMultiple",
]);

export const eventSubprocessStartCompatible: LintRule<BpmnDiagram> = {
  id: "bpmn/event-subprocess-start-compatible",
  description: "Event sub-process start events must use a valid trigger and only supported non-interrupting variants.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const issues = [];

    const eventSubprocessStarts = nodes.filter((node) => {
      if (node.type !== "StartEvent" || !node.parentId) return false;
      const parent = nodeById.get(node.parentId);
      return parent?.type === "EventSubProcess" || parent?.subProcessVariant === "event";
    });

    for (const start of eventSubprocessStarts) {
      const trigger = start.eventDefinition?.type ?? start.trigger;
      if (!trigger || trigger === "none") continue;

      if (!ALLOWED_EVENT_SUBPROCESS_START_TRIGGERS.has(trigger)) {
        issues.push({
          ruleId: "bpmn/event-subprocess-start-compatible",
          severity: "error" as const,
          message: `El StartEvent "${start.name ?? start.id}" dentro de un EventSubProcess no admite el trigger "${trigger}".`,
          elementId: start.id,
          elementType: start.type,
        });
        continue;
      }

      if (start.isNonInterrupting === true && !NON_INTERRUPTIBLE_EVENT_SUBPROCESS_START_TRIGGERS.has(trigger)) {
        issues.push({
          ruleId: "bpmn/event-subprocess-start-compatible",
          severity: "error" as const,
          message: `El StartEvent no interruptivo "${start.name ?? start.id}" dentro de un EventSubProcess no admite el trigger "${trigger}".`,
          elementId: start.id,
          elementType: start.type,
        });
      }
    }

    return issues;
  },
};
