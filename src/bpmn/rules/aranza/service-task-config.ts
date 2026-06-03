import type { LintRule } from "../../../core/types";
import type { BpmnDiagram, BpmnNode, BpmnServiceTaskConfig } from "../../types";

function hasValue(value?: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function connectorConfigured(config?: BpmnServiceTaskConfig): boolean {
  if (!config) return false;
  return (hasValue(config.connectorInstanceId) || hasValue(config.connectorId)) && hasValue(config.connectorAction);
}

function httpConfigured(config?: BpmnServiceTaskConfig): boolean {
  if (!config) return false;
  return hasValue(config.httpMethod) && hasValue(config.endpoint);
}

function webServiceConfigured(config?: BpmnServiceTaskConfig): boolean {
  if (!config) return false;
  return hasValue(config.operationRef);
}

function legacyFlowableConfigured(node: BpmnNode): boolean {
  return hasValue(node.flowableType) || hasValue(node.flowableDelegateExpression);
}

function legacyConnectorConfigured(node: BpmnNode): boolean {
  return hasValue(node.connector) && hasValue(node.action);
}

function messageFor(node: BpmnNode): string | null {
  const config = node.serviceConfig;
  const implementation = config?.implementation;

  if (implementation === "connector") {
    if (!connectorConfigured(config) && !legacyConnectorConfigured(node)) {
      return `La tarea de servicio "${node.name ?? node.id}" usa implementación por conector pero le falta conexión y/o acción. Define connectorInstanceId o connectorId, y connectorAction.`;
    }
    return null;
  }

  if (implementation === "http") {
    if (!httpConfigured(config)) {
      return `La tarea de servicio "${node.name ?? node.id}" usa implementación HTTP pero le falta método y/o endpoint. Completa httpMethod y endpoint.`;
    }
    return null;
  }

  if (implementation === "webService") {
    if (!webServiceConfigured(config)) {
      return `La tarea de servicio "${node.name ?? node.id}" usa implementación Web Service pero no tiene operationRef.`;
    }
    return null;
  }

  if (implementation === "none") {
    if (!legacyFlowableConfigured(node)) {
      return `La tarea de servicio "${node.name ?? node.id}" está marcada sin implementación y no define configuración Flowable legacy. Usa flowableType o flowableDelegateExpression, o selecciona otro tipo de implementación.`;
    }
    return null;
  }

  if (
    connectorConfigured(config) ||
    legacyConnectorConfigured(node) ||
    httpConfigured(config) ||
    webServiceConfigured(config) ||
    legacyFlowableConfigured(node)
  ) {
    return null;
  }

  return `La tarea de servicio "${node.name ?? node.id}" no tiene configuración de ejecución. Define un conector, HTTP, Web Service o configuración Flowable en las propiedades.`;
}

export const serviceTaskConfig: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/service-task-config",
  description: "ServiceTask must have execution config consistent with the selected implementation mode.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes
      .filter((node) => node.type === "ServiceTask")
      .flatMap((node) => {
        const message = messageFor(node);
        if (!message) return [];
        return [{
          ruleId: "bpmn/aranza/service-task-config",
          severity: "warning" as const,
          message,
          elementId: node.id,
          elementType: node.type,
        }];
      });
  },
};
