import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

export const complexGatewayDocumented: LintRule<BpmnDiagram> = {
  id: "bpmn/complex-gateway-documented",
  description: "ComplexGateway should document the routing rule it represents.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter((node) => node.type === "ComplexGateway" && !node.documentation?.trim())
      .map((node) => ({
        ruleId: "bpmn/complex-gateway-documented",
        severity: "warning" as const,
        message: `El ComplexGateway "${node.name ?? node.id}" no documenta la regla que coordina sus ramas. Describe en la documentación cuándo se activa cada salida o combinación.`,
        elementId: node.id,
        elementType: node.type,
      }));
  },
};
