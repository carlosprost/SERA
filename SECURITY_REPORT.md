# SECURITY_REPORT.md — SERA v3.3.0 "Ares"
**WolfTeI | Sistema de Expedientes de Registro Avanzado**
*Última actualización: 2026-05-16 — Release v3.3.0 (Phoenix-330)*

---

## 1. Auditoría de Stack y Dependencias (v3.3.0)

### Componentes Críticos
- **SERA V-Engine (Fórmulas):** Motor de evaluación virtual desarrollado in-house. Utiliza un sandbox mediante la creación de contextos aislados para evitar la ejecución de código arbitrario (XSS/RCE).
- **Relational Engine:** Capa intermedia que gestiona la traducción de IDs numéricos a etiquetas legibles mediante diccionarios en memoria, evitando cruces de datos no autorizados.
- **Asynchronous PDF Engine (v3.2.1):** Generador de reportes en PDF aislado que crea contenedores en memoria del DOM efímeros y desinfecta todos los campos para prevenir ejecuciones en el canvas de captura.
- **Relational Portability Packager (v3.3.0):** Compilador recursivo de dependencias relacionales que empaqueta una tabla y todas sus tablas vinculadas (directa e indirectamente) con sus respectivos adjuntos físicos de manera unificada y encriptada en un único archivo `.srx`.

| Dependencia | Versión | Rol de Seguridad / Aporte a la Confidencialidad |
|---|---|---|
| `@angular/core` | 21.0.x | Sanitización XSS automática en el DOM y enlace seguro. |
| `rusqlite` | 0.32.x | Protección contra SQL Injection mediante Prepared Statements y parámetros tipados en SQLite. |
| `aes-gcm` | 0.10.x | Cifrado criptográfico simétrico AEAD para exportación e importación segura (.srx). |
| `html2canvas` / `jspdf` | 1.4.x / 2.5.x | Captura gráfica A4 y empaquetado final de PDF a nivel cliente sin llamadas externas. |
| `zip` | 2.2.x | Generación e importación de contenedores seguros con compresión Deflate para adjuntos y datos. |

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

---

## 3. Estrategia de Sanitización y Prevención XSS/HTMLi

### A. Prevención de Inyección en Fórmulas
Para evitar que un operador técnico intente "escapar" del motor virtual de fórmulas:
1. Se pre-procesa la cadena eliminando cualquier intento de uso de `;` fuera de los separadores permitidos.
2. Los nombres de los campos y variables se tokenizan y validan contra el catálogo activo.
3. El motor ejecuta la lógica aislada dentro de un contexto controlado sin alcance global.

### B. Blindaje en Generación de Reportes PDF (v3.2.1)
Durante la captura gráfica con `html2canvas`, se construyen celdas y párrafos de textos a partir de variables ingresadas por el usuario (título, descripción, firma). 
Para evitar inyección HTML y XSS (OWASP A03):
1. **Escape Nativo:** Transicionamos el motor de renderizado de `el.innerHTML = contenido` a `el.textContent = contenido`. 
2. Esto asegura que caracteres especiales como `<` y `>` se escapen automáticamente por el navegador y se rendericen de forma literal en la imagen, anulando la ejecución de scripts.

---

## 4. Matriz de Prevención de Vulnerabilidades (OWASP v3.3.0)

| OWASP ID | Vulnerabilidad | Mecanismo Implementado en v3.3.0 |
|---|---|---|
| **A03** | Inyección | Prepared Statements en Rust, escape de strings mediante `textContent` en reportes PDF, y sandbox léxico en motor de fórmulas. |
| **A04** | Diseño Inseguro | Separación estricta de responsabilidades (SoC), control granular de adjuntos y cleanups automáticos de cascada. |
| **A07** | Fallos de Identificación | Derivación de llaves AES-256-GCM mediante SHA-256 para paquetes encriptados `.srx`. |
| **A08** | Fallos de Integridad | Inserción con mitigación de duplicados (`INSERT OR IGNORE`), auto-detección flexible de paquetes relacionales/legacy, y UUIDs para adjuntos físicos. |
| **Phoenix** | Motor de Fórmulas | ✅ Sanitizado | Aislamiento completo de variables y evaluación en un contexto local restringido. |

---

*Este reporte certifica que SERA v3.3.0 "Ares" mantiene y robustece los controles de seguridad integral, extendiendo la mitigación XSS, la integridad referencial de exportaciones conjuntas, y el blindaje ante colisiones primarias de base de datos.*
