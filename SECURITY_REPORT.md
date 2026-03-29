# SECURITY_REPORT.md — SERA v2.1.0
**WolfTeI | Sistema de Expedientes de Registro Avanzado**
*Última actualización: 2026-03-29 — Estabilización de Ribbon UI + Spotlight Search*

---

## 1. Auditoría de Stack y Dependencias

### Frontend (Angular 21)
| Dependencia | Versión | Rol de Seguridad |
|---|---|---|
| `@angular/core` | 21.x | Framework base con protección XSS integrada (sanitización automática de templates) |
| `@angular/forms` | 21.x | Reactive Forms con validación en el cliente |
| `@ngrx/store` | 19.x | Manejo de estado inmutable — previene mutaciones directas de datos |
| `@ngrx/effects` | 19.x | Aísla efectos secundarios (llamadas al backend) del estado |
| `@tauri-apps/api` | 2.x | API de comunicación IPC con el backend Rust — no expuesta en red |
| `zone.js` | 0.15.x | Detección de cambios — sin impacto directo en seguridad |
| `jspdf` / `html2canvas` | estables | Generación de PDF en cliente — sin transmisión de datos |

### Backend (Rust + Tauri 2)
| Dependencia | Versión | Rol de Seguridad |
|---|---|---|
| `tauri` | 2.x | Shell de escritorio con sistema de capabilities para control de permisos granular |
| `tauri-plugin-shell` | 2.x | Apertura de URLs externas con lista de permisos explícita |
| `rusqlite` | 0.32 (bundled) | SQLite compilado estáticamente — sin dependencia de instalación del usuario, sin servidor expuesto en red |
| `serde` / `serde_json` | 1.x | Serialización/deserialización tipada y segura |

### Eliminadas en v2.0.0 (con motivación de seguridad)
| Dependencia Anterior | Razón de Eliminación |
|---|---|
| `promise-mysql` | Conexión a MySQL con password hardcodeada en texto plano |
| `express` / `cors` | Servidor HTTP expuesto en port 3000 — superficie de ataque innecesaria |
| `@tauri-apps/api v1` | Versión obsoleta — migrada a API v2 con mejor modelo de permisos |

---

## 2. Mapa de Comandos Tauri y Seguridad

| Comando | Descripción | Nivel de Acceso | Mecanismo |
|---|---|---|---|
| `get_config` | Leer configuración del usuario | App interna | Tauri IPC (no expuesto en red) |
| `update_config` | Actualizar configuración | App interna | Tauri IPC + validación de tipos Rust |
| `get_tablas` | Listar tablas del catálogo | App interna | Tauri IPC |
| `crear_tabla` | Crear nueva tabla SQLite | App interna | Tauri IPC + validación de nombre con regex |
| `eliminar_tabla` | Eliminar tabla y su catálogo | App interna | Tauri IPC + validación de nombre con regex |
| `get_campos` | Obtener estructura de tabla | App interna | Tauri IPC + validación de nombre con regex |
| `get_contenido` | Obtener registros de tabla | App interna | Tauri IPC + validación de nombre con regex |
| `nuevo_registro` | Insertar nuevo registro | App interna | Tauri IPC + prepared statements |
| `actualizar_registro` | Actualizar registro existente | App interna | Tauri IPC + prepared statements |
| `eliminar_registro` | Eliminar registro por ID | App interna | Tauri IPC + prepared statement con `?` |

> **Nota:** Todos los comandos operan exclusivamente vía Tauri IPC. No existe ningún puerto HTTP expuesto. Los comandos solo son invocables desde el frontend cargado por la propia aplicación.

---

## 3. Estrategia de Sanitización

### Identificadores SQL (nombres de tabla/campo)
Los nombres de tabla y campo se validan con la función `validar_nombre_identificador()` antes de cualquier interpolación en consultas DDL:

```rust
fn validar_nombre_identificador(nombre: &str) -> Result<()> {
    let valido = nombre.chars().all(|c| c.is_alphanumeric() || c == '_');
    // Rechaza todo lo que no sea [A-Za-z0-9_]
}
```

**Ataque prevenido:** SQL Injection en operaciones DDL (CREATE/DROP TABLE, PRAGMA) donde los placeholders `?` de SQLite no son aplicables.

### Valores de datos (contenido de registros)
Todos los valores se insertan vía **prepared statements con placeholders `?`** de `rusqlite`:

```rust
// Ejemplo en nuevo_registro:
let sql = format!("INSERT INTO {tabla} ({columnas}) VALUES ({placeholders})");
stmt.execute(rusqlite::params_from_iter(valores.iter()))?;
```

**Ataque prevenido:** SQL Injection clásico — los valores nunca se concatenan al SQL.

### Frontend Angular
Angular 21 sanitiza automáticamente el contenido interpolado en los templates via `DomSanitizer`. No se usa `innerHTML` con datos de usuario sin control.

**Ataque prevenido:** XSS (Cross-Site Scripting) en la UI.

### Manejo de Errores
Siguiendo OWASP, los mensajes de error al usuario son genéricos:

```rust
// En comandos Tauri:
.map_err(|e| {
    eprintln!("[SERA] Error interno: {e}");  // Solo a logs internos
    "Ocurrió un error al cargar los datos".to_string()  // Genérico al usuario
})
```

**Ataque prevenido:** Information Disclosure — stack traces y detalles técnicos no se exponen al usuario.

---

## 4. Matriz de Prevención de Vulnerabilidades (OWASP Top 10)

| OWASP ID | Vulnerabilidad | Estado Anterior | Estado v2.0.0 | Mecanismo |
|---|---|---|---|---|
| **A01** | Broken Access Control | ⚠️ Sin control (server HTTP abierto) | ✅ Controlado | Tauri IPC — solo frontend local puede invocar comandos |
| **A02** | Cryptographic Failures | ✅ N/A | ✅ N/A | Sin datos sensibles que requieran cifrado en tránsito |
| **A03** | Injection (SQL) | 🔴 CRÍTICO — concatenación directa de strings en todas las queries | ✅ Eliminado | Prepared statements + validación de identificadores |
| **A04** | Insecure Design | 🔴 Servidor Node innecesario con credenciales hardcodeadas | ✅ Eliminado | Arquitectura Rust embebida — sin servidor externo |
| **A05** | Security Misconfiguration | 🔴 CSP nula en Tauri 1 | ✅ Configurado | CSP definida en `tauri.conf.json` para el app window |
| **A06** | Vulnerable Components | ⚠️ MySQL driver + Express desactualizables | ✅ Reducido | Stack simplificado — SQLite bundled sin dependencias de red |
| **A07** | Auth/Identification | 🔴 Password MySQL hardcodeada en `db.js` | ✅ Eliminado | Sin credenciales — SQLite es un archivo local de la app |
| **A08** | Data Integrity | ✅ N/A | ✅ N/A | No hay actualizaciones de software automáticas |
| **A09** | Logging Failures | 🔴 Sin logging estructurado | ✅ Mejorado | `eprintln!` con prefijo `[SERA]` para logs internos |
| **A10** | SSRF | ✅ N/A | ✅ N/A | No hay llamadas HTTP salientes desde el backend |

---

## 5. Consideraciones Adicionales

### CSP Configurada (Tauri 2)
```json
"csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' ipc: http://ipc.localhost"
```

- `script-src 'self'` — solo scripts del bundle propio
- `connect-src ipc:` — permite la comunicación Tauri IPC
- `unsafe-inline` en styles — requerido por Angular Material

### Datos en Reposo
- La base de datos SQLite se almacena en `%APPDATA%\sera\sera.db` (Windows)
- No hay cifrado del archivo SQLite en esta versión
- **Recomendación futura:** Si los datos son sensibles, considerar SQLCipher para cifrado

### Superficie de Ataque
- **Eliminado:** Puerto TCP 3000 (servidor Node.js)
- **Eliminado:** Credenciales MySQL en código fuente
- **Reducido a:** Tauri IPC local (equivalente a llamadas de función locales)

---

*Este reporte debe actualizarse cada vez que se agregue un nuevo comando Tauri, una dependencia nueva, o se modifique el sistema de permisos.*
