export type ErdNodeType =
  | "Entity" | "WeakEntity"
  | "Attribute" | "MultivaluedAttribute" | "DerivedAttribute"
  | "PrimaryKey" | "CompositeAttribute"
  | "Relationship" | "WeakRelationship";

export type ErdEdgeType =
  | "hasAttribute"     // Entity/Relationship → Attribute
  | "participatesIn"   // Entity → Relationship
  | "inherits";        // Entity → Entity (subtype)

export type ErdCardinality = "1" | "N" | "M";

export interface ErdAttribute {
  name: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isRequired?: boolean;
  isUnique?: boolean;
  isMultivalued?: boolean;
  isDerived?: boolean;
  dataType?: string;
}

export interface ErdNode {
  id: string;
  type: ErdNodeType;
  name?: string;
  // Inline attributes (Crow's Foot / IE notation)
  attributes?: ErdAttribute[];
  // Attribute node fields
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isRequired?: boolean;
  isUnique?: boolean;
  isMultivalued?: boolean;
  isDerived?: boolean;
  dataType?: string;
  // Relationship fields
  isIdentifying?: boolean;
}

export interface ErdEdge {
  id: string;
  type: ErdEdgeType;
  source: string;
  target: string;
  sourceCardinality?: ErdCardinality;
  targetCardinality?: ErdCardinality;
  isTotal?: boolean;
}

export interface ErdDiagram {
  id?: string;
  name?: string;
  nodes: ErdNode[];
  edges: ErdEdge[];
}

export function isEntity(n: ErdNode): boolean {
  return n.type === "Entity" || n.type === "WeakEntity";
}
export function isAttribute(n: ErdNode): boolean {
  return n.type === "Attribute" || n.type === "PrimaryKey" ||
         n.type === "MultivaluedAttribute" || n.type === "DerivedAttribute" ||
         n.type === "CompositeAttribute";
}
export function isRelationship(n: ErdNode): boolean {
  return n.type === "Relationship" || n.type === "WeakRelationship";
}
