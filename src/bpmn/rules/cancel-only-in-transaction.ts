import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

// Per BPMN 2.0 §10.4.5: CancelEndEvent and CancelBoundaryEvent are only valid
// inside (or attached to) a Transaction sub-process.

export const cancelOnlyInTransaction: LintRule<BpmnDiagram> = {
  id: "bpmn/cancel-only-in-transaction",
  description: "Cancel events are only valid inside or attached to a Transaction sub-process.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const issues = [];

    const cancelNodes = nodes.filter(
      (n) =>
        n.trigger === "cancel" &&
        (n.type === "EndEvent" || n.type === "BoundaryEvent"),
    );

    for (const n of cancelNodes) {
      // Walk up the parent chain looking for a Transaction sub-process
      let cur = n.parentId ? nodeById.get(n.parentId) : undefined;
      let inTransaction = false;
      while (cur) {
        if (cur.type === "SubProcess" && cur.subProcessVariant === "transaction") {
          inTransaction = true;
          break;
        }
        cur = cur.parentId ? nodeById.get(cur.parentId) : undefined;
      }
      if (!inTransaction) {
        issues.push({
          ruleId: "bpmn/cancel-only-in-transaction",
          severity: "error" as const,
          message: `Cancel ${n.type === "EndEvent" ? "end" : "boundary"} event "${n.name ?? n.id}" must be inside or attached to a Transaction sub-process.`,
          elementId: n.id,
          elementType: n.type,
        });
      }
    }
    return issues;
  },
};
