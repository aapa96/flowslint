import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

const VALID_HOSTS = new Set([
  "Task", "UserTask", "ServiceTask", "ScriptTask", "ManualTask",
  "BusinessRuleTask", "ReceiveTask", "SendTask", "SubProcess", "CallActivity",
]);

export const boundaryEventAttached: LintRule<BpmnDiagram> = {
  id: "bpmn/boundary-event-attached",
  description: "Boundary events must be attached to a task or sub-process.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    return nodes
      .filter((n) => n.type === "BoundaryEvent")
      .filter((n) => {
        if (!n.parentId) return true;
        const host = nodeById.get(n.parentId);
        return !host || !VALID_HOSTS.has(host.type);
      })
      .map((n) => ({
        ruleId: "bpmn/boundary-event-attached",
        severity: "error" as const,
        message: `Boundary event "${n.name ?? n.id}" is not attached to a task or sub-process.`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
