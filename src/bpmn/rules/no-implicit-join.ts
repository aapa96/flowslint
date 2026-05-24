import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";
import { isTask } from "../types";

// A task (or intermediate event) with more than one incoming sequence flow
// is an implicit AND/XOR join. Explicit gateways make the intent clear.

export const noImplicitJoin: LintRule<BpmnDiagram> = {
  id: "bpmn/no-implicit-join",
  description: "A task or intermediate event with multiple incoming flows is an implicit join — use a gateway.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    return nodes
      .filter(
        (n) =>
          isTask(n) ||
          n.type === "IntermediateCatchEvent" ||
          n.type === "IntermediateThrowEvent",
      )
      .filter((n) => edges.filter((e) => e.type === "sequenceFlow" && e.target === n.id).length > 1)
      .map((n) => ({
        ruleId: "bpmn/no-implicit-join",
        severity: "warning" as const,
        message: `El elemento "${n.name ?? n.id}" tiene múltiples flujos de entrada. Usa un gateway explícito para modelar la convergencia.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
