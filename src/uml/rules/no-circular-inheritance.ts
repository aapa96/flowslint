import type { LintRule } from "../../core/types";
import type { UmlDiagram } from "../types";

export const noCircularInheritance: LintRule<UmlDiagram> = {
  id: "uml/no-circular-inheritance",
  description: "The inheritance graph must be acyclic.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const inheritanceEdges = edges.filter((e) => e.type === "inheritance");
    const nodeIds = new Set(nodes.map((n) => n.id));

    // Build adjacency list: child → parent (direction of inheritance arrow)
    const parents = new Map<string, string[]>();
    for (const e of inheritanceEdges) {
      if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
      const list = parents.get(e.source) ?? [];
      list.push(e.target);
      parents.set(e.source, list);
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();
    const issues: ReturnType<typeof noCircularInheritance.check> = [];

    function dfs(nodeId: string): boolean {
      if (inStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);
      inStack.add(nodeId);
      for (const parentId of parents.get(nodeId) ?? []) {
        if (dfs(parentId)) {
          // nodeId closes the cycle
          const node = nodes.find((n) => n.id === nodeId);
          issues.push({
            ruleId: "uml/no-circular-inheritance",
            severity: "error" as const,
            message: `Circular inheritance detected at "${node?.name ?? nodeId}".`,
            elementId: nodeId,
            ...(node ? { elementType: node.type } : {}),
          });
          // Report once per closing node, then stop traversal from here
          inStack.delete(nodeId);
          return false;
        }
      }
      inStack.delete(nodeId);
      return false;
    }

    for (const node of nodes) {
      if (!visited.has(node.id)) dfs(node.id);
    }

    return issues;
  },
};
