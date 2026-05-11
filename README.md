# SERA — Sistema de Expedientes de Registro Avanzado

> **v3.2.0 "Ares"** · Desarrollado por [WolfTeI](https://wolftei.com.ar/)

Aplicación de escritorio nativa de alto rendimiento para la gestión de registros digitales complejos. Ahora con **Motor Relacional** y **Columnas Inteligentes**.

---

## ✨ Características Principales

- **Motor Relacional (Vínculos) 🆕** — Establecé relaciones entre tablas. Seleccioná datos de otras tablas mediante desplegables asíncronos inteligentes.
- **Columnas Inteligentes (Fórmulas) 🆕** — Motor de cálculo virtual tipo Excel. Creá columnas que se calculan en tiempo real usando funciones como `SI()`, `DIF_DIAS()`, `CONCAT()` y operadores lógicos `OR/AND`.
- **Configuración Granular de Tablas 🆕** — Controlá si una tabla permite adjuntos de archivos o no, manteniendo tu base de datos limpia y eficiente.
- **Reglas de Formato Condicional 🆕** — Pintá tus filas y celdas automáticamente con lógica avanzada (ej: `Urgente OR Prioritario`).
- **Importación Masiva (Excel/CSV)** — Cargá miles de registros instantáneamente. SERA detecta la estructura y valida los tipos de datos.
- **Exportación / Importación Cifrada (.srx)** — Portabilidad de datos protegida con AES-256-GCM y llaves derivadas por el usuario.
- **Tematización Dinámica (Material 3) 🆕** — Personalización total de la interfaz con 4 temas exclusivos (Dark, Midnight, Emerald, Light) y persistencia inteligente de preferencias.
- **Interfaz Ribbon "Phoenix" 🆕** — Evolución de la interfaz Ribbon con mayor espaciado, mejor ritmo vertical y optimización para monitores de alta resolución.
- **Importación Masiva (Excel/CSV)** — Cargá miles de registros instantáneamente. SERA detecta la estructura y valida los tipos de datos.
- **Exportación / Importación Cifrada (.srx)** — Portabilidad de datos protegida con AES-256-GCM y llaves derivadas por el usuario. Paquetizado inteligente que incluye adjuntos.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| UI Framework | Angular (Signals & Control Flow) | 21.x |
| Design System | Angular Material (Material 3) | 21.x |
| Desktop Runtime | Tauri | 2.x |
| Backend / Lógica | Rust | 2021 Edition |
| Base de Datos | SQLite (Relational Engine) | — |
| Formula Engine | Custom SERA V-Engine | v3.2 |

---

## 🚀 Instalación y Uso

### Instalar desde la Microsoft Store
SERA es una aplicación certificada. Buscá "SERA" en la **Microsoft Store** para obtener la versión oficial con actualizaciones automáticas de seguridad.

### Ejecutar en modo desarrollo
```bash
# Requisitos: Node.js 18+, Rust (stable), Angular CLI 21
npm install --legacy-peer-deps
npm run tauri dev
```

---

## 🔒 Seguridad (Cumplimiento OWASP)

SERA implementa una arquitectura de seguridad por diseño:
- **Sanitización de Fórmulas:** El motor virtual está aislado para evitar ejecuciones maliciosas.
- **Protección SQLi:** Validación estricta de identificadores y uso de Prepared Statements.
- **Cifrado AEAD:** AES-256-GCM para proteger la integridad y confidencialidad de los datos exportados.

Ver el reporte completo en [`SECURITY_REPORT.md`](./SECURITY_REPORT.md).

---

## 📋 Historial de Versiones

### v3.2.0 "Ares" — 2026-05-11 — (Phoenix-320)
- **Funcionalidad:** Implementación de Vínculos Relacionales entre tablas.
- **Funcionalidad:** Nuevo motor de Columnas Inteligentes (Virtual Calculations).
- **Mejora UI:** Soporte para adjuntos condicionales por tabla.
- **Motor de Reglas:** Soporte para operadores lógicos `OR` en formato condicional.

### v3.1.0 "Ares" — 2026-05-10
- **Nueva Función:** Importación masiva desde Excel (`.xlsx`, `.xls`) y `.csv`.
- **Seguridad:** Soporte para contraseñas de usuario en archivos `.srx`.

---

## 🤝 Contacto
**WolfTeI** · [wolftei.com.ar](https://wolftei.com.ar/)
