---
name: create-ui-component
description: >
  Detecta elementos de UI repetidos en la app (inputs, selects, botones, cards, badges, etc.)
  y los refactoriza en componentes Angular standalone reutilizables del Design System SERA,
  siguiendo el patrón de ControlValueAccessor + _sera-ui-tokens.scss.
  Activar cuando un elemento visual idéntico (con pequeñas variaciones de tamaño o config)
  aparece en 2 o más componentes distintos.
---

# Skill: Crear Componente UI Reutilizable — Design System SERA

## Criterios de Detección (cuándo activar esta skill)

Un elemento merece convertirse en componente standalone si:

1. **Aparece en ≥ 2 componentes** con la misma estructura HTML base (inputs, selects, botones, tarjetas, badges, dialogs genéricos, etc.)
2. **Sus variantes se diferencian solo por config** (ancho, etiqueta, ícono, color, opciones)
3. **Tiene lógica propia** que se duplica (validación, estados, handlers)
4. **Tiene estilos propios** que se sobreescriben repetidamente por SCSS

## Estructura de Archivos

```
src/app/shared/components/ui/
  ├── _sera-ui-tokens.scss              ← tokens y mixin MDC reset (NO tocar)
  └── <nombre-componente>/
      ├── <nombre>.component.ts
      ├── <nombre>.component.html
      └── <nombre>.component.scss
```

Selector Angular: `sera-<nombre>` (ej: `sera-select`, `sera-input`, `sera-card`)

## Patrón Obligatorio

### 1. TypeScript — ControlValueAccessor para campos de formulario

Si el componente contiene un campo de formulario (input, select, checkbox, date picker):

```typescript
@Component({
  selector: 'sera-<nombre>',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule, CommonModule],
  templateUrl: './<nombre>.component.html',
  styleUrl: './<nombre>.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => Sera<Nombre>Component),
    multi: true
  }]
})
export class Sera<Nombre>Component implements ControlValueAccessor, OnInit, OnDestroy {
  // @Input() para configuración visual
  @Input() label: string = '';
  @Input() width: string = '100%';
  // ... otros @Input() específicos del componente

  // @Output() para eventos
  @Output() change = new EventEmitter<any>();

  // Control interno para bindear con Material
  readonly internalControl = new FormControl<any>(null);
  isDisabled = false;

  private onChange: (v: any) => void = () => {};
  private onTouched: () => void = () => {};
  private sub?: Subscription;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.sub = this.internalControl.valueChanges.subscribe(val => {
      this.onChange(val);
      this.change.emit(val);
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  writeValue(value: any): void {
    this.internalControl.setValue(value, { emitEvent: false });
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: any) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    isDisabled
      ? this.internalControl.disable({ emitEvent: false })
      : this.internalControl.enable({ emitEvent: false });
    this.cdr.markForCheck();
  }
}
```

Ventaja: el consumidor usa `formControlName="miCampo"` o `[formControl]="ctrl"` sin cambios.

### 2. SCSS — Siempre usar el mixin `field-mdc-reset`

```scss
@use '../sera-ui-tokens' as t;

:host {
  display: inline-block;

  @include t.field-mdc-reset;  // ← UNA SOLA VEZ, nunca en styles.scss

  .sera-<nombre>-field {
    width: 100%;
  }

  // Estilos adicionales específicos del componente
}
```

**NUNCA** agregar overrides de `mat-form-field` en `styles.scss` global para este componente.
El mixin `field-mdc-reset` en `_sera-ui-tokens.scss` es la única fuente de verdad.

> **⚠️ REGLA CRÍTICA — Dependencia Circular:**
> Los componentes del Design System (`sera-button`, `sera-select`, `sera-input`, etc.)
> **NUNCA deben importar `MaterialModule`** porque `MaterialModule` los exporta a ellos.
> Eso genera una dependencia circular que causa fallos silenciosos en runtime
> (componentes que no renderizan sin errores en consola).
>
> **Solución:** Importar solo los módulos específicos de Angular Material que se necesiten:
> ```typescript
> // ✅ Correcto
> import { MatButtonModule } from '@angular/material/button';
> import { MatIconModule } from '@angular/material/icon';
>
> // ❌ NUNCA en componentes UI del Design System
> import { MaterialModule } from '../../../material.module';
> ```

### 3. Registrar en `material.module.ts`

```typescript
// Imports
import { Sera<Nombre>Component } from './components/ui/<nombre>/sera-<nombre>.component';

@NgModule({
  imports: [CommonModule, ..., Sera<Nombre>Component],
  exports: [..., Sera<Nombre>Component]
})
export class MaterialModule { }
```

Al exportarlo en `MaterialModule`, cualquier componente que ya importe `MaterialModule` lo recibe sin cambios.

## Reglas de @Input() Obligatorios

| Input | Tipo | Default | Descripción |
|---|---|---|---|
| `label` | `string` | `''` | Etiqueta visible del campo |
| `width` | `string` | `'100%'` | Ancho CSS del componente |
| `disabled` | `boolean` | `false` | Solo para componentes sin CVA |

## Componentes Existentes (no recrear)

| Selector | Descripción |
|---|---|
| `<sera-select>` | Dropdown / select con opciones primitivas u objeto |
| `<sera-input>` | Input de texto, número, email, tiempo |
| `<sera-button>` | Botón (filled / outlined / elevated / tonal / text / icon) — Angular Material M3 |

### Variantes de `<sera-button>` (Angular Material 21 M3)

| variant=       | API M3 generada          | Equivalente viejo (deprecated) |
|----------------|--------------------------|--------------------------------|
| `flat`         | `matButton="filled"`     | `mat-flat-button`              |
| `outlined`     | `matButton="outlined"`   | `mat-stroked-button`           |
| `elevated`     | `matButton="elevated"`   | `mat-raised-button`            |
| `tonal`        | `matButton="tonal"`      | *(nuevo en M3)*                |
| `text`         | `matButton` (sin valor)  | `mat-button`                   |
| `icon`         | `matIconButton`          | `mat-icon-button`              |

> **Nota M3:** En Angular Material 21 ya no existe el atributo `color="primary|warn|accent"` por botón.
> Los colores se definen a través del tema global (colorScheme). Si necesitás un botón en color warn,
> usá una clase CSS custom + `::ng-deep` dentro del componente donde se necesite.

## Proceso de Migración de Componentes Existentes

1. **Identificar** todos los archivos que usan el elemento a migrar con `grep_search`
2. **Crear** el nuevo componente standalone siguiendo el patrón
3. **Migrar** de a un componente existente a la vez (no masivo)
4. **Verificar** con `npm run build` después de cada migración
5. **Documentar** qué componentes ya fueron migrados en el AGENTS.md del proyecto

## Cuándo NO crear un componente

- Si el elemento aparece en un solo lugar y no se reutilizará
- Si tiene lógica de negocio muy específica (no es UI genérica)
- Si ya existe un componente de Material Design que resuelve el caso

## Checklist de Revisión (antes de hacer el commit)

- [ ] El componente es `standalone: true`
- [ ] Implementa `ControlValueAccessor` si contiene un campo de formulario
- [ ] El SCSS usa `@include t.field-mdc-reset` dentro de `:host`
- [ ] No hay overrides de Material en `styles.scss` para este componente
- [ ] Está registrado en `MaterialModule` (imports + exports)
- [ ] El consumidor usa `formControlName` o `[control]` sin cambios extra
- [ ] `npm run build` compila sin errores nuevos
