import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

export const subprocessHasStartEnd: LintRule<BpmnDiagram> = {
  id: "bpmn/subprocess-has-start-end",
  description: "Embedded and transaction sub-processes must have start and end events. Event sub-processes must have a triggering start event.",
  defaultSeverity: "error",
  check({ nodes }) {
    const subProcesses = nodes.filter((n) => n.type === "SubProcess");
    const issues = [];

    for (const sp of subProcesses) {
      const variant = sp.subProcessVariant ?? "embedded";

      // Ad-hoc sub-processes have no required ordering — skip
      if (variant === "adhoc") continue;

      const children = nodes.filter((n) => n.parentId === sp.id);

      // Event sub-process: must have a start event with a non-none trigger
      if (variant === "event") {
        const starts = children.filter((n) => n.type === "StartEvent");
        if (starts.length === 0) {
          issues.push({
            ruleId: "bpmn/subprocess-has-start-end",
            severity: "error" as const,
            message: `Event sub-process "${sp.name ?? sp.id}" must contain a start event with a trigger.`,
            elementId: sp.id,
            elementType: sp.type,
          });
        } else {
          for (const s of starts) {
            if (!s.trigger || s.trigger === "none") {
              issues.push({
                ruleId: "bpmn/subprocess-has-start-end",
                severity: "error" as const,
                message: `Event sub-process "${sp.name ?? sp.id}" start event must have a trigger (not "none").`,
                elementId: s.id,
                elementType: s.type,
              });
            }
          }
        }
        continue;
      }

      // Embedded and transaction: need at least one start and one end event
      const hasStart = children.some((n) => n.type === "StartEvent");
      const hasEnd = children.some((n) => n.type === "EndEvent");

      if (!hasStart) {
        issues.push({
          ruleId: "bpmn/subprocess-has-start-end",
          severity: "error" as const,
          message: `Sub-process "${sp.name ?? sp.id}" (${variant}) has no start event.`,
          elementId: sp.id,
          elementType: sp.type,
        });
      }
      if (!hasEnd) {
        issues.push({
          ruleId: "bpmn/subprocess-has-start-end",
          severity: "error" as const,
          message: `Sub-process "${sp.name ?? sp.id}" (${variant}) has no end event.`,
          elementId: sp.id,
          elementType: sp.type,
        });
      }
    }
    return issues;
  },
};
