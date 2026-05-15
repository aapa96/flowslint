import { runRules } from './chunk-R2R4ZLF5.js';

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

// src/erd/rules/no-duplicate-entity-names.ts
var noDuplicateEntityNames = {
  id: "erd/no-duplicate-entity-names",
  description: "Two entities must not share the same name.",
  defaultSeverity: "error",
  check({ nodes }) {
    const seen = /* @__PURE__ */ new Map();
    const issues = [];
    for (const node of nodes.filter(isEntity)) {
      const name = node.name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        issues.push({
          ruleId: "erd/no-duplicate-entity-names",
          severity: "error",
          message: `Duplicate entity name "${name}": also used by "${existing}".`,
          elementId: node.id,
          elementType: node.type,
          relatedElementIds: [existing]
        });
      } else {
        seen.set(key, node.id);
      }
    }
    return issues;
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

// src/erd/rules/relationship-has-cardinality.ts
var relationshipHasCardinality = {
  id: "erd/relationship-has-cardinality",
  description: "Each participation edge should declare a cardinality (1, N, or M).",
  defaultSeverity: "warning",
  check({ edges }) {
    return edges.filter(
      (e) => e.type === "participatesIn" && (!e.sourceCardinality || !e.targetCardinality)
    ).map((e) => ({
      ruleId: "erd/relationship-has-cardinality",
      severity: "warning",
      message: `Participation edge "${e.id}" is missing cardinality (source: ${e.sourceCardinality ?? "?"}, target: ${e.targetCardinality ?? "?"}).`,
      elementId: e.id,
      elementType: e.type,
      relatedElementIds: [e.source, e.target]
    }));
  }
};

// src/erd/rules/field-has-type.ts
var fieldHasType = {
  id: "erd/field-has-type",
  description: "Every attribute should declare a data type.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const issues = [];
    for (const node of nodes.filter(isAttribute)) {
      if (!node.dataType?.trim()) {
        issues.push({
          ruleId: "erd/field-has-type",
          severity: "warning",
          message: `Attribute "${node.name ?? node.id}" has no data type.`,
          elementId: node.id,
          elementType: node.type
        });
      }
    }
    for (const entity of nodes.filter(isEntity)) {
      for (const attr of entity.attributes ?? []) {
        if (!attr.dataType?.trim()) {
          issues.push({
            ruleId: "erd/field-has-type",
            severity: "warning",
            message: `Attribute "${attr.name}" on entity "${entity.name ?? entity.id}" has no data type.`,
            elementId: entity.id,
            elementType: entity.type
          });
        }
      }
    }
    return issues;
  }
};

// src/erd/rules/foreign-key-references-pk.ts
var foreignKeyReferencesPk = {
  id: "erd/foreign-key-references-pk",
  description: "Foreign key attributes must match a primary key name on another entity.",
  defaultSeverity: "warning",
  check({ nodes }) {
    const issues = [];
    const entities = nodes.filter(isEntity);
    const pkNames = /* @__PURE__ */ new Set();
    for (const entity of entities) {
      for (const attr of entity.attributes ?? []) {
        if (attr.isPrimaryKey && attr.name) pkNames.add(attr.name.toLowerCase());
      }
    }
    for (const entity of entities) {
      for (const attr of entity.attributes ?? []) {
        if (!attr.isForeignKey) continue;
        if (!attr.name || !pkNames.has(attr.name.toLowerCase())) {
          issues.push({
            ruleId: "erd/foreign-key-references-pk",
            severity: "warning",
            message: `Foreign key "${attr.name}" on entity "${entity.name ?? entity.id}" does not match any primary key name.`,
            elementId: entity.id,
            elementType: entity.type
          });
        }
      }
    }
    return issues;
  }
};

// src/erd/rules/no-self-relationship.ts
var noSelfRelationship = {
  id: "erd/no-self-relationship",
  description: "Relationships should connect at least two distinct entities.",
  defaultSeverity: "warning",
  check({ nodes, edges }) {
    const issues = [];
    for (const rel of nodes.filter(isRelationship)) {
      const participatingEntities = edges.filter((e) => e.type === "participatesIn" && e.target === rel.id).map((e) => e.source);
      const distinct = new Set(participatingEntities);
      if (distinct.size === 1 && participatingEntities.length > 1) {
        issues.push({
          ruleId: "erd/no-self-relationship",
          severity: "warning",
          message: `Relationship "${rel.name ?? rel.id}" connects the same entity to itself on all sides.`,
          elementId: rel.id,
          elementType: rel.type,
          relatedElementIds: [...distinct]
        });
      }
    }
    return issues;
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
  noDuplicateEntityNames,
  // Best-practice warnings
  entityConnected,
  entityHasName,
  attributeHasName,
  relationshipHasCardinality,
  fieldHasType,
  foreignKeyReferencesPk,
  noSelfRelationship,
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
  return runRules(diagram, ERD_RULES, merged, { ...config.bus !== void 0 ? { bus: config.bus } : {} });
}

export { ERD_RULES, isAttribute, isEntity, isRelationship, runErdLint };
//# sourceMappingURL=chunk-7L3LT4MA.js.map
//# sourceMappingURL=chunk-7L3LT4MA.js.map