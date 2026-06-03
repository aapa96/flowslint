import type { LintRule } from "../../../core/types";
import type { BpmnDiagram, BpmnNode, BpmnProcessVariable } from "../../types";

const VARIABLE_PATTERN = /\{\{\s*([A-Za-z_][\w.]*)\s*\}\}|\$\{\s*([A-Za-z_][\w.]*)\s*\}/g;

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function collectDeclaredVariables(diagram: BpmnDiagram): Set<string> {
  const declared = new Set<string>();
  for (const variable of diagram.definitions?.variables ?? []) {
    if (typeof variable?.name === "string" && variable.name.trim()) {
      declared.add(variable.name.trim());
    }
  }
  for (const node of diagram.nodes) {
    for (const item of node.variables ?? []) {
      if (typeof item === "string" && item.trim()) declared.add(item.trim());
      if (item && typeof item === "object" && typeof item.name === "string" && item.name.trim()) {
        declared.add(item.name.trim());
      }
    }
    const output = asString(node.outputVariable) ?? asString(node.resultVariable);
    if (output) declared.add(output);
  }
  return declared;
}

function collectVariableUsages(value: unknown, acc: Set<string>): void {
  if (typeof value === "string") {
    for (const match of value.matchAll(VARIABLE_PATTERN)) {
      const name = match[1] ?? match[2];
      if (name) acc.add(name);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectVariableUsages(item, acc);
    return;
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectVariableUsages(nested, acc);
    }
  }
}

function declaredInNode(node: BpmnNode): Set<string> {
  const names = new Set<string>();
  for (const item of node.variables ?? []) {
    if (typeof item === "string" && item.trim()) names.add(item.trim());
    if (item && typeof item === "object" && typeof item.name === "string" && item.name.trim()) {
      names.add(item.name.trim());
    }
  }
  const output = asString(node.outputVariable) ?? asString(node.resultVariable);
  if (output) names.add(output);
  return names;
}

export const variableExists: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/variable-exists",
  description: "Variables referenced in expressions must be declared in the process or produced by a node.",
  defaultSeverity: "warning",
  check(diagram) {
    const declared = collectDeclaredVariables(diagram);
    return diagram.nodes.flatMap((node) => {
      const localDeclarations = declaredInNode(node);
      const referenced = new Set<string>();
      collectVariableUsages(node, referenced);
      return [...referenced]
        .filter((name) => !declared.has(name) && !localDeclarations.has(name))
        .map((name) => ({
          ruleId: "bpmn/aranza/variable-exists",
          severity: "warning" as const,
          message: `La variable "${name}" usada en "${node.name ?? node.id}" no está declarada.`,
          elementId: node.id,
          elementType: node.type,
        }));
    });
  },
};
