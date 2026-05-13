import { describe, it, expect } from "vitest";
import { runRules, filterIssues } from "../../src/core/runner";
import type { LintRule, LintConfig, LintIssue } from "../../src/core/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

type Diagram = { value: number };

const passRule: LintRule<Diagram> = {
  id: "test/always-pass",
  description: "Always passes",
  defaultSeverity: "error",
  check: () => [],
};

const errorRule: LintRule<Diagram> = {
  id: "test/always-error",
  description: "Always fires an error",
  defaultSeverity: "error",
  check: () => [{ ruleId: "test/always-error", severity: "error", message: "Error", elementId: "n1" }],
};

const warnRule: LintRule<Diagram> = {
  id: "test/always-warn",
  description: "Always fires a warning",
  defaultSeverity: "warning",
  check: () => [{ ruleId: "test/always-warn", severity: "warning", message: "Warn" }],
};

const throwingRule: LintRule<Diagram> = {
  id: "test/throws",
  description: "Throws during check",
  defaultSeverity: "error",
  check: () => { throw new Error("unexpected!"); },
};

const config: LintConfig = {
  rules: {
    "test/always-pass": "error",
    "test/always-error": "error",
    "test/always-warn": "warning",
    "test/throws": "error",
  },
};

const diagram: Diagram = { value: 0 };

// ── runRules ──────────────────────────────────────────────────────────────────

describe("runRules", () => {
  it("returns no issues for a passing rule", () => {
    const result = runRules(diagram, [passRule], config);
    expect(result.issues).toHaveLength(0);
    expect(result.errors).toBe(0);
    expect(result.passed).toBe(true);
  });

  it("collects issues from a failing rule", () => {
    const result = runRules(diagram, [errorRule], config);
    expect(result.issues).toHaveLength(1);
    expect(result.errors).toBe(1);
    expect(result.passed).toBe(false);
  });

  it("counts warnings and infos separately from errors", () => {
    const result = runRules(diagram, [errorRule, warnRule], config);
    expect(result.errors).toBe(1);
    expect(result.warnings).toBe(1);
    expect(result.infos).toBe(0);
    expect(result.passed).toBe(false);
  });

  it("skips rules whose severity is 'off'", () => {
    const offConfig: LintConfig = { rules: { "test/always-error": "off" } };
    const result = runRules(diagram, [errorRule], offConfig);
    expect(result.issues).toHaveLength(0);
    expect(result.passed).toBe(true);
  });

  it("respects severity override — demotes error to warning", () => {
    const warnOverride: LintConfig = { rules: { "test/always-error": "warning" } };
    const result = runRules(diagram, [errorRule], warnOverride);
    expect(result.issues[0].severity).toBe("warning");
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(1);
    expect(result.passed).toBe(true);
  });

  it("catches a throwing rule and reports it as an error", () => {
    const throwConfig: LintConfig = { rules: { "test/throws": "error" } };
    const result = runRules(diagram, [throwingRule], throwConfig);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe("error");
    expect(result.issues[0].message).toContain("test/throws");
  });

  it("returns passed:true when only warnings exist", () => {
    const result = runRules(diagram, [warnRule], config);
    expect(result.passed).toBe(true);
    expect(result.warnings).toBe(1);
  });

  it("handles an empty rules array", () => {
    const result = runRules(diagram, [], config);
    expect(result.issues).toHaveLength(0);
    expect(result.passed).toBe(true);
  });
});

// ── filterIssues ──────────────────────────────────────────────────────────────

describe("filterIssues", () => {
  const issues: LintIssue[] = [
    { ruleId: "r1", severity: "error",   message: "E1", elementId: "n1" },
    { ruleId: "r2", severity: "warning", message: "W1", elementId: "n2" },
    { ruleId: "r3", severity: "info",    message: "I1" },
    { ruleId: "r4", severity: "error",   message: "E2", elementId: "n1" },
  ];
  const result = {
    issues,
    errors: 2,
    warnings: 1,
    infos: 1,
    passed: false,
  };

  it("returns all issues when no filter is given", () => {
    expect(filterIssues(result)).toHaveLength(4);
  });

  it("filters by severity", () => {
    expect(filterIssues(result, { severity: "error" })).toHaveLength(2);
    expect(filterIssues(result, { severity: "warning" })).toHaveLength(1);
    expect(filterIssues(result, { severity: "info" })).toHaveLength(1);
  });

  it("filters by elementId", () => {
    const filtered = filterIssues(result, { elementId: "n1" });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((i) => i.elementId === "n1")).toBe(true);
  });

  it("combines severity and elementId filters", () => {
    const filtered = filterIssues(result, { severity: "error", elementId: "n1" });
    expect(filtered).toHaveLength(2);
  });

  it("returns empty array when no issues match", () => {
    expect(filterIssues(result, { elementId: "nonexistent" })).toHaveLength(0);
  });
});
