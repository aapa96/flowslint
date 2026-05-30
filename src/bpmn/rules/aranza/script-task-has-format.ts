import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";

export const scriptTaskHasFormat: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/script-task-has-format",
  description: "ScriptTask should declare a scriptFormat (e.g. 'javascript', 'groovy').",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter((n) => n.type === "ScriptTask")
      .filter((n) => !n.scriptFormat?.trim())
      .map((n) => ({
        ruleId: "bpmn/aranza/script-task-has-format",
        severity: "warning" as const,
        message: `La tarea de script "${n.name ?? n.id}" no tiene formato de script definido. Especifica el lenguaje (javascript, groovy, etc.) en las propiedades.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
