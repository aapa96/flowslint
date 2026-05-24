import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";
import { isTask } from "../types";

export const noImplicitSplit: LintRule<BpmnDiagram> = {
  id: "bpmn/no-implicit-split",
  description: "A task with more than one outgoing sequence flow is an implicit split — use a gateway.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    return nodes
      .filter((n) => isTask(n))
      .filter((n) => edges.filter((e) => e.type === "sequenceFlow" && e.source === n.id).length > 1)
      .map((n) => ({
        ruleId: "bpmn/no-implicit-split",
        severity: "warning" as const,
        message: `El elemento "${n.name ?? n.id}" tiene múltiples flujos de salida. Usa un gateway explícito (ExclusiveGateway o ParallelGateway) para modelar la división.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
