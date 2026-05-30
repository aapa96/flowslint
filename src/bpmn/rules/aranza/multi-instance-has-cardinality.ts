import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";

export const multiInstanceHasCardinality: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/multi-instance-has-cardinality",
  description: "Multi-instance tasks must define a loop cardinality expression.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter(
        (n) =>
          n.loopType === "sequentialMultiple" || n.loopType === "parallelMultiple",
      )
      .filter((n) => !n.loopCardinality?.trim())
      .map((n) => ({
        ruleId: "bpmn/aranza/multi-instance-has-cardinality",
        severity: "warning" as const,
        message: `La tarea "${n.name ?? n.id}" es multi-instancia pero no tiene cardinalidad definida. Define una expresión de cardinalidad para controlar el número de instancias.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
