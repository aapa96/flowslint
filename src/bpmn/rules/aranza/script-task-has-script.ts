import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";

export const scriptTaskHasScript: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/script-task-has-script",
  description: "ScriptTask should define a script body or expression to execute.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter((n) => n.type === "ScriptTask")
      .filter((n) => !n.script?.trim())
      .map((n) => ({
        ruleId: "bpmn/aranza/script-task-has-script",
        severity: "warning" as const,
        message: `La tarea de script "${n.name ?? n.id}" no tiene contenido ejecutable. Define el script o expresi\u00f3n que debe ejecutarse.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
