# SERA — Sistema de Expedientes de Registro Avanzado

> **v3.0.1 "Grand Edition"** · Desarrollado por [WolfTeI](https://wolftei.com.ar/)

Aplicación de escritorio nativa para la gestión eficiente, segura y profesional de registros digitales. Construida sobre **Angular 21** y **Tauri 2** con backend **Rust**.

---

## ✨ Características Principales

- **Tablas Dinámicas** — Creá tablas personalizadas definiendo sus propios campos y tipos de datos.
- **Gestión Completa de Registros** — Alta, modificación y baja de registros con interfaz Ribbon.
- **Exportación / Importación Cifrada (.srx)** — Portabilidad de datos protegida con AES-256-GCM. Solo otra instancia de SERA puede descifrar el contenido.
- **Generación de PDF** — Exportá reportes de tus registros directamente desde la app.
- **Paleta de Comandos** — Acceso rápido a todas las funciones vía `Ctrl+F`.
- **Búsqueda y Filtrado** — Filtrá registros en tiempo real dentro de cualquier tabla.
- **Tema Oscuro** — Interfaz "Deep Professional" con diseño Material 3.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| UI Framework | Angular | 21.x |
| UI Components | Angular Material | 21.x |
| State Management | NgRx | 19.x |
| Desktop Runtime | Tauri | 2.x |
| Backend / Lógica | Rust | 2021 Edition |
| Base de Datos | SQLite (rusqlite bundled) | — |
| Cifrado | AES-256-GCM (aes-gcm) | 0.10.x |

---

## 🚀 Instalación y Uso

### Instalar desde los distribuidores

Descargá el instalador de la [última release](https://github.com/carlosprost/SERA/releases):

- `SERA_3.0.1.exe` — Instalador NSIS para Windows (recomendado)
- `SERA_3.0.1.msi` — Paquete MSI para despliegues empresariales

### Ejecutar en modo desarrollo

Requisitos previos: **Node.js 18+**, **Rust (stable)**, **Angular CLI 21**.

```bash
# Clonar el repositorio
git clone https://github.com/carlosprost/SERA.git
cd SERA

# Instalar dependencias
npm install

# Iniciar en modo desarrollo
npm run tauri dev
```

### Compilar para producción

```bash
# Compilar y generar instaladores
npm run tauri build

# Renombrar instaladores al formato limpio (SERA_X.X.X.exe / .msi)
npm run rename-installers
```

Los instaladores se generan en `src-tauri/target/release/bundle/`.

---

## 📁 Estructura del Proyecto

```
SERA/
├── src/                        # Frontend Angular
│   ├── app/
│   │   ├── components/         # Componentes reutilizables (Ribbon, Dialogs, etc.)
│   │   ├── pages/              # Vistas de rutas
│   │   ├── services/           # Servicios (PDF, etc.)
│   │   ├── store/              # Estado global NgRx
│   │   └── interfaces/         # Tipos e interfaces TypeScript
│   └── styles.scss             # Estilos globales
├── src-tauri/                  # Backend Rust
│   ├── src/
│   │   ├── commands/           # Comandos Tauri expuestos al frontend
│   │   ├── database/           # Capa de acceso a SQLite
│   │   ├── models/             # Structs de datos
│   │   ├── security.rs         # Módulo de cifrado AES-256-GCM
│   │   └── main.rs             # Entry point de la app
│   ├── capabilities/           # ACLs de permisos Tauri
│   └── tauri.conf.json         # Configuración principal de Tauri
├── scripts/
│   └── rename-installers.js    # Script post-build de renombrado
└── SECURITY_REPORT.md          # Auditoría de seguridad
```

---

## 🔒 Seguridad

SERA implementa múltiples capas de protección para datos administrativos y judiciales:

- **Cifrado AES-256-GCM** para archivos de exportación `.srx`.
- **Prepared Statements** en todas las operaciones de base de datos (Anti-SQLi).
- **CSP estricta** que bloquea conexiones externas no autorizadas.
- **Modelo de Capabilities** (Mínimo Privilegio) en el runtime de Tauri.
- **Mensajes de error genéricos** al usuario; detalles técnicos solo en logs internos.

Ver el reporte completo en [`SECURITY_REPORT.md`](./SECURITY_REPORT.md).

---

## 📋 Changelog

### v3.0.1 — 2026-05-10
- **Fix:** Fuentes (Roboto, Material Icons) no cargaban en builds de producción compilados. Se migraron de Google CDN a bundles locales (`@fontsource/roboto`, `material-icons`).
- **Mejora:** Script `rename-installers.js` para generar instaladores con nombre limpio (`SERA_X.X.X.exe`).

### v3.0.0 — 2026-03-29 — "Grand Edition"
- Rediseño completo de UI con interfaz Ribbon.
- Implementación de cifrado AES-256-GCM para portabilidad de datos (.srx).
- Paleta de comandos global (`Ctrl+F`).
- Diálogo "Acerca de" con branding WolfTeI.
- Backend Rust modularizado (commands, database, models, security).

---

## 🤝 Contacto

**WolfTeI** · [wolftei.com.ar](https://wolftei.com.ar/)
