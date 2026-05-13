import { describe, it, expect } from "vitest";
import { runUmlLint } from "../../src/uml/runner";
import type { UmlDiagram } from "../../src/uml/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasIssue(d: UmlDiagram, ruleId: string): boolean {
  return runUmlLint(d).issues.some((i) => i.ruleId === ruleId);
}

function passes(d: UmlDiagram, ruleId: string): boolean {
  return !hasIssue(d, ruleId);
}

function issuesFor(d: UmlDiagram, ruleId: string) {
  return runUmlLint(d).issues.filter((i) => i.ruleId === ruleId);
}

// ── Minimal valid UML diagram ─────────────────────────────────────────────────

const minimal: UmlDiagram = {
  nodes: [
    { id: "c1", type: "Class", name: "Order" },
    { id: "c2", type: "Class", name: "Customer" },
  ],
  edges: [
    { id: "e1", type: "association", source: "c1", target: "c2" },
  ],
};

// ── 1. class-has-name ─────────────────────────────────────────────────────────

describe("uml/class-has-name", () => {
  const RULE = "uml/class-has-name";

  it("passes when all classifiers have names", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when a Class has no name", () => {
    const d: UmlDiagram = {
      nodes: [{ id: "c1", type: "Class" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when an Interface has no name", () => {
    const d: UmlDiagram = {
      nodes: [{ id: "i1", type: "Interface" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when an Enumeration has no name", () => {
    const d: UmlDiagram = {
      nodes: [{ id: "e1", type: "Enumeration" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("does not fire for Package nodes (not a classifier)", () => {
    const d: UmlDiagram = {
      nodes: [{ id: "p1", type: "Package" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });
});

// ── 2. no-circular-inheritance ────────────────────────────────────────────────

describe("uml/no-circular-inheritance", () => {
  const RULE = "uml/no-circular-inheritance";

  it("passes for a linear inheritance chain", () => {
    const d: UmlDiagram = {
      nodes: [
        { id: "a", type: "Class", name: "Animal" },
        { id: "b", type: "Class", name: "Dog" },
        { id: "c", type: "Class", name: "Poodle" },
      ],
      edges: [
        { id: "e1", type: "inheritance", source: "b", target: "a" },
        { id: "e2", type: "inheritance", source: "c", target: "b" },
      ],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when a class directly inherits from itself", () => {
    const d: UmlDiagram = {
      nodes: [{ id: "a", type: "Class", name: "Recursive" }],
      edges: [{ id: "e1", type: "inheritance", source: "a", target: "a" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when a cycle spans multiple classes (A→B→A)", () => {
    const d: UmlDiagram = {
      nodes: [
        { id: "a", type: "Class", name: "A" },
        { id: "b", type: "Class", name: "B" },
      ],
      edges: [
        { id: "e1", type: "inheritance", source: "a", target: "b" },
        { id: "e2", type: "inheritance", source: "b", target: "a" },
      ],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 3. realization-target-is-interface ───────────────────────────────────────

describe("uml/realization-target-is-interface", () => {
  const RULE = "uml/realization-target-is-interface";

  it("passes when realization edge targets an Interface", () => {
    const d: UmlDiagram = {
      nodes: [
        { id: "c1", type: "Class",     name: "PdfReport" },
        { id: "i1", type: "Interface", name: "IReportable" },
      ],
      edges: [{ id: "r1", type: "realization", source: "c1", target: "i1" }],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when realization edge targets a Class instead of an Interface", () => {
    const d: UmlDiagram = {
      nodes: [
        { id: "c1", type: "Class", name: "PdfReport" },
        { id: "c2", type: "Class", name: "Report" },
      ],
      edges: [{ id: "r1", type: "realization", source: "c1", target: "c2" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 4. abstract-method-in-abstract-class ─────────────────────────────────────

describe("uml/abstract-method-in-abstract-class", () => {
  const RULE = "uml/abstract-method-in-abstract-class";

  it("passes when abstract class has at least one abstract method", () => {
    const d: UmlDiagram = {
      nodes: [{
        id: "ac",
        type: "AbstractClass",
        name: "Shape",
        methods: [{ name: "draw", isAbstract: true }],
      }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when abstract class has no abstract methods", () => {
    const d: UmlDiagram = {
      nodes: [{
        id: "ac",
        type: "AbstractClass",
        name: "Shape",
        methods: [{ name: "describe", isAbstract: false }],
      }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when abstract class has no methods at all", () => {
    const d: UmlDiagram = {
      nodes: [{ id: "ac", type: "AbstractClass", name: "Shape" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 5. class-not-isolated ─────────────────────────────────────────────────────

describe("uml/class-not-isolated", () => {
  const RULE = "uml/class-not-isolated";

  it("passes when all classifiers have at least one edge", () => {
    expect(passes(minimal, RULE)).toBe(true);
  });

  it("fires when a classifier has no edges", () => {
    const d: UmlDiagram = {
      nodes: [{ id: "c1", type: "Class", name: "Isolated" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 6. enumeration-has-literals ───────────────────────────────────────────────

describe("uml/enumeration-has-literals", () => {
  const RULE = "uml/enumeration-has-literals";

  it("passes when enumeration has at least one attribute (literal)", () => {
    const d: UmlDiagram = {
      nodes: [{
        id: "e1",
        type: "Enumeration",
        name: "Status",
        attributes: [{ name: "PENDING" }, { name: "ACTIVE" }],
      }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when enumeration has no literals", () => {
    const d: UmlDiagram = {
      nodes: [{ id: "e1", type: "Enumeration", name: "Empty" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 7. no-duplicate-attribute ─────────────────────────────────────────────────

describe("uml/no-duplicate-attribute", () => {
  const RULE = "uml/no-duplicate-attribute";

  it("passes when all attribute names within a class are unique", () => {
    const d: UmlDiagram = {
      nodes: [{
        id: "c1",
        type: "Class",
        name: "User",
        attributes: [{ name: "id" }, { name: "email" }],
      }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when a class has two attributes with the same name", () => {
    const d: UmlDiagram = {
      nodes: [{
        id: "c1",
        type: "Class",
        name: "Broken",
        attributes: [{ name: "id" }, { name: "id" }],
      }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 8. package-has-name ───────────────────────────────────────────────────────

describe("uml/package-has-name", () => {
  const RULE = "uml/package-has-name";

  it("passes when package has a name", () => {
    const d: UmlDiagram = {
      nodes: [{ id: "p1", type: "Package", name: "com.example" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when package has no name (info severity)", () => {
    const d: UmlDiagram = {
      nodes: [{ id: "p1", type: "Package" }],
      edges: [],
    };
    const issues = issuesFor(d, RULE);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("info");
  });
});

// ── runUmlLint config override ────────────────────────────────────────────────

describe("runUmlLint config", () => {
  it("allows disabling a rule", () => {
    const d: UmlDiagram = {
      nodes: [{ id: "c1", type: "Class" }],
      edges: [],
    };
    const result = runUmlLint(d, { rules: { "uml/class-has-name": "off" } });
    expect(result.issues.some((i) => i.ruleId === "uml/class-has-name")).toBe(false);
  });

  it("passed is true when only warnings and infos exist", () => {
    const d: UmlDiagram = {
      nodes: [{ id: "c1", type: "Class", name: "Isolated" }],
      edges: [],
    };
    const result = runUmlLint(d, { rules: {} });
    // class-not-isolated fires as warning, not error
    expect(result.passed).toBe(true);
    expect(result.warnings).toBeGreaterThan(0);
  });
});
