# @aranzatech/flowslint — Roadmap

Librería de validación y linting para diagramas BPMN, ERD, UML y C4.
Reglas puras (sin DOM, sin ReactFlow, sin React) — igual de válidas en browser,
Node.js, CI pipeline o worker thread.

Inspirada en `bpmnlint` pero generalizada para los cuatro tipos de diagrama de AranzaGroup.

---

## Principio fundamental

> **Cada regla es una función pura.**
> `(diagram: Diagram) => LintIssue[]`
>
> Sin estado, sin efectos secundarios, sin dependencias de red.

---

## Estado actual (v0.2.4)

### Resumen de implementación

| Módulo | Estado | Reglas impl. | Tests | Cobertura estimada |
|---|---|---|---|---|
| `core/` | ✅ Completo | — | ✅ | ~90% |
| `bpmn/` | ✅ Sólido | 38 reglas | ✅ | ~40% (muchas reglas sin test) |
| `erd/` | 🟡 Parcial | 7 / 9 planificadas | ✅ | ~30% |
| `uml/` | 🟡 Parcial | 8 reglas (solo class) | ✅ | ~30% |
| `c4/` | 🟡 Parcial | 8 reglas | ✅ | ~30% |

**Tests:** 174 pasando · **0 fallando** ✅

### Criterios de aceptación originales

| Criterio | Estado |
|---|---|
| Cada regla tiene ≥1 test válido e ≥1 inválido | 🟡 Parcial — aprox. 40% de reglas BPMN testeadas individualmente |
| `runBpmnLint` con diagrama vacío retorna `start-event-required` + `end-event-required` | ✅ |
| Diagrama sin nombres en tareas retorna warnings (no errors) | ✅ |
| Reglas en "off" no aparecen en resultados | ✅ |
| Override de severidad en config funciona | ✅ |
| Cero dependencias de producción | ✅ |
| `tsc --noEmit` pasa sin errores | ✅ |
| Bundle size BPMN entry point < 20 KB gzip | 🟡 No medido |

---

## Reglas BPMN — Estado detallado

### Implementadas (38 reglas)

#### Errores de estructura
| ID | Estado |
|---|---|
| `bpmn/start-event-required` | ✅ + test |
| `bpmn/end-event-required` | ✅ + test |
| `bpmn/no-orphan-edges` | ✅ + test |
| `bpmn/no-self-loop` | ✅ |
| `bpmn/no-outgoing-from-end-event` | ✅ |
| `bpmn/start-event-no-incoming` | ✅ |
| `bpmn/end-event-has-incoming` | ✅ |
| `bpmn/intermediate-event-both-flows` | ✅ |
| `bpmn/gateway-has-outgoing` | ✅ + test |
| `bpmn/gateway-has-incoming` | ✅ |
| `bpmn/flow-node-has-incoming` | ✅ |
| `bpmn/flow-node-has-outgoing` | ✅ |
| `bpmn/event-based-gateway-min-outgoing` | ✅ |
| `bpmn/event-based-gateway-valid-targets` | ✅ |
| `bpmn/end-event-reachable` | ✅ |
| `bpmn/sequence-flow-no-cross-pool` | ✅ + test |
| `bpmn/boundary-event-attached` | ✅ |
| `bpmn/subprocess-has-start-end` | ✅ |
| `bpmn/link-event-pair` | ✅ |
| `bpmn/cancel-only-in-transaction` | ✅ |
| `bpmn/choreography-has-participants` | ✅ |
| `bpmn/no-duplicate-sequence-flow` | ✅ |
| `bpmn/message-flow-valid-endpoints` | ✅ |
| `bpmn/sequence-flow-valid-endpoints` | ✅ |
| `bpmn/data-association-valid-endpoints` | ✅ |
| `bpmn/event-definition-ref-declared` | ✅ |

#### Warnings y buenas prácticas
| ID | Estado |
|---|---|
| `bpmn/no-disconnected-nodes` | ✅ |
| `bpmn/reachable-from-start` | ✅ |
| `bpmn/no-implicit-split` | ✅ |
| `bpmn/no-implicit-join` | ✅ |
| `bpmn/no-multiple-start-events` | ✅ |
| `bpmn/no-empty-pool` | ✅ |
| `bpmn/task-has-name` | ✅ + test |
| `bpmn/gateway-has-name` | ✅ |
| `bpmn/exclusive-gateway-condition` | ✅ |

#### Infos
| ID | Estado |
|---|---|
| `bpmn/annotation-has-text` | ✅ |
| `bpmn/compensation-flow-target` | ✅ |
| `bpmn/data-object-connected` | ✅ |
| `bpmn/event-definition-payload-required` | ✅ |

### Faltantes del roadmap original

| ID | Prioridad | Descripción |
|---|---|---|
| `bpmn/aranza/task-has-owner` | 🔴 Alta | Task en proceso productivo debe tener `owner` asignado |
| `bpmn/aranza/critical-task-has-sla` | 🔴 Alta | Tasks con `priority: "critical"` deben tener `sla` definido |
| `bpmn/aranza/sla-format` | 🔴 Alta | Valor de `sla` debe ser duración ISO 8601 (ej. `PT4H`) |

---

## Reglas ERD — Estado detallado

### Implementadas (7 reglas)

| ID | Estado |
|---|---|
| `erd/entity-has-primary-key` | ✅ |
| `erd/relationship-has-entities` | ✅ |
| `erd/no-orphan-attribute` | ✅ |
| `erd/entity-connected` | ✅ |
| `erd/entity-has-name` | ✅ |
| `erd/attribute-has-name` | ✅ |
| `erd/relationship-has-name` | ✅ |

### Faltantes del roadmap original

| ID | Prioridad | Descripción |
|---|---|---|
| `erd/no-duplicate-entity-names` | 🔴 Alta | Dos entidades no pueden tener el mismo nombre |
| `erd/relationship-has-cardinality` | 🟡 Media | Relación debería tener cardinalidad (1:1, 1:N, N:M) |
| `erd/field-has-type` | 🟡 Media | Campo debería tener tipo de dato definido |
| `erd/foreign-key-references-pk` | 🔴 Alta | FK debe referenciar un campo PK de la entidad destino |
| `erd/no-self-relationship` | 🟢 Baja | Relación de entidad consigo misma debe estar documentada |

---

## Reglas UML — Estado detallado

### Implementadas (8 reglas — solo Class Diagram)

| ID | Estado |
|---|---|
| `uml/class-has-name` | ✅ |
| `uml/no-circular-inheritance` | ✅ |
| `uml/realization-target-is-interface` | ✅ |
| `uml/abstract-method-in-abstract-class` | ✅ |
| `uml/class-not-isolated` | ✅ |
| `uml/enumeration-has-literals` | ✅ |
| `uml/no-duplicate-attribute` | ✅ |
| `uml/package-has-name` | ✅ |

### Faltantes del roadmap original

| ID | Prioridad | Descripción |
|---|---|---|
| `uml/no-duplicate-class-names` | 🔴 Alta | Dos clases no pueden tener el mismo nombre en el namespace |
| `uml/interface-has-methods` | 🟡 Media | Interfaz sin métodos debería documentarse |
| **Sequence Diagram (todo el grupo)** | 🟡 Media | Ver detalle abajo |

#### Reglas Sequence Diagram (no implementadas)

| ID | Prioridad | Descripción |
|---|---|---|
| `uml/sequence-has-actors` | 🟡 Media | Sequence diagram debe tener ≥2 participantes |
| `uml/message-has-name` | 🟡 Media | Todo mensaje debe tener nombre |
| `uml/activation-is-closed` | 🟡 Media | Todo bloque de activación abierto debe cerrarse |
| `uml/self-message-allowed` | 🟢 Baja | Mensajes de un objeto a sí mismo son válidos pero deben revisarse |

> **Nota:** Las reglas de Sequence Diagram requieren primero que `diagrams-uml` tenga
> soporte de nodos de tipo Lifeline y Message. Coordinar con ese paquete antes de implementar.

---

## Reglas C4 — Estado detallado

### Implementadas (8 reglas)

| ID | Estado |
|---|---|
| `c4/element-has-name` | ✅ |
| `c4/container-inside-system` | ✅ |
| `c4/component-inside-container` | ✅ |
| `c4/no-direct-person-to-component` | ✅ |
| `c4/person-interacts` | ✅ |
| `c4/system-has-description` | ✅ |
| `c4/technology-specified` | ✅ |
| `c4/element-has-description` | ✅ |

### Faltantes del roadmap original

| ID | Prioridad | Descripción |
|---|---|---|
| `c4/relationship-has-label` | 🟡 Media | Relación debería describir el tipo de interacción |
| `c4/context-has-person` | 🟡 Media | Context diagram sin persona es inusual |
| `c4/container-has-technology` | 🟡 Media | Contenedor debería especificar tecnología |
| `c4/no-cross-boundary-direct` | 🟢 Baja | Componentes de distintos contenedores no deben comunicarse directamente |

---

## Próximos pasos — Prioridad Alta

### 1. Reglas AranzaFlows (`bpmn/aranza/*`)

**Ubicación:** `src/bpmn/rules/aranza/`

Estas reglas son la diferenciación principal de flowslint vs otras librerías genéricas.

```typescript
// src/bpmn/rules/aranza/task-has-owner.ts
export const taskHasOwner: LintRule<BpmnDiagram> = {
  id: "bpmn/aranza/task-has-owner",
  description: "Every task in a production process must have an assigned owner",
  defaultSeverity: "warning",
  category: "best-practice",
  check({ nodes }) {
    return nodes
      .filter(n => isTask(n) && !n.owner)
      .map(n => ({
        ruleId: "bpmn/aranza/task-has-owner",
        severity: "warning",
        message: `Task "${n.name ?? n.id}" has no owner assigned`,
        elementId: n.id,
        elementType: n.type,
      }));
  },
};
```

```typescript
// src/bpmn/rules/aranza/critical-task-has-sla.ts
// Task con priority === "critical" que no tiene sla definido

// src/bpmn/rules/aranza/sla-format.ts  
// Regex ISO 8601 duration: /^P(\d+Y)?(\d+M)?(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/
```

Agregar al preset `BPMN_RECOMMENDED_PRESET` con severidad `"warning"`.

---

### 2. Cobertura de tests BPMN (>80%)

**Archivo:** `__tests__/bpmn/rules.test.ts`

Actualmente ~40% de las 38 reglas tiene tests explícitos. Completar:

Para cada regla sin test:
```typescript
describe("bpmn/{rule-id}", () => {
  it("passes for valid diagram", () => { /* valid fixture */ });
  it("fails for invalid diagram", () => { /* invalid fixture */ });
  it("respects severity override", () => { /* config override */ });
});
```

Priorizar reglas de mayor impacto: `event-based-gateway-valid-targets`,
`end-event-reachable`, `cancel-only-in-transaction`, `link-event-pair`.

---

### 3. Reglas ERD faltantes

**Archivo:** `src/erd/rules/`

```
src/erd/rules/
  no-duplicate-entity-names.ts    ← nuevas
  relationship-has-cardinality.ts ← nuevas
  field-has-type.ts               ← nuevas
  foreign-key-references-pk.ts    ← nuevas
  no-self-relationship.ts         ← nuevas
```

La regla `foreign-key-references-pk` requiere cruzar información entre entidades —
es la más compleja (O(N×M)). Considerar `docsUrl` con explicación de cómo funciona el chequeo.

---

## Próximos pasos — Prioridad Media

### 4. Quick Fixes — Implementación

El tipo `LintQuickFix` está definido en `core/types.ts` pero ninguna regla lo usa.

```typescript
// Ejemplo en bpmn/rules/gateway-has-name.ts
return [{
  ruleId: "bpmn/gateway-has-name",
  severity: "warning",
  message: `Gateway "${n.id}" has no name`,
  elementId: n.id,
  quickFixes: [{
    id: "add-name",
    label: 'Set name to "Decision"',
    description: "Adds a default name to make the gateway self-documenting",
  }],
}];
```

Quick fixes son hints para el editor (aranzaflows webapp), no los ejecuta flowslint.
Implementar para las reglas de naming (`task-has-name`, `gateway-has-name`, `entity-has-name`).

---

### 5. `docsUrl` en todas las reglas

Actualmente menos del 30% de las reglas tienen `docsUrl`. Para ser una librería
profesional, cada regla debería poder apuntar a documentación que explica:
- Por qué existe la regla
- Ejemplo del error
- Cómo corregirlo

Dos opciones:
- **Opción A:** URLs a bpmn.io/bpmnlint (para reglas estándar BPMN)
- **Opción B:** README del paquete con anclas (`#rule-bpmn-gateway-has-name`)

Opción B es más controlable y no depende de URLs externas.

---

### 6. Reglas UML Sequence Diagram

Requiere coordinación con `diagrams-uml` para que defina tipos de nodo
`Lifeline`, `Message`, `ActivationBar`. Una vez definidos los tipos, las reglas son simples.

---

### 7. Reglas C4 faltantes

`c4/relationship-has-label` y `c4/context-has-person` son reglas sencillas
que mejorarían la calidad de diagramas C4.

---

### 8. Medir y documentar bundle size

```bash
npm run build && ls -lh dist/*.js
# Verificar que el entry BPMN < 20 KB gzip
gzip -k dist/bpmn/index.js && du -h dist/bpmn/index.js.gz
```

Documentar en README con badge o tabla.

---

## Próximos pasos — Prioridad Baja

### 9. CI/CD

- GitHub Actions en PR: `npm test` + `tsc --noEmit`
- Verificación de bundle size en CI (fallar si supera 20KB gzip)
- Publicación automática a npm en tag `v*`

### 10. Integración con aranzaflows webapp

- Documentar cómo conectar `runBpmnLint` al sidebar de validación del editor
- Adapter que convierte ReactFlow state a `BpmnDiagram` — ya existe `fromBpmnReactFlow`,
  verificar que cubra todos los casos del editor actual
- Modo "design" preset por defecto mientras se modela, "recommended" al exportar

---

## Plan de versiones

| Versión | Contenido | Estado |
|---|---|---|
| v0.2.4 | Estado actual (174 tests, 38 reglas BPMN) | ✅ Released |
| **v0.3.0** | Reglas AranzaFlows (`bpmn/aranza/*`) + tests BPMN >80% cobertura | 📋 Próximo |
| **v0.3.1** | ERD reglas faltantes (no-duplicate-names, fk-references-pk) + C4 faltantes | 📋 Próximo |
| **v0.4.0** | Quick fixes en reglas de naming + docsUrl completo + bundle size medido | 📋 Planificado |
| **v0.5.0** | UML Sequence Diagram rules (coordinado con diagrams-uml) | 📋 Planificado |
| **v1.0.0** | API estabilizada, >80% cobertura en todos los módulos, CI/CD | 🔮 Objetivo |

---

## Convenciones de desarrollo

**Nombre de reglas:** `{tipo}/{kebab-case}` — ej. `bpmn/end-event-required`.
Las reglas del namespace AranzaFlows van en `bpmn/aranza/{nombre}`.

**Archivo por regla:** cada regla en `src/{tipo}/rules/{rule-name}.ts`,
exporta un objeto `LintRule` nombrado y un export default.

**Tests:** `__tests__/{tipo}/rules.test.ts` (agrupados) o archivos individuales
`__tests__/{tipo}/{rule-name}.test.ts` para reglas complejas.

**Sin efectos secundarios:** `check()` no puede llamar `console`, `fetch`, ni lanzar
excepciones. Errores inesperados → capturar y retornar como issue interno.

**Categorías:** usar `category` para clasificar issues en el editor:
`"structure"` | `"modeling"` | `"naming"` | `"best-practice"` | `"engine"` | `"documentation"`
