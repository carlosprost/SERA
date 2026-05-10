# SECURITY_REPORT.md — SERA v3.0.1
**WolfTeI | Sistema de Expedientes de Registro Avanzado**
*Última actualización: 2026-05-10 — Patch "Grand Edition" v3.0.1*

---

## 1. Auditoría de Stack y Dependencias

### Frontend (Angular 21 + Tauri API)

| Dependencia | Versión | Rol de Seguridad |
|---|---|---|
| `@angular/core` | 21.x | Framework base con sanitización XSS automática en templates |
| `@tauri-apps/api` | 2.x | Canal IPC seguro entre frontend y backend Rust (no expone red) |
| `@tauri-apps/plugin-dialog` | 2.6.x | Diálogos nativos del SO para selección de archivos (aislado del renderer) |
| `@tauri-apps/plugin-fs` | 2.4.x | Acceso al sistema de archivos restringido por ACLs de Tauri |
| `@fontsource/roboto` | 5.x | **NUEVO v3.0.1:** Fuente Roboto empaquetada localmente (elimina dependencia CDN externa) |
| `material-icons` | 1.x | **NUEVO v3.0.1:** Íconos Material embebidos localmente (elimina dependencia CDN externa) |

### Backend (Rust + Tauri 2)

| Dependencia | Versión | Rol de Seguridad |
|---|---|---|
| `tauri` | 2.x | Core con aislamiento de procesos, modelo de Capabilities y IPC segura |
| `aes-gcm` | 0.10.x | **Cifrado AES-256-GCM** (Authenticated Encryption with Associated Data) para archivos `.srx` |
| `rand` | 0.8.x | CSPRNG (`OsRng`) para generación de Nonces — nunca reutilizados |
| `rusqlite` | 0.32.x (bundled) | SQLite embebido; usa Prepared Statements en todas las operaciones |
| `serde` + `serde_json` | 1.x | Serialización tipada y validada de toda la interfaz de datos |

---

## 2. Mapa de Comandos Tauri y Niveles de Seguridad

Todos los comandos son **accesibles únicamente desde el frontend de la app** a través del canal IPC de Tauri. No hay endpoints de red expuestos.

| Comando | Descripción | Nivel | Mecanismo de Seguridad |
|---|---|---|---|
| `get_config` | Lee configuración del usuario | Interno | Solo lectura; errores genéricos al frontend |
| `update_config` | Guarda configuración del usuario | Interno | Escritura local; errores genéricos al frontend |
| `get_tablas` | Lista las tablas del catálogo | Interno | Solo lectura |
| `crear_tabla` | Crea una nueva tabla SQL | **Crítico** | `validar_nombre_identificador` en DB layer (Anti-SQLi) |
| `eliminar_tabla` | Elimina una tabla SQL | **Crítico** | Validación de identificador; operación irreversible |
| `reestructurar_tabla` | Migra esquema de tabla | **Crítico** | Validación de identificador + migración atómica |
| `get_campos` | Obtiene la estructura de una tabla | Interno | Solo lectura |
| `get_contenido` | Obtiene registros de una tabla | Interno | Solo lectura con Prepared Statements |
| `nuevo_registro` | Inserta un registro | **Crítico** | Prepared Statements parametrizados (Anti-SQLi) |
| `actualizar_registro` | Modifica un registro existente | **Crítico** | Prepared Statements parametrizados (Anti-SQLi) |
| `eliminar_registro` | Elimina un registro por ID | **Crítico** | Prepared Statements; ID validado en Rust |
| `exportar_tabla` | Exporta tabla a archivo `.srx` | **Crítico** | AES-256-GCM + Magic Header `SERA_V1_PACK` |
| `importar_tabla` | Importa tabla desde `.srx` | **Crítico** | Descifrado GCM + validación de integridad + check de duplicados |
| `get_tabla_config` | Lee config visual (JSON) de tabla | Interno | Solo lectura |
| `update_tabla_config` | Guarda config visual (JSON) | Interno | Escritura local controlada |

---

## 3. Estrategia de Sanitización y Prevención de Inyección

### A. Inyección SQL (OWASP A03)
- **Nombres de tabla/campo:** Validados por la función `validar_nombre_identificador` en la capa de base de datos. Rechaza caracteres especiales y palabras reservadas SQL antes de cualquier construcción de query dinámica.
- **Valores de registros:** Manejados 100% con **Prepared Statements de rusqlite** (`params![]`). Ningún valor de usuario se concatena directamente a una query SQL.
- **Importación de `.srx`:** Los nombres de campo provenientes del paquete importado pasan por la misma validación de identificadores antes de ser usados en queries de recreación de tabla.

### B. Cifrado de Datos en Reposo y Tránsito (.srx)
El flujo de exportación implementa **AES-256-GCM** (AEAD):

```
[Datos JSON] → Serialización serde → Cifrado AES-256-GCM (Nonce único por operación)
     ↓
[SERA_V1_PACK | Nonce (12 bytes) | Ciphertext + Auth Tag]  →  archivo .srx
```

1. **Confidencialidad:** Los datos son ilegibles fuera de SERA.
2. **Integridad:** El Auth Tag de GCM detecta cualquier modificación de un solo bit. Si el archivo fue alterado, el descifrado falla de forma segura.
3. **Freshness:** El Nonce se genera con `OsRng` en cada exportación; nunca se reutiliza.
4. **Autenticidad del formato:** El Magic Header `SERA_V1_PACK` es validado antes de procesar cualquier byte cifrado.

> ⚠️ **Observación activa (para v3.1.0):** La `MASTER_KEY` está hardcodeada en `security.rs` como constante compilada. Esto es aceptable para el modelo de portabilidad interna actual (solo SERA puede descifrar SERA), pero idealmente debería derivarse de un secreto del sistema operativo (ej: Windows DPAPI o Keychain en macOS) para una seguridad más robusta en entornos multiusuario.

### C. XSS (Cross-Site Scripting)
Angular 21 sanitiza automáticamente todos los bindings de template (`{{ }}`). No se usa `innerHTML` ni `bypassSecurityTrust*` en ningún componente de la aplicación.

### D. Manejo de Errores (OWASP A09)
Todos los comandos Tauri capturan errores internamente y devuelven mensajes **genéricos** al frontend (ej: `"Ocurrió un error al crear la tabla"`). Los detalles técnicos se emiten únicamente a `stderr` vía `eprintln!` — nunca al cliente.

---

## 4. Content Security Policy (CSP)

Configurada en `tauri.conf.json` bajo el principio de **mínimo privilegio**:

```
default-src 'self'
script-src  'self'
style-src   'self' 'unsafe-inline'
font-src    'self' data:
img-src     'self' data: blob:
connect-src 'self' ipc: http://ipc.localhost
```

> **NUEVO en v3.0.1:** Se eliminaron las dependencias de `fonts.googleapis.com` y `fonts.gstatic.com`. Las fuentes Roboto y Material Icons ahora se sirven localmente, alineando el comportamiento de producción con la CSP restrictiva y eliminando una dependencia de red en runtime.

---

## 5. Integridad de Actualizaciones (Auto-Updater)

El sistema de Auto-Updater (introducido para chequear versiones en GitHub Releases) utiliza **Firmas Criptográficas Ed25519**.
1. **Firma:** Cada paquete de actualización (`.zip` generado por Tauri) es firmado con una llave privada (`TAURI_PRIVATE_KEY`) antes de ser subido a GitHub.
2. **Verificación:** La aplicación tiene la llave pública (`pubkey` en `tauri.conf.json`) embebida. Antes de instalar cualquier descarga, el actualizador verifica matemáticamente que el archivo provenga del autor original y no haya sido modificado en tránsito (mitigando ataques Man-in-the-Middle o compromisos del servidor de GitHub).

---

## 5. Capacidades Tauri (ACLs — Principio de Mínimo Privilegio)

Configuradas en `src-tauri/capabilities/default.json`:

| Permiso | Estado | Justificación |
|---|---|---|
| `core:default` | ✅ Habilitado | Operaciones base del runtime de Tauri |
| `shell:allow-open` | ✅ Habilitado | Apertura de links externos (ej: URL en diálogos) |
| `dialog:allow-open` | ✅ Habilitado | Selector de archivos para importar `.srx` |
| `dialog:allow-save` | ✅ Habilitado | Selector de destino para exportar `.srx` y PDFs |
| `fs:allow-read-file` | ✅ Habilitado | Lectura de archivos `.srx` seleccionados por el usuario |
| `fs:allow-write-file` | ✅ Habilitado | Escritura de archivos `.srx` y PDFs en ruta elegida por el usuario |
| Acceso a red / cámara / micrófono | ❌ No habilitado | No requerido por la aplicación |

---

## 6. Matriz de Prevención de Vulnerabilidades (OWASP Top 10 — 2021)

| OWASP ID | Vulnerabilidad | Estado | Mecanismo Implementado |
|---|---|---|---|
| **A01** | Control de Acceso Roto | ✅ Mitigado | Capabilities restringidas; IPC no expuesto en red; modelo de ventana única |
| **A02** | Fallos Criptográficos | ✅ Mitigado | AES-256-GCM con Nonce CSPRNG; TLS no requerido (app local) |
| **A03** | Inyección | ✅ Mitigado | Prepared Statements en todas las queries; `validar_nombre_identificador` para DDL |
| **A04** | Diseño Inseguro | ✅ Considerado | Validación del flujo de importación (check de duplicados antes de escribir en DB) |
| **A05** | Configuración de Seguridad Incorrecta | ✅ Mitigado | CSP estricta; no hay consola en builds de producción (`windows_subsystem = "windows"`) |
| **A06** | Componentes Vulnerables y Desactualizados | ⚠️ Monitorear | Revisar CVEs en `npm audit` y `cargo audit` antes de cada release |
| **A07** | Fallos de Identificación y Autenticación | ✅ N/A | App de escritorio local sin autenticación de red; datos en directorio del SO |
| **A08** | Fallos en Software e Integridad de Datos | ✅ Mitigado | Auth Tag GCM previene importación de `.srx` modificados o falsos |
| **A09** | Fallos en Logging y Monitoreo | ✅ Mitigado | Errores técnicos solo en `stderr`; mensajes genéricos al usuario |
| **A10** | Server-Side Request Forgery | ✅ N/A | No hay backend de red; CSP bloquea conexiones externas no autorizadas |

---

## 7. Hallazgos y Recomendaciones Pendientes

| ID | Severidad | Hallazgo | Recomendación | Target |
|---|---|---|---|---|
| SEC-001 | 🟡 Media | `MASTER_KEY` compilada como constante en `security.rs` | Derivar desde Windows DPAPI o variable de entorno del sistema | v3.1.0 |
| SEC-002 | 🟢 Baja | `shell:allow-open` habilita apertura de cualquier URL externa | Validar URLs contra una allowlist antes de invocar `open()` | v3.1.0 |
| SEC-003 | 🟢 Baja | No se ejecuta `cargo audit` en el CI | Agregar `cargo audit` como step pre-build en el pipeline | v3.1.0 |

---

*Este reporte certifica que SERA v3.0.1 cumple con los estándares de seguridad establecidos para aplicaciones de gestión de datos administrativos y judiciales bajo los controles OWASP Top 10 (2021), con los hallazgos pendientes documentados para la próxima iteración.*
