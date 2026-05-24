import type { LintRule } from "../../core/types";
import type { BpmnNode, BpmnDiagram } from "../types";

function isInsideSubProcess(n: BpmnNode, nodeById: Map<string, BpmnNode>): boolean {
  if (!n.parentId) return false;
  const parent = nodeById.get(n.parentId);
  if (!parent) return false;
  return parent.type === "SubProcess" ? true : isInsideSubProcess(parent, nodeById);
}

export const endEventRequired: LintRule<BpmnDiagram> = {
  id: "bpmn/end-event-required",
  description: "Every process scope must have at least one end event.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const pools = nodes.filter((n) => n.type === "Pool");

    if (pools.length === 0) {
      const hasEnd = nodes.some(
        (n) => n.type === "EndEvent" && !isInsideSubProcess(n, nodeById),
      );
      return hasEnd
        ? []
        : [{ ruleId: "bpmn/end-event-required", severity: "error", message: "El proceso no tiene evento de fin. Agrega un EndEvent para cerrar el flujo." }];
    }

    const issues = [];
    for (const pool of pools) {
      const laneIds = new Set(nodes.filter((n) => n.type === "Lane" && n.parentId === pool.id).map((n) => n.id));
      const inPool = (n: BpmnNode) =>
        n.parentId === pool.id || (n.parentId !== undefined && laneIds.has(n.parentId));

      const hasEnd = nodes.some(
        (n) => n.type === "EndEvent" && inPool(n) && !isInsideSubProcess(n, nodeById),
      );
      if (!hasEnd) {
        issues.push({
          ruleId: "bpmn/end-event-required",
          severity: "error" as const,
          message: `El pool "${pool.name ?? pool.id}" no tiene evento de fin. Cada participante en una colaboración necesita su propio EndEvent.`,
          elementId: pool.id,
          elementType: pool.type,
        });
      }
    }
    return issues;
  },
};
