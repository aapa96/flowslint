import { runRules } from './chunk-R2R4ZLF5.js';

// src/uml/types.ts
function isClassifier(n) {
  return n.type === "Class" || n.type === "AbstractClass" || n.type === "Interface" || n.type === "Enumeration" || n.type === "DataType";
}

// src/uml/rules/class-has-name.ts
var classHasName = {
  id: "uml/class-has-name",
  description: "Every classifier (Class, AbstractClass, Interface, Enumeration, DataType) must have a name.",
  defaultSeverity: "error",
  check({ nodes }) {
    return nodes.filter(isClassifier).filter((n) => !n.name || n.name.trim() === "").map((n) => ({
      ruleId: "uml/class-has-name",
      severity: "error",
      message: `${n.type} "${n.id}" has no name.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/uml/rules/no-circular-inheritance.ts
var noCircularInheritance = {
  id: "uml/no-circular-inheritance",
  description: "The inheritance graph must be acyclic.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const inheritanceEdges = edges.filter((e) => e.type === "inheritance");
    const nodeIds = new Set(nodes.map((n) => n.id));
    const parents = /* @__PURE__ */ new Map();
    for (const e of inheritanceEdges) {
      if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
      const list = parents.get(e.source) ?? [];
      list.push(e.target);
      parents.set(e.source, list);
    }
    const visited = /* @__PURE__ */ new Set();
    const inStack = /* @__PURE__ */ new Set();
    const issues = [];
    function dfs(nodeId) {
      if (inStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);
      inStack.add(nodeId);
      for (const parentId of parents.get(nodeId) ?? []) {
        if (dfs(parentId)) {
          const node = nodes.find((n) => n.id === nodeId);
          issues.push({
            ruleId: "uml/no-circular-inheritance",
            severity: "error",
            message: `Circular inheritance detected at "${node?.name ?? nodeId}".`,
            elementId: nodeId,
            ...node ? { elementType: node.type } : {}
          });
          inStack.delete(nodeId);
          return false;
        }
      }
      inStack.delete(nodeId);
      return false;
    }
    for (const node of nodes) {
      if (!visited.has(node.id)) dfs(node.id);
    }
    return issues;
  }
};

// src/uml/rules/realization-target-is-interface.ts
var realizationTargetIsInterface = {
  id: "uml/realization-target-is-interface",
  description: "Realization edges must target an Interface node.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    return edges.filter((e) => e.type === "realization").flatMap((e) => {
      const target = nodeById.get(e.target);
      if (!target || target.type === "Interface") return [];
      return [
        {
          ruleId: "uml/realization-target-is-interface",
          severity: "error",
          message: `Realization edge "${e.id}" targets "${target.name ?? target.id}" which is a ${target.type}, not an Interface.`,
          elementId: e.id
        }
      ];
    });
  }
};

// src/uml/rules/abstract-method-in-abstract-class.ts
var abstractMethodInAbstractClass = {
  id: "uml/abstract-method-in-abstract-class",
  description: "AbstractClass nodes should declare at least one abstract method.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "AbstractClass").filter((n) => !n.methods?.some((m) => m.isAbstract)).map((n) => ({
      ruleId: "uml/abstract-method-in-abstract-class",
      severity: "warning",
      message: `AbstractClass "${n.name ?? n.id}" has no abstract methods.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/uml/rules/class-not-isolated.ts
var classNotIsolated = {
  id: "uml/class-not-isolated",
  description: "Every classifier should have at least one edge connecting it to another node.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const classifiers = nodes.filter(isClassifier);
    return classifiers.flatMap((n) => {
      const connected = edges.some((e) => e.source === n.id || e.target === n.id);
      if (connected) return [];
      return [
        {
          ruleId: "uml/class-not-isolated",
          severity: "warning",
          message: `${n.type} "${n.name ?? n.id}" is isolated (no edges).`,
          elementId: n.id,
          elementType: n.type
        }
      ];
    });
  }
};

// src/uml/rules/enumeration-has-literals.ts
var enumerationHasLiterals = {
  id: "uml/enumeration-has-literals",
  description: "Enumeration nodes should have at least one attribute (literal).",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "Enumeration").filter((n) => !n.attributes || n.attributes.length === 0).map((n) => ({
      ruleId: "uml/enumeration-has-literals",
      severity: "warning",
      message: `Enumeration "${n.name ?? n.id}" has no literals.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/uml/rules/no-duplicate-attribute.ts
var noDuplicateAttribute = {
  id: "uml/no-duplicate-attribute",
  description: "A class must not declare two attributes with the same name.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.flatMap((n) => {
      if (!n.attributes || n.attributes.length < 2) return [];
      const seen = /* @__PURE__ */ new Set();
      const duplicates = /* @__PURE__ */ new Set();
      for (const attr of n.attributes) {
        if (seen.has(attr.name)) duplicates.add(attr.name);
        seen.add(attr.name);
      }
      return [...duplicates].map((name) => ({
        ruleId: "uml/no-duplicate-attribute",
        severity: "warning",
        message: `${n.type} "${n.name ?? n.id}" has duplicate attribute "${name}".`,
        elementId: n.id,
        elementType: n.type
      }));
    });
  }
};

// src/uml/rules/package-has-name.ts
var packageHasName = {
  id: "uml/package-has-name",
  description: "Package nodes should have a name.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "Package").filter((n) => !n.name || n.name.trim() === "").map((n) => ({
      ruleId: "uml/package-has-name",
      severity: "info",
      message: `Package "${n.id}" has no name.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/uml/runner.ts
var UML_RULES = [
  // Structural errors
  classHasName,
  noCircularInheritance,
  realizationTargetIsInterface,
  // Best-practice warnings
  abstractMethodInAbstractClass,
  classNotIsolated,
  enumerationHasLiterals,
  noDuplicateAttribute,
  // Informational hints
  packageHasName
];
var DEFAULT_CONFIG = {
  rules: Object.fromEntries(UML_RULES.map((r) => [r.id, r.defaultSeverity]))
};
function runUmlLint(diagram, config = {}) {
  const merged = {
    rules: { ...DEFAULT_CONFIG.rules, ...config.rules }
  };
  return runRules(diagram, UML_RULES, merged, { ...config.bus !== void 0 ? { bus: config.bus } : {} });
}

export { UML_RULES, isClassifier, runUmlLint };
//# sourceMappingURL=chunk-A5YYYXX6.js.map
//# sourceMappingURL=chunk-A5YYYXX6.js.map