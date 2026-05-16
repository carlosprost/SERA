# SECURITY_REPORT.md — SERA v3.2.0 "Ares"
**WolfTeI | Sistema de Expedientes de Registro Avanzado**
*Última actualización: 2026-05-11 — Release v3.2.0 (Phoenix-320)*

---

## 1. Auditoría de Stack y Dependencias (v3.2)

### Componentes Críticos
- **SERA V-Engine (Fórmulas):** Motor de evaluación virtual desarrollado in-house. Utiliza un sandbox mediante la creación de contextos aislados para evitar la ejecución de código arbitrario (XSS/RCE).
- **Relational Engine:** Capa intermedia que gestiona la traducción de IDs numéricos a etiquetas legibles mediante diccionarios en memoria, evitando cruces de datos no autorizados.

| Dependencia | Versión | Rol de Seguridad |
|---|---|---|
| `@angular/core` | 21.x | Sanitización XSS automática en el DOM |
| `rusqlite` | 0.32.x | Protección contra SQL Injection mediante Prepared Statements |
| `aes-gcm` | 0.10.x | Integridad y confidencialidad de datos (AEAD) |

---

## 2. Mapa de Seguridad en Nuevas Funcionalidades

### A. Columnas Inteligentes (Fórmulas)
El motor de fórmulas (`FormulaEngine`) aplica las siguientes protecciones:
- **Lexical Sandboxing:** Las fórmulas se evalúan dentro de una `new Function` que solo recibe como argumentos las funciones permitidas (`SI`, `HOY`, etc.). No tienen acceso a `window`, `document`, ni a la API de Tauri.
- **Stand-alone Operators:** Los operadores lógicos (`OR`, `AND`) se tokenizan mediante límites de palabra (`\b`) para evitar que inyecten lógica fuera de las expresiones matemáticas.
- **Data Encapsulation:** El acceso a datos se restringe exclusivamente al objeto de la fila actual, evitando el acceso a otros registros de la tabla.

### B. Vínculos Relacionales
- **ID-Based Lookups:** Las relaciones se basan estrictamente en IDs internos de SQLite. No se permiten concatenaciones de strings para resolver vínculos.
- **Asynchronous Isolation:** La carga de datos vinculados se realiza mediante comandos de backend aislados que solo devuelven el par ID/DisplayField configurado, minimizando la exposición de datos de tablas remotas.

### D. Gestión de Datos Huérfanos (Cleanup)
- **Cascade Deletion:** La eliminación de una tabla ahora dispara una limpieza integral que incluye:
  - Eliminación de la tabla física (`DROP TABLE`).
  - Limpieza robusta del catálogo (`DELETE FROM tablas`) mediante comparaciones insensibles a mayúsculas.
  - Eliminación de registros de adjuntos en la tabla de sistema `_sera_adjuntos`.
  - **File System Sanitation:** Borrado físico recursivo de la carpeta de adjuntos vinculada a la tabla para evitar la persistencia de datos residuales.

### E. Blindaje de Importación (.srx)
- **Schema Enforcement:** El importador ahora valida las columnas entrantes contra la definición de la tabla. Cualquier columna técnica o virtual inyectada (ej: `sera_adjuntos_count`) es filtrada y descartada antes de la inserción en DB.
- **Uniqueness Collation:** La validación de nombres de tabla ahora es "Case-Insensitive", impidiendo la creación de colisiones de nombres que podrían causar errores de sombreado de datos.

### F. Descubrimiento Global (Deep Search)
- **Multi-Table Scoping:** La búsqueda recorre todas las tablas del usuario mediante metadatos del catálogo, evitando el acceso a tablas de sistema internas (comienzan con `sera_`).
- **Identifier Validation:** Cada nombre de tabla y columna se valida contra una lista blanca de caracteres alfanuméricos antes de construir la query dinámica, mitigando ataques de inyección de identificadores.
- **Data Type Filtering:** Solo se inspeccionan columnas de tipo TEXT/VARCHAR para optimizar la performance y evitar fugas de datos técnicos en campos numéricos sensibles.

---

## 3. Matriz de Prevención de Vulnerabilidades (OWASP v3.2)

| OWASP ID | Vulnerabilidad | Mecanismo Implementado en v3.2 |
|---|---|---|
| **A03** | Inyección | Validación de identificadores en V-Engine, filtrado de columnas en Importador y escape nativo de strings mediante `textContent` en reportes PDF. |
| **A04** | Diseño Inseguro | Gestión condicional de adjuntos y limpieza automática de datos huérfanos. |
| **A07** | Fallos de Identificación | Derivación de llaves AES mediante SHA-256 a partir de claves de usuario. |
| **A08** | Fallos de Integridad | Limpieza física de archivos tras eliminación de metadatos. |
| **Phoenix** | Motor de Fórmulas | ✅ Sanitizado | Aislamiento de ejecución via sandboxing léxico. |

---

## 4. Estrategia de Sanitización y Prevención

### Prevención de Inyección en Fórmulas
Para evitar que un usuario técnico intente "escapar" del motor de fórmulas:
1. Se pre-procesa la cadena eliminando cualquier intento de uso de `;` fuera de los separadores de función.
2. Los nombres de los campos se extraen y limpian de caracteres especiales (`<`, `>`, `[`, `]`).
3. El resultado se normaliza a tipos primitivos (string, number, boolean) antes de renderizar en el UI.

---

*Este reporte certifica que SERA v3.2.0 "Ares" mantiene y extiende los controles de seguridad para la nueva funcionalidad de motor relacional, cálculos virtuales y gestión de adjuntos bajo el ciclo Phoenix.*
