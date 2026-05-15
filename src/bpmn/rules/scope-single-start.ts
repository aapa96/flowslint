import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

const SCOPE_TYPES = new Set(["SubProcess", "Transaction", "EventSubProcess", "AdHocSubProcess"]);

export const scopeSingleStart: LintRule<BpmnDiagram> = {
  id: "bpmn/scope-single-start",
  description: "A sub-process or scope should contain at most one start event.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const issues = [];
    const scopes = nodes.filter((n) => SCOPE_TYPES.has(n.type));

    for (const scope of scopes) {
      const starts = nodes.filter(
        (n) => n.parentId === scope.id && n.type === "StartEvent",
      );
      if (starts.length > 1) {
        issues.push({
          ruleId: "bpmn/scope-single-start",
          severity: "warning" as const,
          message: `Scope "${scope.name ?? scope.id}" has ${starts.length} start events; review whether multiple triggers are intended.`,
          elementId: scope.id,
          elementType: scope.type,
        });
      }
    }
    return issues;
  },
};
