import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

export const sequenceFlowNoCrossPool: LintRule<BpmnDiagram> = {
  id: "bpmn/sequence-flow-no-cross-pool",
  description: "Sequence flows must not cross pool boundaries — use message flows instead.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    // Build a map of nodeId → poolId (the top-level Pool ancestor).
    const poolOf = new Map<string, string>();
    const pools = new Set(nodes.filter((n) => n.type === "Pool").map((n) => n.id));

    for (const n of nodes) {
      if (pools.has(n.id)) {
        poolOf.set(n.id, n.id);
      } else if (n.parentId) {
        // Walk up: lane → pool.
        let cur: string | undefined = n.parentId;
        while (cur && !pools.has(cur)) {
          cur = nodes.find((x) => x.id === cur)?.parentId;
        }
        if (cur) poolOf.set(n.id, cur);
      }
    }

    return edges
      .filter((e) => {
        if (e.type !== "sequenceFlow") return false;
        const srcPool = poolOf.get(e.source);
        const tgtPool = poolOf.get(e.target);
        // Only flag when both nodes are in pools AND they are different pools.
        return srcPool !== undefined && tgtPool !== undefined && srcPool !== tgtPool;
      })
      .map((e) => ({
        ruleId: "bpmn/sequence-flow-no-cross-pool",
        severity: "error" as const,
        message: `Sequence flow "${e.id}" crosses pool boundaries. Use a message flow instead.`,
        elementId: e.id,
      }));
  },
};
