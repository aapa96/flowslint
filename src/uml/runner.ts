import { runRules } from "../core/runner";
import type { LintConfig, LintResult, LintRule } from "../core/types";
import type { LintEventBus } from "../core/events";
import type { UmlDiagram } from "./types";

import { classHasName } from "./rules/class-has-name";
import { noCircularInheritance } from "./rules/no-circular-inheritance";
import { realizationTargetIsInterface } from "./rules/realization-target-is-interface";
import { abstractMethodInAbstractClass } from "./rules/abstract-method-in-abstract-class";
import { classNotIsolated } from "./rules/class-not-isolated";
import { enumerationHasLiterals } from "./rules/enumeration-has-literals";
import { noDuplicateAttribute } from "./rules/no-duplicate-attribute";
import { packageHasName } from "./rules/package-has-name";

export const UML_RULES: LintRule<UmlDiagram>[] = [
  // Structural errors
  classHasName,
  noCircularInheritance,
  realizationTargetIsInterface,
  // Best-practice warnings
  abstractMethodInAbstractClass,
  classNotIsolated,
  enumerationHasLiterals,
  noDuplicateAttribute,
  // Informational hints
  packageHasName,
];

const DEFAULT_CONFIG: LintConfig = {
  rules: Object.fromEntries(UML_RULES.map((r) => [r.id, r.defaultSeverity])),
};

export function runUmlLint(
  diagram: UmlDiagram,
  config: Partial<LintConfig> & { bus?: LintEventBus } = {},
): LintResult {
  const merged: LintConfig = {
    rules: { ...DEFAULT_CONFIG.rules, ...config.rules },
  };
  return runRules(diagram, UML_RULES, merged, { ...(config.bus !== undefined ? { bus: config.bus } : {}) });
}
