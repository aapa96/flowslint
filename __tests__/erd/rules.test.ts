import { describe, it, expect } from "vitest";
import { runErdLint } from "../../src/erd/runner";
import type { ErdDiagram } from "../../src/erd/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasIssue(d: ErdDiagram, ruleId: string): boolean {
  return runErdLint(d).issues.some((i) => i.ruleId === ruleId);
}

function passes(d: ErdDiagram, ruleId: string): boolean {
  return !hasIssue(d, ruleId);
}

// ── Minimal valid ERD ──────────────────────────────────────────────────────────

const minimal: ErdDiagram = {
  nodes: [
    { id: "e1", type: "Entity",   name: "Customer", attributes: [{ name: "id", isPrimaryKey: true }] },
    { id: "e2", type: "Entity",   name: "Order",    attributes: [{ name: "orderId", isPrimaryKey: true }] },
    { id: "r1", type: "Relationship", name: "Places" },
  ],
  edges: [
    { id: "p1", type: "participatesIn", source: "e1", target: "r1" },
    { id: "p2", type: "participatesIn", source: "e2", target: "r1" },
  ],
};

// ── 1. entity-has-primary-key ─────────────────────────────────────────────────

describe("erd/entity-has-primary-key", () => {
  const RULE = "erd/entity-has-primary-key";

  it("passes when entity has an inline primary key attribute", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("passes when entity has a connected PrimaryKey node", () => {
    const d: ErdDiagram = {
      nodes: [
        { id: "e1", type: "Entity", name: "Product" },
        { id: "pk", type: "PrimaryKey", name: "productId" },
      ],
      edges: [{ id: "a1", type: "hasAttribute", source: "e1", target: "pk" }],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when entity has no primary key", () => {
    const d: ErdDiagram = {
      nodes: [{ id: "e1", type: "Entity", name: "Orphan" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("also checks WeakEntity", () => {
    const d: ErdDiagram = {
      nodes: [{ id: "e1", type: "WeakEntity", name: "OrderLine" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 2. relationship-has-entities ──────────────────────────────────────────────

describe("erd/relationship-has-entities", () => {
  const RULE = "erd/relationship-has-entities";

  it("passes when relationship has 2 participating entities", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when relationship has fewer than 2 participants", () => {
    const d: ErdDiagram = {
      nodes: [
        { id: "e1", type: "Entity", name: "Customer", attributes: [{ name: "id", isPrimaryKey: true }] },
        { id: "r1", type: "Relationship", name: "Alone" },
      ],
      edges: [{ id: "p1", type: "participatesIn", source: "e1", target: "r1" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when relationship has no participants at all", () => {
    const d: ErdDiagram = {
      nodes: [{ id: "r1", type: "Relationship", name: "NoOne" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 3. no-orphan-attribute ────────────────────────────────────────────────────

describe("erd/no-orphan-attribute", () => {
  const RULE = "erd/no-orphan-attribute";

  it("passes when all attribute nodes are connected via hasAttribute", () => {
    const d: ErdDiagram = {
      nodes: [
        { id: "e1", type: "Entity", name: "User" },
        { id: "a1", type: "Attribute", name: "email" },
      ],
      edges: [{ id: "h1", type: "hasAttribute", source: "e1", target: "a1" }],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when an attribute node has no hasAttribute edge pointing to it", () => {
    const d: ErdDiagram = {
      nodes: [{ id: "a1", type: "Attribute", name: "floating" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("checks all attribute subtypes (MultivaluedAttribute, DerivedAttribute, etc.)", () => {
    const d: ErdDiagram = {
      nodes: [
        { id: "a1", type: "MultivaluedAttribute", name: "phones" },
        { id: "a2", type: "DerivedAttribute",     name: "age" },
      ],
      edges: [],
    };
    const issues = runErdLint(d).issues.filter((i) => i.ruleId === RULE);
    expect(issues).toHaveLength(2);
  });
});

// ── 4. entity-connected ───────────────────────────────────────────────────────

describe("erd/entity-connected", () => {
  const RULE = "erd/entity-connected";

  it("passes when entity participates in at least one relationship", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when entity has no participatesIn edge", () => {
    const d: ErdDiagram = {
      nodes: [{ id: "e1", type: "Entity", name: "Isolated", attributes: [{ name: "id", isPrimaryKey: true }] }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 5. entity-has-name ────────────────────────────────────────────────────────

describe("erd/entity-has-name", () => {
  const RULE = "erd/entity-has-name";

  it("passes when all entities and relationships have names", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when an entity has no name", () => {
    const d: ErdDiagram = {
      nodes: [{ id: "e1", type: "Entity" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when a relationship has no name", () => {
    const d: ErdDiagram = {
      nodes: [{ id: "r1", type: "Relationship" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 6. attribute-has-name ─────────────────────────────────────────────────────

describe("erd/attribute-has-name", () => {
  const RULE = "erd/attribute-has-name";

  it("passes when attribute has a name", () => {
    const d: ErdDiagram = {
      nodes: [
        { id: "e1", type: "Entity", name: "User" },
        { id: "a1", type: "Attribute", name: "email" },
      ],
      edges: [{ id: "h1", type: "hasAttribute", source: "e1", target: "a1" }],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when attribute has no name", () => {
    const d: ErdDiagram = {
      nodes: [
        { id: "e1", type: "Entity", name: "User" },
        { id: "a1", type: "Attribute" },
      ],
      edges: [{ id: "h1", type: "hasAttribute", source: "e1", target: "a1" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 7. relationship-has-name ──────────────────────────────────────────────────

describe("erd/relationship-has-name", () => {
  const RULE = "erd/relationship-has-name";

  it("passes when relationship has a name", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when relationship has no name (info severity)", () => {
    const d: ErdDiagram = {
      nodes: [{ id: "r1", type: "Relationship" }],
      edges: [],
    };
    const issues = runErdLint(d).issues.filter((i) => i.ruleId === RULE);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("info");
  });
});

// ── runErdLint config override ────────────────────────────────────────────────

describe("runErdLint config", () => {
  it("allows disabling a rule", () => {
    const d: ErdDiagram = { nodes: [{ id: "e1", type: "Entity", name: "NoKey" }], edges: [] };
    const result = runErdLint(d, { rules: { "erd/entity-has-primary-key": "off" } });
    expect(result.issues.some((i) => i.ruleId === "erd/entity-has-primary-key")).toBe(false);
  });
});
