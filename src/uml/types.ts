export type UmlNodeType =
  | "Class" | "AbstractClass" | "Interface"
  | "Enumeration" | "DataType" | "Package";

export type UmlEdgeType =
  | "association"          // línea simple
  | "directedAssociation"  // línea con flecha
  | "aggregation"          // ◇——
  | "composition"          // ◆——
  | "dependency"           // - - →
  | "realization"          // - - ▷ (implementa interfaz)
  | "inheritance"          // ——▷ (generalización)
  | "usage";               // «use»

export interface UmlAttribute {
  name: string;
  type?: string;
  visibility?: "public" | "private" | "protected" | "package";
  isStatic?: boolean;
  isAbstract?: boolean;
  defaultValue?: string;
}

export interface UmlMethod {
  name: string;
  returnType?: string;
  visibility?: "public" | "private" | "protected" | "package";
  isStatic?: boolean;
  isAbstract?: boolean;
  parameters?: Array<{ name: string; type?: string }>;
}

export interface UmlNode {
  id: string;
  type: UmlNodeType;
  name?: string;
  isAbstract?: boolean;
  attributes?: UmlAttribute[];
  methods?: UmlMethod[];
  stereotypes?: string[];
  parentId?: string;
}

export interface UmlEdge {
  id: string;
  type: UmlEdgeType;
  source: string;
  target: string;
  label?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  sourceRole?: string;
  targetRole?: string;
}

export interface UmlDiagram {
  id?: string;
  name?: string;
  nodes: UmlNode[];
  edges: UmlEdge[];
}

export function isClassifier(n: UmlNode): boolean {
  return n.type === "Class" || n.type === "AbstractClass" ||
         n.type === "Interface" || n.type === "Enumeration" || n.type === "DataType";
}
