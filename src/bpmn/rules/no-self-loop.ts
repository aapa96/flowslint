import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

export const noSelfLoop: LintRule<BpmnDiagram> = {
  id: "bpmn/no-self-loop",
  description: "A sequence flow must not connect a node to itself.",
  defaultSeverity: "error",
  check({ edges }) {
    return edges
      .filter((e) => e.type === "sequenceFlow" && e.source === e.target)
      .map((e) => ({
        ruleId: "bpmn/no-self-loop",
        severity: "error" as const,
        message: `El flujo "${e.id}" conecta un nodo consigo mismo. Un elemento no puede ser su propio origen y destino.`,
        elementId: e.id,
      }));
  },
};
