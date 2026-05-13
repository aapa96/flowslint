import { runRules } from "../core/runner";
import type { LintConfig, LintResult, LintRule } from "../core/types";
import type { C4Diagram } from "./types";

import { elementHasName } from "./rules/element-has-name";
import { containerInsideSystem } from "./rules/container-inside-system";
import { componentInsideContainer } from "./rules/component-inside-container";
import { noDirectPersonToComponent } from "./rules/no-direct-person-to-component";
import { personInteracts } from "./rules/person-interacts";
import { systemHasDescription } from "./rules/system-has-description";
import { technologySpecified } from "./rules/technology-specified";
import { elementHasDescription } from "./rules/element-has-description";

export const C4_RULES: LintRule<C4Diagram>[] = [
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
  elementHasDescription,
];

const DEFAULT_CONFIG: LintConfig = {
  rules: Object.fromEntries(C4_RULES.map((r) => [r.id, r.defaultSeverity])),
};

export function runC4Lint(
  diagram: C4Diagram,
  config: Partial<LintConfig> = {},
): LintResult {
  const merged: LintConfig = {
    rules: { ...DEFAULT_CONFIG.rules, ...config.rules },
  };
  return runRules(diagram, C4_RULES, merged);
}
