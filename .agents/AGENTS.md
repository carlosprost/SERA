# Reglas de Arquitectura y Patrones Obligatorios - SERA

## 1. Menú Contextual de la Grilla Principal (TableComponent)

El menú contextual de SERA posee requerimientos específicos de Angular CDK Overlay que **NUNCA DEBEN ALTERARSE NI SIMPLIFICARSE**:

### A. Ciclo de Vida del Ancla y Purga de Caché CDK (OBLIGATORIO)
- **Problema de CDK Overlay:** `MatMenuTrigger` almacena en caché la posición de su estrategia de coordenadas (`FlexibleConnectedPositionStrategy`). Si solo se cambian las coordenadas `(x, y)` en el `style.left` y `style.top` sin destruir el elemento DOM, el menú **NO se mueve** a la nueva celda al hacer clicks derechos sucesivos.
- **Regla en Template (`table.component.html`):**
  El ancla del disparador DEBE estar obligatoriamente envuelta en `@if (isContextMenuVisible)`:
  ```html
  @if (isContextMenuVisible) {
    <div 
      #contextMenuTriggerEl
      style="position: fixed; width: 0px; height: 0px; background: transparent; z-index: -1000; pointer-events: none;"
      [style.left.px]="contextMenuPosition.x"
      [style.top.px]="contextMenuPosition.y"
      [matMenuTriggerFor]="contextMenu"
      #contextMenuTrigger="matMenuTrigger">
    </div>
  }
  ```
- **Regla en Lógica (`table.component.ts`):**
  Para abrir o mover el menú, **SIEMPRE** se debe ejecutar el ciclo de 4 pasos:
  1. `this.isContextMenuVisible = false; this.cdr.detectChanges();` (destruye el nodo DOM y purga el overlay de CDK).
  2. Asignar las nuevas coordenadas: `this.contextMenuPosition.x = event.clientX; this.contextMenuPosition.y = event.clientY;`
  3. `this.isContextMenuVisible = true; this.cdr.detectChanges();` (reconstruye el ancla en las coordenadas correctas).
  4. `setTimeout(() => { if (this.contextMenuTrigger) this.contextMenuTrigger.openMenu(); }, 10);`

### B. Interceptación Global de Click Derecho (Continuous Right-Click)
- Cuando el menú está abierto, el backdrop de Angular CDK (`.cdk-overlay-backdrop`) cubre la pantalla.
- Se debe mantener el `@HostListener('document:contextmenu', ['$event'])`:
  - Si el evento trae la bandera `(event as any)._isSeraRetrigger === true`, se ignora para permitir la ejecución en la celda.
  - Si no, oculta el backdrop momentáneamente (`backdrop.style.display = 'none'`), obtiene la celda con `document.elementFromPoint(event.clientX, event.clientY)`, restaura el backdrop, cierra el menú anterior (`this.closeContextMenu()`) y re-despacha el evento con `_isSeraRetrigger = true` sobre el elemento encontrado.

### C. Encabezado Fijo (Sticky Header) y Submenús
- **Header Fijo:** `.context-menu-header` debe mantener siempre `position: sticky; top: 0; z-index: 10;` con fondo opaco `var(--sera-card-bg)` para que las opciones scrolleen por debajo sin cortarlo ni desplazarlo.
- **Submenús:** Deben usar la clase `.sera-submenu` sin restricciones de `overflow: hidden` globales en `.mat-mdc-menu-panel` que rompan los cálculos de posición de CDK.
