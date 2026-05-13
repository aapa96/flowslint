export type C4NodeType =
  | "Person" | "ExternalPerson"
  | "SoftwareSystem" | "ExternalSystem"
  | "Container" | "Database" | "MessageBus" | "MicroserviceContainer"
  | "Component" | "ExternalComponent";

export type C4EdgeType = "uses" | "sends" | "delivers" | "reads" | "writes";

export type C4DiagramLevel =
  | "context"    // Personas + Sistemas
  | "container"  // Contenedores dentro de un Sistema
  | "component"  // Componentes dentro de un Contenedor
  | "dynamic"    // Vista de secuencia dinámica
  | "deployment"; // Infraestructura

export interface C4Node {
  id: string;
  type: C4NodeType;
  name?: string;
  description?: string;
  technology?: string;
  isExternal?: boolean;
  parentId?: string;
}

export interface C4Edge {
  id: string;
  type: C4EdgeType;
  source: string;
  target: string;
  label?: string;
  technology?: string;
  description?: string;
}

export interface C4Diagram {
  id?: string;
  name?: string;
  level: C4DiagramLevel;
  nodes: C4Node[];
  edges: C4Edge[];
}

export function isPerson(n: C4Node): boolean {
  return n.type === "Person" || n.type === "ExternalPerson";
}
export function isSystem(n: C4Node): boolean {
  return n.type === "SoftwareSystem" || n.type === "ExternalSystem";
}
export function isContainer(n: C4Node): boolean {
  return n.type === "Container" || n.type === "Database" ||
         n.type === "MessageBus" || n.type === "MicroserviceContainer";
}
export function isComponent(n: C4Node): boolean {
  return n.type === "Component" || n.type === "ExternalComponent";
}
