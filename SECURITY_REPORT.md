# SECURITY_REPORT.md — SERA v4.0.0 "Poseidón"
**WolfTeI | Sistema de Expedientes de Registro Avanzado**
*Última actualización: 2026-05-17 — Release v4.0.0 (Orion-400)*

---

## 1. Auditoría de Stack y Dependencias (v3.4.0)

### Componentes Críticos
- **SERA V-Engine (Fórmulas):** Motor de evaluación virtual desarrollado in-house. Utiliza un sandbox mediante la creación de contextos aislados para evitar la ejecución de código arbitrario (XSS/RCE).
- **Relational Engine:** Capa intermedia que gestiona la traducción de IDs numéricos a etiquetas legibles mediante diccionarios en memoria, evitando cruces de datos no autorizados.
- **Asynchronous PDF Engine (v4.0.0):** Generador de reportes en PDF con membrete configurable (logo + firma tipo sello). Construye el DOM en un contenedor efímero en memoria y desinfecta todos los campos mediante `textContent` nativo para prevenir XSS/HTMLi.
- **Logo Membrete System (v4.0.0):** Subsistema de copia y recuperación de logotipos de empresa. Copia el archivo al directorio de datos de la aplicación (`app_data_dir/membrete/`) y lo sirve como Data URL base64 al frontend, sin exponer rutas absolutas del sistema.
- **Audit Log System (v4.0.0):** Motor de auditoría ISO 27001 que registra eventos críticos (escrituras, optimizaciones, purgas) en tabla SQLite dedicada (`_sera_audit_log`). Los eventos incluyen timestamp, tipo de acción y descripción, nunca datos PII ni credenciales.
- **Relational Portability Packager (v3.3.0):** Compilador recursivo de dependencias relacionales que empaqueta una tabla y todas sus tablas vinculadas con sus respectivos adjuntos físicos en un único archivo `.srx` AES-256-GCM.

| Dependencia | Versión | Rol de Seguridad / Aporte a la Confidencialidad |
|---|---|---|
| `@angular/core` | 21.0.x | Sanitización XSS automática en el DOM y enlace seguro. |
| `rusqlite` | 0.32.x | Protección contra SQL Injection mediante Prepared Statements y parámetros tipados en SQLite. |
| `aes-gcm` | 0.10.x | Cifrado criptográfico simétrico AEAD para exportación e importación segura (.srx). |
| `html2canvas` / `jspdf` | 1.4.x / 2.5.x | Captura gráfica A4 y empaquetado final de PDF a nivel cliente sin llamadas externas. |
| `zip` | 2.2.x | Generación e importación de contenedores seguros con compresión Deflate para adjuntos y datos. |
| `chart.js` / `ng2-charts` | 4.5.x / 10.0.x | Renderizado analítico seguro aislado en canvas HTML5 sin dependencias de red externas. |

---

## 2. Mapa de Endpoints y Seguridad (Backend Tauri)

Todos los comandos del backend de Rust se encuentran protegidos mediante el aislamiento del canal IPC de Tauri y verificaciones de integridad antes del acceso a disco.

### A. Endpoints de Configuración del Operador
- `get_config`, `update_config`
  - **Nivel de Seguridad:** Aislado (IPC local).
  - **Control:** Valida estructura de datos del operador contra el esquema JSON definido. No expone secretos ni rutas directas del sistema al frontend.

### B. Endpoints de Catálogo y Definición de Tablas
- `get_tablas`, `crear_tabla`, `get_tabla_config`, `update_tabla_config`, `eliminar_tabla`, `reestructurar_tabla`
  - **Nivel de Seguridad:** Aislado con Lista Blanca (Whitelisting).
  - **Control:** Cada nombre de tabla recibido se sanitiza y contrasta con una lista de caracteres alfanuméricos (`a-zA-Z0-9_`) para prevenir inyecciones lógicas de base de datos. La eliminación física dispara cascadas que barren archivos huérfanos y registros de sistema.

### C. Endpoints de Datos (CRUD y Búsqueda)
- `get_campos`, `get_contenido`, `nuevo_registro`, `actualizar_registro`, `eliminar_registro`, `importar_bulk`, `search_global`
  - **Nivel de Seguridad:** Prepared Statements / Consultas Parametrizadas.
  - **Control:** Ninguno de estos comandos concatena strings en SQLite. `search_global` aplica un pre-procesamiento estricto de palabras clave y solo inspecciona columnas que contengan texto (VARCHAR/TEXT), bloqueando el acceso a tablas del sistema (comienzan con `_sera`).

### D. Endpoints de Archivos Adjuntos (Filesystem)
- `get_adjuntos`, `guardar_adjunto`, `eliminar_adjunto`, `abrir_adjunto`, `get_adjunto_base64`, `open_attachments_folder`
  - **Nivel de Seguridad:** Sandboxing del Sistema de Archivos (Tauri Path Restrictions).
  - **Control:** 
    1. `guardar_adjunto` genera automáticamente un **UUID v4 único** para renombrar físicamente el archivo antes de moverlo al directorio de datos (`app_data_dir/attachments`). Esto previene ataques de desbordamiento de directorios (*Directory Traversal*).
    2. Los archivos solo se abren con la API nativa de Tauri a través de asociaciones controladas por el sistema operativo, limitando ejecuciones involuntarias.
    3. `get_adjunto_base64` resuelve el archivo y añade el MIME type exacto tras validar que la ruta relativa existe estrictamente dentro de la carpeta aislada del usuario.

### E. Endpoints de Portabilidad (Paquetes .srx Relacionales — v3.3.0)
- `exportar_tabla`, `importar_tabla`
  - **Nivel de Seguridad:** Criptografía Simétrica AEAD (AES-256-GCM), Descubrimiento Recursivo y Mitigación de Colisiones.
  - **Control:** 
    1. **Búsqueda Recursiva de Vínculos:** El backend analiza el catálogo y la configuración JSON de la tabla origen para identificar todas las tablas vinculadas. Esto se repite para cada tabla descubierta, consolidando un grafo completo sin redundancias ni ciclos.
    2. **Empaquetado de Adjuntos Unificado:** Si se activa la exportación de adjuntos, el motor barra todas las tablas involucradas, recolecta sus archivos en `app_data_dir/attachments/` y los inyecta en el contenedor ZIP con rutas sanitizadas.
    3. **Prevención de Colisión de Datos (Importación):** `importar_tabla` realiza inserciones mediante Prepared Statements usando la instrucción `INSERT OR IGNORE`. Si una tabla vinculada ya existe o si un registro con la misma llave primaria ya está registrado, el motor descarta el registro conflictivo de forma silenciosa e integra los nuevos de manera segura, impidiendo la corrupción de la base de datos y violaciones a restricciones de clave única.
    4. **Detección Flexible:** Al descifrar el payload, el importador autodetecta si el paquete es de tipo `ExportPackage` (relacional v3.3.0) o de tipo `ExportedTable` (legacy/simple), procesándolo adecuadamente sin romper retrocompatibilidad.

### F. Endpoints de Membrete y Auditoría (v4.0.0)
- `guardar_logo_membrete`, `get_logo_membrete_base64`, `detectar_logo_membrete`
  - **Nivel de Seguridad:** Sandboxing del Sistema de Archivos (Tauri Path Restrictions).
  - **Control:**
    1. El logo se copia siempre a `app_data_dir/membrete/` con nombre fijo `logo.<ext>`. No se expone la ruta absoluta del origen al frontend.
    2. `get_logo_membrete_base64` solo resuelve rutas relativas dentro del directorio controlado, rechazando cualquier intento de path traversal (`../`).
    3. `detectar_logo_membrete` escanea extensiones predefinidas (`jpg`, `jpeg`, `png`) sin aceptar entrada de usuario.

- `get_audit_logs`, `optimizar_db`, `limpiar_cache`
  - **Nivel de Seguridad:** Sin entrada de usuario. Comandos de solo lectura o mantenimiento interno.
  - **Control:** `get_audit_logs` retorna registros de solo lectura. `optimizar_db` ejecuta `VACUUM` y `ANALYZE` sin aceptar parámetros. `limpiar_cache` borra únicamente archivos dentro de `app_data_dir/cache/`.

---

## 3. Estrategia de Sanitización y Prevención XSS/HTMLi

### A. Prevención de Inyección en Fórmulas
Para evitar que un operador técnico intente "escapar" del motor virtual de fórmulas:
1. Se pre-procesa la cadena eliminando cualquier intento de uso de `;` fuera de los separadores permitidos.
2. Los nombres de los campos y variables se tokenizan y validan contra el catálogo activo.
3. El motor ejecuta la lógica aislada dentro de un contexto controlado sin alcance global.

### B. Blindaje en Generación de Reportes PDF (v4.0.0)
Durante la captura gráfica con `html2canvas`, se construyen celdas y párrafos de textos a partir de variables ingresadas por el usuario (título, descripción, firma).
Para evitar inyección HTML y XSS (OWASP A03):
1. **Escape Nativo:** Todo el contenido de usuario se asigna mediante `el.textContent = contenido`.
2. Caracteres especiales como `<` y `>` se escapan automáticamente por el navegador, anulando la ejecución de scripts.
3. El logo se carga como Data URL base64 directamente desde el backend Rust, sin referencias a URLs externas.

---

## 4. Matriz de Prevención de Vulnerabilidades (OWASP v4.0.0)

| OWASP ID | Vulnerabilidad | Mecanismo Implementado en v4.0.0 |
|---|---|---|
| **A03** | Inyección | Prepared Statements en Rust, escape de strings mediante `textContent` en reportes PDF, sandbox léxico en motor de fórmulas y whitelist de extensiones en copia de logos. |
| **A04** | Diseño Inseguro | Separación estricta de responsabilidades (SoC), logs de auditoría ISO 27001, control granular de adjuntos y cleanups automáticos de cascada. |
| **A05** | Mala Configuración | Perfil de operador simplificado sin campos obsoletos expuestos; dispatch NgRx corregido para garantizar persistencia real de configuración. |
| **A07** | Fallos de Identificación | Derivación de llaves AES-256-GCM mediante SHA-256 para paquetes encriptados `.srx`. |
| **A08** | Fallos de Integridad | Inserción con mitigación de duplicados (`INSERT OR IGNORE`), auto-detección flexible de paquetes relacionales/legacy, UUIDs para adjuntos físicos. |
| **ISO 27001** | Trazabilidad | Audit Log System: registro persistente en SQLite de eventos críticos sin almacenamiento de PII. |

---

*Este reporte certifica que SERA v4.0.0 "Poseidón" eleva los controles de seguridad a nivel de producto comercial universal, incorporando auditoría ISO 27001, gestión segura de activos de marca (logos) y robustecimiento del ciclo de vida de la configuración del operador.*
