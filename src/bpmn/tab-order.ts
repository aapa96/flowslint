import type { BpmnDiagram, BpmnNode } from "./types";

/**
 * Compute a logical tab order for BPMN flow nodes using BFS from Start Events.
 *
 * Order:
 * 1. Start Events come first (sources with no incoming sequence flows).
 * 2. Remaining flow nodes are visited in BFS order following SequenceFlow edges.
 * 3. Flow nodes unreachable from any Start Event are appended at the end.
 * 4. Non-flow nodes (Pools, Lanes, Annotations, Data objects) are excluded.
 *
 * @param diagram - BPMN diagram to traverse.
 * @param scopeId - Optional parent node ID to restrict traversal to a Pool or SubProcess.
 * @returns Ordered array of node IDs.
 */
export function getBpmnFlowTabOrder(
  diagram: BpmnDiagram,
  scopeId?: string,
): string[] {
  const sequenceFlows = diagram.edges.filter((e) => e.type === "sequenceFlow");

  // Determine scope
  const scopedNodes: BpmnNode[] = scopeId
    ? diagram.nodes.filter((n) => n.id !== scopeId && n.parentId === scopeId)
    : diagram.nodes.filter((n) => !n.parentId);

  // Only consider flow nodes for ordering
  const FLOW_NODE_TYPES = new Set([
    "StartEvent", "EndEvent", "Task", "UserTask", "ServiceTask",
    "ScriptTask", "BusinessRuleTask", "ManualTask", "ReceiveTask",
    "SendTask", "CallActivity", "SubProcess",
    "ExclusiveGateway", "InclusiveGateway", "ParallelGateway",
    "EventBasedGateway", "ComplexGateway",
    "IntermediateCatchEvent", "IntermediateThrowEvent", "BoundaryEvent",
  ]);
  const flowNodes = scopedNodes.filter((n) => FLOW_NODE_TYPES.has(n.type));
  const flowNodeIds = new Set(flowNodes.map((n) => n.id));

  // Build in-degree map from SequenceFlows within scope
  const inDegree = new Map<string, number>();
  for (const n of flowNodes) inDegree.set(n.id, 0);

  for (const e of sequenceFlows) {
    if (flowNodeIds.has(e.source) && flowNodeIds.has(e.target)) {
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    }
  }

  // Build adjacency list
  const outgoing = new Map<string, string[]>();
  for (const n of flowNodes) outgoing.set(n.id, []);
  for (const e of sequenceFlows) {
    if (flowNodeIds.has(e.source) && flowNodeIds.has(e.target)) {
      outgoing.get(e.source)?.push(e.target);
    }
  }

  // BFS from StartEvent nodes only; other in-degree-0 nodes are treated as unreachable
  const startEventIds = flowNodes
    .filter((n) => n.type === "StartEvent" && (inDegree.get(n.id) ?? 0) === 0)
    .map((n) => n.id);
  const queue: string[] = startEventIds.length > 0
    ? startEventIds
    : flowNodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);

  const ordered: string[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    ordered.push(id);
    for (const next of outgoing.get(id) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  // Append flow nodes not reachable from any source
  for (const n of flowNodes) {
    if (!visited.has(n.id)) ordered.push(n.id);
  }

  return ordered;
}
