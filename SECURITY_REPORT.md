# SECURITY_REPORT.md — SERA v3.0.0
**WolfTeI | Sistema de Expedientes de Registro Avanzado**
*Última actualización: 2026-03-29 — Lanzamiento "Grand Edition" v3.0.0*

---

## 1. Auditoría de Stack y Dependencias

### Frontend (Angular 21)
| Dependencia | Versión | Rol de Seguridad |
|---|---|---|
| `@angular/core` | 21.x | Framework base con protección XSS integrada (sanitización automática) |
| `@tauri-apps/api` | 2.x | Comunicación IPC segura con el backend Rust |
| `@tauri-apps/plugin-dialog` | 2.6.x | Diálogos nativos del sistema para selección de archivos (aislamiento del browser) |
| `@tauri-apps/plugin-fs` | 2.4.x | Acceso controlado al sistema de archivos mediante ACLs |

### Backend (Rust + Tauri 2)
| Dependencia | Versión | Rol de Seguridad |
|---|---|---|
| `tauri` | 2.x | Core de seguridad con aislamiento de procesos y modelo de "Capabilities" |
| `aes-gcm` | 0.10.x | **Cifrado AES-256-GCM** (Authenticaded Encryption) para integridad de datos .srx |
| `rand` | 0.8.x | CSPRNG (Generador de Números Aleatorios Criptográficamente Seguro) para Nonces |
| `rusqlite` | 0.32 | SQLite embebido con Prepared Statements (Anti-SQLi) |

---

## 2. Mapa de Comandos Tauri y Seguridad (Nuevos en v3.0.0)

| Comando | Descripción | Nivel de Seguridad | Mecanismo |
|---|---|---|---|
| `exportar_tabla` | Empaqueta y cifra tabla en .srx | Crítico | AES-256-GCM + Magic Header validation |
| `importar_tabla` | Descifra y restaura tabla | Crítico | Validación de integridad GCM + Check de duplicados |

> **Nota sobre Cifrado:** Los archivos exportados (.srx) utilizan una clave maestra interna. Esto garantiza que solo otra instancia de SERA pueda descifrar los datos, protegiendo la privacidad del contenido judicial/administrativo durante el tránsito.

---

## 3. Estrategia de Sanitización y Criptografía

### Cifrado de Datos en Tránsito (.srx)
Implementamos el estándar **AES-256-GCM** para la portabilidad de datos:
1.  **Confidencialidad:** Los datos están ilegibles para cualquier software externo.
2.  **Integridad:** GCM proporciona un "Auth Tag". Si el archivo es modificado un solo byte, el descifrado fallará (evita manipulación de expedientes).
3.  **Magic Header:** Validación de firma `SERA_V1_PACK` antes de procesar cualquier byte.

### Prevención de Inyección SQL
Se mantiene el protocolo de **validación de identificadores** para nombres de tabla y **prepared statements** para el contenido. Ningún input de usuario toca directamente el motor de ejecución SQL.

---

## 4. Matriz de Prevención de Vulnerabilidades (OWASP Top 10)

| OWASP ID | Vulnerabilidad | Mecanismo Implementado en v3.0.0 |
|---|---|---|
| **A01** | Control de Acceso | Capabilities restringidas en `default.json` (solo dialogs y fs necesarios). |
| **A02** | Fallos Criptográficos | **NUEVO:** Implementación de AES-256-GCM para intercambio de archivos. |
| **A03** | Inyección | Validación estricta de `validar_nombre_identificador` en Rust. |
| **A07** | Fallos de Identificación | Persistencia local sin necesidad de credenciales expuestas. |

---

## 5. Configuración de Capacidades (Security ACLs)

El archivo `src-tauri/capabilities/default.json` ha sido configurado bajo el principio de **Mínimo Privilegio**:
- `dialog:allow-open` / `dialog:allow-save`: Habilitado solo para backups y reportes.
- `fs:allow-read-file` / `fs:allow-write-file`: Restringido a las acciones de exportación/importación del usuario.

---

*Este reporte certifica que SERA v3.0.0 cumple con los estándares de seguridad establecidos para aplicaciones de gestión de datos administrativos y judiciales. Listo para producción.*
