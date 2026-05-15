'use strict';

// src/core/runner.ts
function runRules(diagram, rules, config, options = {}) {
  const { bus } = options;
  const issues = [];
  for (const rule of rules) {
    const override = config.rules?.[rule.id];
    if (override === "off") continue;
    const severity = override ?? rule.defaultSeverity;
    bus?.emit("rule:started", { ruleId: rule.id, severity });
    let found;
    try {
      found = rule.check(diagram);
    } catch {
      found = [{
        ruleId: rule.id,
        severity: "error",
        message: `Rule "${rule.id}" threw an unexpected error.`
      }];
    }
    const enriched = found.map((issue) => {
      const e = { ...issue, code: issue.code ?? rule.id, severity };
      if (!e.category && rule.category) e.category = rule.category;
      if (!e.docsUrl && rule.docsUrl) e.docsUrl = rule.docsUrl;
      return e;
    });
    if (enriched.length === 0) {
      bus?.emit("rule:passed", { ruleId: rule.id });
    } else {
      bus?.emit("rule:failed", { ruleId: rule.id, issues: enriched });
      for (const issue of enriched) {
        bus?.emit("issue:found", { issue });
      }
    }
    issues.push(...enriched);
  }
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;
  const result = { issues, errors, warnings, infos, passed: errors === 0 };
  bus?.emit("lint:completed", { result });
  return result;
}

// src/c4/rules/element-has-name.ts
var elementHasName = {
  id: "c4/element-has-name",
  description: "Every C4 element must have a non-empty name.",
  defaultSeverity: "error",
  check({ nodes }) {
    return nodes.filter((n) => !n.name || n.name.trim() === "").map((n) => ({
      ruleId: "c4/element-has-name",
      severity: "error",
      message: `${n.type} "${n.id}" has no name.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/c4/types.ts
function isPerson(n) {
  return n.type === "Person" || n.type === "ExternalPerson";
}
function isSystem(n) {
  return n.type === "SoftwareSystem" || n.type === "ExternalSystem";
}
function isContainer(n) {
  return n.type === "Container" || n.type === "Database" || n.type === "MessageBus" || n.type === "MicroserviceContainer";
}
function isComponent(n) {
  return n.type === "Component" || n.type === "ExternalComponent";
}

// src/c4/rules/container-inside-system.ts
var containerInsideSystem = {
  id: "c4/container-inside-system",
  description: "Every Container must have a parentId pointing to a SoftwareSystem.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const containers = nodes.filter(isContainer);
    return containers.flatMap((c) => {
      if (!c.parentId) {
        return [
          {
            ruleId: "c4/container-inside-system",
            severity: "error",
            message: `${c.type} "${c.name ?? c.id}" has no parent SoftwareSystem.`,
            elementId: c.id,
            elementType: c.type
          }
        ];
      }
      const parent = nodeById.get(c.parentId);
      if (!parent || !isSystem(parent)) {
        return [
          {
            ruleId: "c4/container-inside-system",
            severity: "error",
            message: `${c.type} "${c.name ?? c.id}" must be inside a SoftwareSystem, but its parent is "${parent?.type ?? "unknown"}".`,
            elementId: c.id,
            elementType: c.type
          }
        ];
      }
      return [];
    });
  }
};

// src/c4/rules/component-inside-container.ts
var componentInsideContainer = {
  id: "c4/component-inside-container",
  description: "Every Component must have a parentId pointing to a Container.",
  defaultSeverity: "error",
  check({ nodes }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const components = nodes.filter(isComponent);
    return components.flatMap((comp) => {
      if (!comp.parentId) {
        return [
          {
            ruleId: "c4/component-inside-container",
            severity: "error",
            message: `${comp.type} "${comp.name ?? comp.id}" has no parent Container.`,
            elementId: comp.id,
            elementType: comp.type
          }
        ];
      }
      const parent = nodeById.get(comp.parentId);
      if (!parent || !isContainer(parent)) {
        return [
          {
            ruleId: "c4/component-inside-container",
            severity: "error",
            message: `${comp.type} "${comp.name ?? comp.id}" must be inside a Container, but its parent is "${parent?.type ?? "unknown"}".`,
            elementId: comp.id,
            elementType: comp.type
          }
        ];
      }
      return [];
    });
  }
};

// src/c4/rules/no-direct-person-to-component.ts
var noDirectPersonToComponent = {
  id: "c4/no-direct-person-to-component",
  description: "A Person must not connect directly to a Component; persons interact with Systems or Containers.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    return edges.flatMap((e) => {
      const source = nodeById.get(e.source);
      const target = nodeById.get(e.target);
      if (!source || !target) return [];
      if (!isPerson(source) || !isComponent(target)) return [];
      return [
        {
          ruleId: "c4/no-direct-person-to-component",
          severity: "error",
          message: `Person "${source.name ?? source.id}" connects directly to Component "${target.name ?? target.id}". Persons should interact with Systems or Containers.`,
          elementId: e.id
        }
      ];
    });
  }
};

// src/c4/rules/person-interacts.ts
var personInteracts = {
  id: "c4/person-interacts",
  description: "Every Person should have at least one edge connecting to another element.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const persons = nodes.filter(isPerson);
    return persons.flatMap((p) => {
      const connected = edges.some((e) => e.source === p.id || e.target === p.id);
      if (connected) return [];
      return [
        {
          ruleId: "c4/person-interacts",
          severity: "warning",
          message: `Person "${p.name ?? p.id}" has no interactions.`,
          elementId: p.id,
          elementType: p.type
        }
      ];
    });
  }
};

// src/c4/rules/system-has-description.ts
var systemHasDescription = {
  id: "c4/system-has-description",
  description: "Internal SoftwareSystems should have a description.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => n.type === "SoftwareSystem" && !n.isExternal).filter((n) => !n.description || n.description.trim() === "").map((n) => ({
      ruleId: "c4/system-has-description",
      severity: "warning",
      message: `SoftwareSystem "${n.name ?? n.id}" has no description.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/c4/rules/technology-specified.ts
var technologySpecified = {
  id: "c4/technology-specified",
  description: "Containers and Components should specify the technology used.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes.filter((n) => isContainer(n) || isComponent(n)).filter((n) => !n.technology || n.technology.trim() === "").map((n) => ({
      ruleId: "c4/technology-specified",
      severity: "info",
      message: `${n.type} "${n.name ?? n.id}" has no technology specified.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/c4/rules/element-has-description.ts
var elementHasDescription = {
  id: "c4/element-has-description",
  description: "All elements should have a description (optional for Persons).",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes.filter((n) => !isPerson(n)).filter((n) => !n.description || n.description.trim() === "").map((n) => ({
      ruleId: "c4/element-has-description",
      severity: "info",
      message: `${n.type} "${n.name ?? n.id}" has no description.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/c4/runner.ts
var C4_RULES = [
  // Structural errors
  elementHasName,
  containerInsideSystem,
  componentInsideContainer,
  noDirectPersonToComponent,
  // Best-practice warnings
  personInteracts,
  systemHasDescription,
  // Informational hints
  technologySpecified,
  elementHasDescription
];
var DEFAULT_CONFIG = {
  rules: Object.fromEntries(C4_RULES.map((r) => [r.id, r.defaultSeverity]))
};
function runC4Lint(diagram, config = {}) {
  const merged = {
    rules: { ...DEFAULT_CONFIG.rules, ...config.rules }
  };
  return runRules(diagram, C4_RULES, merged, { ...config.bus !== void 0 ? { bus: config.bus } : {} });
}

exports.C4_RULES = C4_RULES;
exports.isComponent = isComponent;
exports.isContainer = isContainer;
exports.isPerson = isPerson;
exports.isSystem = isSystem;
exports.runC4Lint = runC4Lint;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map