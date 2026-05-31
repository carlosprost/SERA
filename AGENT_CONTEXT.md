# 🧠 SERA Agent Context & Handoff (Ancla de Memoria)

Este archivo sirve como memoria persistente y contexto de inducción inmediata para cualquier agente de IA o desarrollador que retome este proyecto. Contiene el estado del arte de la aplicación, decisiones de arquitectura críticas, quirks descubiertos y el roadmap inmediato para evitar cualquier tipo de "amnesia" o regresión funcional.

---

## 📌 1. Estado del Arte y Versión Actual
*   **Versión del Core:** `4.2.0`
*   **Codename:** `Poseidón · Phoenix-420`
*   **Rama Activa:** `main`
*   **Despliegue de Docs:** La carpeta `gh-pages` está sincronizada al 100% y forzada mediante `git subtree` en la rama remota `gh-pages` (`origin/gh-pages`).

---

## 🛠️ 2. Stack Tecnológico y Arquitectura
*   **Frontend:** Angular v21 (Uso obligatorio de Signals y nuevo Control Flow `@if`, `@for`).
*   **Backend & Sistema:** Tauri v2 (Rust) + SQLite local.
*   **Manejo de Estado:** NgRx Store (`src/app/store`).
*   **Estilos:** SCSS modularizado + Metodología BEM.
*   **Seguridad:** Cumplimiento con OWASP Top 10 (Prepared Statements en Rust, validaciones tipadas) e ISO 27001 (Auditoría de logs interna persistente). Ver detalles completos en [SECURITY_REPORT.md](file:///d:/Programacion/Github/SERA/SECURITY_REPORT.md).

---

## ⚠️ 3. Decisiones Críticas y Quirks del Sistema (¡LEER ANTES DE CODIFICAR!)

### A. V-Engine (Motor de Fórmulas y Reglas de Formato)
*   **Sintaxis Oficial:** Las referencias a columnas/campos dentro de las fórmulas **DEBEN** usar corchetes `[nombre_campo]` (y NO llaves `{}`). El separador de argumentos para funciones es el punto y coma `;` (por ejemplo, `SI([stock] < 5; "CRÍTICO"; "OK")`).
*   **Capacidad Aritmética:** El motor evalúa las expresiones usando `new Function` en JS, lo que significa que soporta de forma nativa sumas, restas, multiplicaciones, divisiones, potencias y agrupamiento por paréntesis (Ej: `([precio] * [cantidad]) * 1.21` para calcular el total con IVA).
*   **Funciones Especiales de Referencia:**
    *   `IGUAL(val1; val2)`: Comparación insensible a mayúsculas y minúsculas.
    *   `ESTA_VACIO(val)`: Detecta valores nulos, indefinidos o strings vacíos.
    *   `AHORA()`: Genera la fecha y hora actual en tiempo real.
    *   Operador de desigualdad: Se prefiere `<>` o `!=`.

### B. Gestión de Fechas e ISO
*   **Formato en Base de Datos:** Para asegurar un ordenamiento de registros perfecto a nivel SQLite (alfabético y numérico), las fechas se guardan siempre en formato ISO `YYYY-MM-DD` (o `YYYY-MM-DD HH:MM:SS`).
*   **Formato en UI:** El frontend se encarga de formatear visualmente estas fechas a `DD/MM/YYYY` en las vistas de tabla y detalle de forma transparente para el usuario, pero **nunca** deben persistirse como `DD/MM/YYYY` para no romper los índices de ordenación del backend.

### C. Estado de los Atajos de Teclado (Keyboard Shortcuts)
*   **Atajos Reales Activos:**
    *   `Ctrl + Shift + F`: Búsqueda Global (Spotlight) (`app.component.ts`).
    *   `Ctrl + F`: Búsqueda local inteligente en la grilla activa (`table.component.ts` -> `openSearchPalette()`).
    *   `Ctrl + F1`: Colapsar/Expandir Ribbon principal (`app.component.ts`).
    *   `Esc` (Cerrar), `Tab` (Siguiente), `Shift + Tab` (Anterior) en formularios de manera nativa.
*   **Atajos Inexistentes (ROADMAP):** Todos los demás atajos descritos anteriormente en documentación vieja (como `Ctrl + P`, `Ctrl + N`, `Ctrl + Enter`, `Supr` para borrar, `Ctrl + S` para guardar) **NO están implementados aún**. Fueron removidos de la documentación pública en `docs.html` y trasladados formalmente al Roadmap.

---

## 🔮 4. Roadmap Inmediato (Próximos Pasos)
Cuando se retome el desarrollo, el primer objetivo planificado es:
1.  **Hito 11 - Motor de Productividad Avanzado:** Implementar los atajos de teclado faltantes mediante un servicio de atajos global o directivas en Angular.
    *   `Ctrl + Enter` -> Crear nuevo registro en la tabla activa.
    *   `Supr` -> Eliminar los registros seleccionados en la grilla de datos.
    *   `Ctrl + S` -> Guardar el formulario activo.
    *   `Enter` / Doble clic -> Abrir la edición del registro seleccionado.
2.  Una vez implementados, se deben volver a incorporar en la tabla de atajos del manual en `gh-pages/docs.html`.

---

*Desarrollado y mantenido con rigurosidad técnica bajo los estándares de WolfTeI.*
