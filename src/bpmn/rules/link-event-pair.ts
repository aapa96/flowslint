import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

// Per BPMN 2.0 §10.4.4: every throw link event must be matched by at least one
// catch link event with the same name (within the same process scope).
// An unmatched link is a modelling error — the flow cannot continue.

const SUBPROCESS_SCOPE_TYPES = new Set([
  "SubProcess",
  "Transaction",
  "EventSubProcess",
  "AdHocSubProcess",
]);

function linkNameOf(node: BpmnDiagram["nodes"][number]): string | undefined {
  const raw = node.eventDefinition?.linkName ?? node.name;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function linkScopeOf(
  node: BpmnDiagram["nodes"][number],
  nodeById: Map<string, BpmnDiagram["nodes"][number]>,
): string {
  let current = node.parentId ? nodeById.get(node.parentId) : undefined;
  let topPoolId: string | undefined;

  while (current) {
    if (SUBPROCESS_SCOPE_TYPES.has(current.type)) return `scope:${current.id}`;
    if (current.type === "Pool") topPoolId = current.id;
    current = current.parentId ? nodeById.get(current.parentId) : undefined;
  }

  if (topPoolId) return `pool:${topPoolId}`;
  return "root";
}

export const linkEventPair: LintRule<BpmnDiagram> = {
  id: "bpmn/link-event-pair",
  description: "Throw link events must match a unique catch link event with the same name in the same scope.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const catchLinks = nodes.filter(
      (n) => n.type === "IntermediateCatchEvent" && (n.eventDefinition?.type ?? n.trigger) === "link",
    );
    const throwLinks = nodes.filter(
      (n) => n.type === "IntermediateThrowEvent" && (n.eventDefinition?.type ?? n.trigger) === "link",
    );
    const issues = [];

    const catchCountByScopeAndName = new Map<string, BpmnDiagram["nodes"]>();
    for (const node of catchLinks) {
      const name = linkNameOf(node);
      if (!name) continue;
      const scope = linkScopeOf(node, nodeById);
      const key = `${scope}::${name}`;
      const group = catchCountByScopeAndName.get(key) ?? [];
      group.push(node);
      catchCountByScopeAndName.set(key, group);
    }

    for (const node of catchLinks) {
      const name = linkNameOf(node);
      if (!name) continue;
      const scope = linkScopeOf(node, nodeById);
      const key = `${scope}::${name}`;
      const group = catchCountByScopeAndName.get(key) ?? [];
      if (group.length > 1) {
        issues.push({
          ruleId: "bpmn/link-event-pair",
          severity: "error" as const,
          message: `Catch link event "${name}" appears ${group.length} times in the same scope. BPMN expects a unique catch target per link name.`,
          elementId: node.id,
          elementType: node.type,
        });
      }
    }

    for (const node of throwLinks) {
      const name = linkNameOf(node);
      const scope = linkScopeOf(node, nodeById);
      const key = name ? `${scope}::${name}` : undefined;
      const matches = key ? catchCountByScopeAndName.get(key) ?? [] : [];
      if (!name || matches.length === 0) {
        issues.push({
          ruleId: "bpmn/link-event-pair",
          severity: "error" as const,
          message: `Throw link event "${name ?? node.id}" has no matching catch link event with the same name in the same scope.`,
          elementId: node.id,
          elementType: node.type,
        });
      }
    }

    return issues;
  },
};
