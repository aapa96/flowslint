import { c as LintRule, d as LintConfig, L as LintEventBus, a as LintResult } from '../events-BzRb3cSx.js';

type ErdNodeType = "Entity" | "WeakEntity" | "Attribute" | "MultivaluedAttribute" | "DerivedAttribute" | "PrimaryKey" | "CompositeAttribute" | "Relationship" | "WeakRelationship";
type ErdEdgeType = "hasAttribute" | "participatesIn" | "inherits";
type ErdCardinality = "1" | "N" | "M";
interface ErdAttribute {
    name: string;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
    isRequired?: boolean;
    isUnique?: boolean;
    isMultivalued?: boolean;
    isDerived?: boolean;
    dataType?: string;
}
interface ErdNode {
    id: string;
    type: ErdNodeType;
    name?: string;
    attributes?: ErdAttribute[];
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
    isRequired?: boolean;
    isUnique?: boolean;
    isMultivalued?: boolean;
    isDerived?: boolean;
    dataType?: string;
    isIdentifying?: boolean;
}
interface ErdEdge {
    id: string;
    type: ErdEdgeType;
    source: string;
    target: string;
    sourceCardinality?: ErdCardinality;
    targetCardinality?: ErdCardinality;
    isTotal?: boolean;
}
interface ErdDiagram {
    id?: string;
    name?: string;
    nodes: ErdNode[];
    edges: ErdEdge[];
}
declare function isEntity(n: ErdNode): boolean;
declare function isAttribute(n: ErdNode): boolean;
declare function isRelationship(n: ErdNode): boolean;

declare const ERD_RULES: LintRule<ErdDiagram>[];
declare function runErdLint(diagram: ErdDiagram, config?: Partial<LintConfig> & {
    bus?: LintEventBus;
}): LintResult;

export { ERD_RULES, type ErdAttribute, type ErdCardinality, type ErdDiagram, type ErdEdge, type ErdEdgeType, type ErdNode, type ErdNodeType, isAttribute, isEntity, isRelationship, runErdLint };
