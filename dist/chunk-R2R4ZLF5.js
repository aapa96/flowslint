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
function filterIssues(result, options = {}) {
  return result.issues.filter((issue) => {
    if (options.severity && issue.severity !== options.severity) return false;
    if (options.elementId && issue.elementId !== options.elementId) return false;
    return true;
  });
}

export { filterIssues, runRules };
//# sourceMappingURL=chunk-R2R4ZLF5.js.map
//# sourceMappingURL=chunk-R2R4ZLF5.js.map