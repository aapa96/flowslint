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
function filterIssues(result, options = {}) {
  return result.issues.filter((issue) => {
    if (options.severity && issue.severity !== options.severity) return false;
    if (options.elementId && issue.elementId !== options.elementId) return false;
    return true;
  });
}

export { filterIssues, runRules };
//# sourceMappingURL=chunk-BDH6M5BR.js.map
//# sourceMappingURL=chunk-BDH6M5BR.js.map