import { describe, it, expect } from "vitest";
import { runC4Lint } from "../../src/c4/runner";
import type { C4Diagram } from "../../src/c4/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasIssue(d: C4Diagram, ruleId: string): boolean {
  return runC4Lint(d).issues.some((i) => i.ruleId === ruleId);
}

function passes(d: C4Diagram, ruleId: string): boolean {
  return !hasIssue(d, ruleId);
}

function issuesFor(d: C4Diagram, ruleId: string) {
  return runC4Lint(d).issues.filter((i) => i.ruleId === ruleId);
}

// ── Minimal valid C4 context diagram ─────────────────────────────────────────

const minimalContext: C4Diagram = {
  level: "context",
  nodes: [
    { id: "u1",  type: "Person",         name: "Customer",      description: "A user" },
    { id: "s1",  type: "SoftwareSystem", name: "E-Commerce App", description: "The main system" },
  ],
  edges: [
    { id: "e1", type: "uses", source: "u1", target: "s1", label: "Browses" },
  ],
};

// ── 1. element-has-name ───────────────────────────────────────────────────────

describe("c4/element-has-name", () => {
  const RULE = "c4/element-has-name";

  it("passes when all elements have names", () => {
    expect(passes(minimalContext, RULE)).toBe(true);
  });

  it("fires when an element has no name", () => {
    const d: C4Diagram = {
      level: "context",
      nodes: [{ id: "s1", type: "SoftwareSystem" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when element name is only whitespace", () => {
    const d: C4Diagram = {
      level: "context",
      nodes: [{ id: "s1", type: "SoftwareSystem", name: "   " }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 2. container-inside-system ────────────────────────────────────────────────

describe("c4/container-inside-system", () => {
  const RULE = "c4/container-inside-system";

  it("passes when container's parent is a SoftwareSystem", () => {
    const d: C4Diagram = {
      level: "container",
      nodes: [
        { id: "s1", type: "SoftwareSystem", name: "My App", description: "Core system" },
        { id: "c1", type: "Container", name: "Web App", description: "Frontend", technology: "React", parentId: "s1" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when container has no parentId", () => {
    const d: C4Diagram = {
      level: "container",
      nodes: [{ id: "c1", type: "Container", name: "Web App", description: "Frontend", technology: "React" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when container's parent is not a SoftwareSystem", () => {
    const d: C4Diagram = {
      level: "container",
      nodes: [
        { id: "p1", type: "Person", name: "User" },
        { id: "c1", type: "Container", name: "Web App", description: "x", technology: "React", parentId: "p1" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("accepts Database as a valid container type", () => {
    const d: C4Diagram = {
      level: "container",
      nodes: [
        { id: "s1", type: "SoftwareSystem", name: "My App", description: "x" },
        { id: "db", type: "Database", name: "Postgres", description: "x", technology: "PostgreSQL", parentId: "s1" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });
});

// ── 3. component-inside-container ────────────────────────────────────────────

describe("c4/component-inside-container", () => {
  const RULE = "c4/component-inside-container";

  it("passes when component's parent is a Container", () => {
    const d: C4Diagram = {
      level: "component",
      nodes: [
        { id: "s1", type: "SoftwareSystem", name: "App", description: "x" },
        { id: "c1", type: "Container",  name: "API",        description: "x", technology: "Node", parentId: "s1" },
        { id: "co", type: "Component",  name: "AuthService", description: "x", technology: "JWT",  parentId: "c1" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when component has no parentId", () => {
    const d: C4Diagram = {
      level: "component",
      nodes: [{ id: "co", type: "Component", name: "AuthService", description: "x", technology: "JWT" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("fires when component's parent is a SoftwareSystem (skipped a level)", () => {
    const d: C4Diagram = {
      level: "component",
      nodes: [
        { id: "s1", type: "SoftwareSystem", name: "App", description: "x" },
        { id: "co", type: "Component", name: "AuthService", description: "x", technology: "JWT", parentId: "s1" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 4. no-direct-person-to-component ─────────────────────────────────────────

describe("c4/no-direct-person-to-component", () => {
  const RULE = "c4/no-direct-person-to-component";

  it("passes when person connects to a SoftwareSystem", () => {
    expect(passes(minimalContext, RULE)).toBe(true);
  });

  it("fires when person directly connects to a Component", () => {
    const d: C4Diagram = {
      level: "component",
      nodes: [
        { id: "u1", type: "Person",    name: "User" },
        { id: "co", type: "Component", name: "AuthService", description: "x", technology: "JWT" },
      ],
      edges: [{ id: "e1", type: "uses", source: "u1", target: "co", label: "Calls" }],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("passes when person connects to a Container", () => {
    const d: C4Diagram = {
      level: "container",
      nodes: [
        { id: "u1", type: "Person",    name: "User" },
        { id: "c1", type: "Container", name: "Web App", description: "x", technology: "React" },
      ],
      edges: [{ id: "e1", type: "uses", source: "u1", target: "c1", label: "Uses" }],
    };
    expect(passes(d, RULE)).toBe(true);
  });
});

// ── 5. person-interacts ───────────────────────────────────────────────────────

describe("c4/person-interacts", () => {
  const RULE = "c4/person-interacts";

  it("passes when person has at least one edge", () => {
    expect(passes(minimalContext, RULE)).toBe(true);
  });

  it("fires when person has no edges", () => {
    const d: C4Diagram = {
      level: "context",
      nodes: [
        { id: "u1", type: "Person",         name: "Ghost User" },
        { id: "s1", type: "SoftwareSystem", name: "App", description: "x" },
      ],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("also checks ExternalPerson", () => {
    const d: C4Diagram = {
      level: "context",
      nodes: [{ id: "ep", type: "ExternalPerson", name: "Partner" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });
});

// ── 6. system-has-description ─────────────────────────────────────────────────

describe("c4/system-has-description", () => {
  const RULE = "c4/system-has-description";

  it("passes when internal SoftwareSystem has a description", () => {
    expect(passes(minimalContext, RULE)).toBe(true);
  });

  it("fires when internal SoftwareSystem has no description", () => {
    const d: C4Diagram = {
      level: "context",
      nodes: [{ id: "s1", type: "SoftwareSystem", name: "App" }],
      edges: [],
    };
    expect(hasIssue(d, RULE)).toBe(true);
  });

  it("does not fire for ExternalSystem (isExternal)", () => {
    const d: C4Diagram = {
      level: "context",
      nodes: [{ id: "s1", type: "SoftwareSystem", name: "Payment Gateway", isExternal: true }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });
});

// ── 7. technology-specified ───────────────────────────────────────────────────

describe("c4/technology-specified", () => {
  const RULE = "c4/technology-specified";

  it("passes when containers and components have technology", () => {
    const d: C4Diagram = {
      level: "container",
      nodes: [
        { id: "s1", type: "SoftwareSystem", name: "App", description: "x" },
        { id: "c1", type: "Container",  name: "API", description: "x", technology: "Node.js", parentId: "s1" },
      ],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });

  it("fires when a container has no technology (info)", () => {
    const d: C4Diagram = {
      level: "container",
      nodes: [
        { id: "s1", type: "SoftwareSystem", name: "App", description: "x" },
        { id: "c1", type: "Container", name: "API", description: "x", parentId: "s1" },
      ],
      edges: [],
    };
    const issues = issuesFor(d, RULE);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("info");
  });
});

// ── 8. element-has-description ────────────────────────────────────────────────

describe("c4/element-has-description", () => {
  const RULE = "c4/element-has-description";

  it("passes when non-Person elements have a description", () => {
    expect(passes(minimalContext, RULE)).toBe(true);
  });

  it("fires when a SoftwareSystem has no description (info)", () => {
    const d: C4Diagram = {
      level: "context",
      nodes: [{ id: "s1", type: "SoftwareSystem", name: "App" }],
      edges: [],
    };
    const issues = issuesFor(d, RULE);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("info");
  });

  it("does not fire for Person nodes (they are exempt)", () => {
    const d: C4Diagram = {
      level: "context",
      nodes: [{ id: "u1", type: "Person", name: "User" }],
      edges: [],
    };
    expect(passes(d, RULE)).toBe(true);
  });
});

// ── runC4Lint config override ─────────────────────────────────────────────────

describe("runC4Lint config", () => {
  it("allows disabling a rule", () => {
    const d: C4Diagram = {
      level: "context",
      nodes: [{ id: "s1", type: "SoftwareSystem", name: "App" }],
      edges: [],
    };
    const result = runC4Lint(d, { rules: { "c4/system-has-description": "off" } });
    expect(result.issues.some((i) => i.ruleId === "c4/system-has-description")).toBe(false);
  });

  it("allows promoting info rules to error", () => {
    const d: C4Diagram = {
      level: "container",
      nodes: [{ id: "c1", type: "Container", name: "API", description: "x", parentId: "s1" }],
      edges: [],
    };
    const result = runC4Lint(d, { rules: { "c4/technology-specified": "error" } });
    const techIssue = result.issues.find((i) => i.ruleId === "c4/technology-specified");
    expect(techIssue?.severity).toBe("error");
  });
});
