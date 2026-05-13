import { b as LintRule, c as LintConfig, L as LintResult } from '../types-BHI4Uea2.cjs';

type UmlNodeType = "Class" | "AbstractClass" | "Interface" | "Enumeration" | "DataType" | "Package";
type UmlEdgeType = "association" | "directedAssociation" | "aggregation" | "composition" | "dependency" | "realization" | "inheritance" | "usage";
interface UmlAttribute {
    name: string;
    type?: string;
    visibility?: "public" | "private" | "protected" | "package";
    isStatic?: boolean;
    isAbstract?: boolean;
    defaultValue?: string;
}
interface UmlMethod {
    name: string;
    returnType?: string;
    visibility?: "public" | "private" | "protected" | "package";
    isStatic?: boolean;
    isAbstract?: boolean;
    parameters?: Array<{
        name: string;
        type?: string;
    }>;
}
interface UmlNode {
    id: string;
    type: UmlNodeType;
    name?: string;
    isAbstract?: boolean;
    attributes?: UmlAttribute[];
    methods?: UmlMethod[];
    stereotypes?: string[];
    parentId?: string;
}
interface UmlEdge {
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
interface UmlDiagram {
    id?: string;
    name?: string;
    nodes: UmlNode[];
    edges: UmlEdge[];
}
declare function isClassifier(n: UmlNode): boolean;

declare const UML_RULES: LintRule<UmlDiagram>[];
declare function runUmlLint(diagram: UmlDiagram, config?: Partial<LintConfig>): LintResult;

export { UML_RULES, type UmlAttribute, type UmlDiagram, type UmlEdge, type UmlEdgeType, type UmlMethod, type UmlNode, type UmlNodeType, isClassifier, runUmlLint };
