'use strict';

// src/core/runner.ts
function runRules(diagram, rules, config) {
  const issues = [];
  for (const rule of rules) {
    const override = config.rules?.[rule.id];
    if (override === "off") continue;
    const severity = override ?? rule.defaultSeverity;
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
    for (const issue of found) {
      const enriched = {
        ...issue,
        code: issue.code ?? rule.id,
        severity
      };
      if (!enriched.category && rule.category) enriched.category = rule.category;
      if (!enriched.docsUrl && rule.docsUrl) enriched.docsUrl = rule.docsUrl;
      issues.push(enriched);
    }
  }
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;
  return { issues, errors, warnings, infos, passed: errors === 0 };
}

// src/erd/types.ts
function isEntity(n) {
  return n.type === "Entity" || n.type === "WeakEntity";
}
function isAttribute(n) {
  return n.type === "Attribute" || n.type === "PrimaryKey" || n.type === "MultivaluedAttribute" || n.type === "DerivedAttribute" || n.type === "CompositeAttribute";
}
function isRelationship(n) {
  return n.type === "Relationship" || n.type === "WeakRelationship";
}

// src/erd/rules/entity-has-primary-key.ts
var entityHasPrimaryKey = {
  id: "erd/entity-has-primary-key",
  description: "Every Entity and WeakEntity must have at least one primary key attribute.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const entities = nodes.filter(isEntity);
    return entities.flatMap((entity) => {
      const inlinePk = entity.attributes?.some((a) => a.isPrimaryKey) ?? false;
      if (inlinePk) return [];
      const hasPkNode = edges.some(
        (e) => e.type === "hasAttribute" && e.source === entity.id && nodes.find((n) => n.id === e.target)?.type === "PrimaryKey"
      );
      if (hasPkNode) return [];
      return [
        {
          ruleId: "erd/entity-has-primary-key",
          severity: "error",
          message: `Entity "${entity.name ?? entity.id}" has no primary key.`,
          elementId: entity.id,
          elementType: entity.type
        }
      ];
    });
  }
};

// src/erd/rules/relationship-has-entities.ts
var relationshipHasEntities = {
  id: "erd/relationship-has-entities",
  description: "Every Relationship must have at least two entities connected via participatesIn edges.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const relationships = nodes.filter(isRelationship);
    return relationships.flatMap((rel) => {
      const participantCount = edges.filter(
        (e) => e.type === "participatesIn" && e.target === rel.id
      ).length;
      if (participantCount >= 2) return [];
      return [
        {
          ruleId: "erd/relationship-has-entities",
          severity: "error",
          message: `Relationship "${rel.name ?? rel.id}" has fewer than 2 participating entities (found ${participantCount}).`,
          elementId: rel.id,
          elementType: rel.type
        }
      ];
    });
  }
};

// src/erd/rules/no-orphan-attribute.ts
var noOrphanAttribute = {
  id: "erd/no-orphan-attribute",
  description: "Every attribute node must be connected to an entity or relationship via a hasAttribute edge.",
  defaultSeverity: "error",
  check({ nodes, edges }) {
    const attributeNodes = nodes.filter(isAttribute);
    return attributeNodes.flatMap((attr) => {
      const isConnected = edges.some(
        (e) => e.type === "hasAttribute" && e.target === attr.id
      );
      if (isConnected) return [];
      return [
        {
          ruleId: "erd/no-orphan-attribute",
          severity: "error",
          message: `Attribute "${attr.name ?? attr.id}" is not connected to any entity or relationship.`,
          elementId: attr.id,
          elementType: attr.type
        }
      ];
    });
  }
};

// src/erd/rules/entity-connected.ts
var entityConnected = {
  id: "erd/entity-connected",
  description: "Every Entity should participate in at least one Relationship.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const entities = nodes.filter(isEntity);
    return entities.flatMap((entity) => {
      const participates = edges.some(
        (e) => e.type === "participatesIn" && e.source === entity.id
      );
      if (participates) return [];
      return [
        {
          ruleId: "erd/entity-connected",
          severity: "warning",
          message: `Entity "${entity.name ?? entity.id}" does not participate in any relationship.`,
          elementId: entity.id,
          elementType: entity.type
        }
      ];
    });
  }
};

// src/erd/rules/entity-has-name.ts
var entityHasName = {
  id: "erd/entity-has-name",
  description: "Entities and Relationships should have a non-empty name.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter((n) => isEntity(n) || isRelationship(n)).filter((n) => !n.name || n.name.trim() === "").map((n) => ({
      ruleId: "erd/entity-has-name",
      severity: "warning",
      message: `${n.type} "${n.id}" has no name.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/erd/rules/attribute-has-name.ts
var attributeHasName = {
  id: "erd/attribute-has-name",
  description: "Attribute nodes should have a non-empty name.",
  defaultSeverity: "warning",
  check({ nodes }) {
    return nodes.filter(isAttribute).filter((n) => !n.name || n.name.trim() === "").map((n) => ({
      ruleId: "erd/attribute-has-name",
      severity: "warning",
      message: `Attribute "${n.id}" has no name.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/erd/rules/relationship-has-name.ts
var relationshipHasName = {
  id: "erd/relationship-has-name",
  description: "Relationships should have a name to document the type of association.",
  defaultSeverity: "info",
  check({ nodes }) {
    return nodes.filter(isRelationship).filter((n) => !n.name || n.name.trim() === "").map((n) => ({
      ruleId: "erd/relationship-has-name",
      severity: "info",
      message: `Relationship "${n.id}" has no name.`,
      elementId: n.id,
      elementType: n.type
    }));
  }
};

// src/erd/runner.ts
var ERD_RULES = [
  // Structural errors
  entityHasPrimaryKey,
  relationshipHasEntities,
  noOrphanAttribute,
  // Best-practice warnings
  entityConnected,
  entityHasName,
  attributeHasName,
  // Informational hints
  relationshipHasName
];
var DEFAULT_CONFIG = {
  rules: Object.fromEntries(ERD_RULES.map((r) => [r.id, r.defaultSeverity]))
};
function runErdLint(diagram, config = {}) {
  const merged = {
    rules: { ...DEFAULT_CONFIG.rules, ...config.rules }
  };
  return runRules(diagram, ERD_RULES, merged);
}

exports.ERD_RULES = ERD_RULES;
exports.isAttribute = isAttribute;
exports.isEntity = isEntity;
exports.isRelationship = isRelationship;
exports.runErdLint = runErdLint;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map