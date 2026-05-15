import { c as LintRule, d as LintConfig, L as LintEventBus, a as LintResult } from '../events-BzRb3cSx.js';

type C4NodeType = "Person" | "ExternalPerson" | "SoftwareSystem" | "ExternalSystem" | "Container" | "Database" | "MessageBus" | "MicroserviceContainer" | "Component" | "ExternalComponent";
type C4EdgeType = "uses" | "sends" | "delivers" | "reads" | "writes";
type C4DiagramLevel = "context" | "container" | "component" | "dynamic" | "deployment";
interface C4Node {
    id: string;
    type: C4NodeType;
    name?: string;
    description?: string;
    technology?: string;
    isExternal?: boolean;
    parentId?: string;
}
interface C4Edge {
    id: string;
    type: C4EdgeType;
    source: string;
    target: string;
    label?: string;
    technology?: string;
    description?: string;
}
interface C4Diagram {
    id?: string;
    name?: string;
    level: C4DiagramLevel;
    nodes: C4Node[];
    edges: C4Edge[];
}
declare function isPerson(n: C4Node): boolean;
declare function isSystem(n: C4Node): boolean;
declare function isContainer(n: C4Node): boolean;
declare function isComponent(n: C4Node): boolean;

declare const C4_RULES: LintRule<C4Diagram>[];
declare function runC4Lint(diagram: C4Diagram, config?: Partial<LintConfig> & {
    bus?: LintEventBus;
}): LintResult;

export { type C4Diagram, type C4DiagramLevel, type C4Edge, type C4EdgeType, type C4Node, type C4NodeType, C4_RULES, isComponent, isContainer, isPerson, isSystem, runC4Lint };
