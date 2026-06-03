import type { LintRule } from "../../../core/types";
import type { BpmnDiagram } from "../../types";

export const sendTaskMessageContext: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/send-task-message-context",
  description: "SendTask should expose the outbound interaction through a message flow.",
  defaultSeverity: "info",
  check({ nodes, edges }) {
    return nodes
      .filter((node) => node.type === "SendTask")
      .filter((node) => !edges.some((edge) => edge.type === "messageFlow" && edge.source === node.id))
      .map((node) => ({
        ruleId: "bpmn/aranza/send-task-message-context",
        severity: "info" as const,
        message: `La tarea de env\u00edo "${node.name ?? node.id}" no tiene un messageFlow saliente. Agrega el intercambio para hacer visible qu\u00e9 participante recibe el mensaje.`,
        elementId: node.id,
        elementType: node.type,
      }));
  },
};
