import type { LintRule } from "../../core/types";
import type { BpmnDiagram } from "../types";

export const compensationFlowTarget: LintRule<BpmnDiagram> = {
  id: "bpmn/compensation-flow-target",
  description: "A compensation BoundaryEvent should have an outgoing association to a compensation Task or SubProcess.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const compensationBoundaries = nodes.filter(
      (n) => n.type === "BoundaryEvent" && n.trigger === "compensation",
    );

    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    return compensationBoundaries.flatMap((boundary) => {
      const hasCompensationTarget = edges.some((e) => {
        if (e.type !== "association" || e.source !== boundary.id) return false;
        const target = nodeById.get(e.target);
        if (!target) return false;
        const isTaskOrSubProcess =
          target.type === "Task" || target.type === "SubProcess" ||
          target.type === "UserTask" || target.type === "ServiceTask" ||
          target.type === "ScriptTask" || target.type === "ManualTask" ||
          target.type === "BusinessRuleTask" || target.type === "ReceiveTask" ||
          target.type === "SendTask" || target.type === "CallActivity";
        if (!isTaskOrSubProcess) return false;
        return target.markers?.includes("compensation") ?? false;
      });

      if (hasCompensationTarget) return [];

      return [
        {
          ruleId: "bpmn/compensation-flow-target",
          severity: "warning" as const,
          message: `Compensation BoundaryEvent "${boundary.name ?? boundary.id}" has no association to a compensation-marked Task or SubProcess.`,
          elementId: boundary.id,
          elementType: boundary.type,
        },
      ];
    });
  },
};
