# SERA — Sistema de Expedientes de Registro Avanzado

> **v3.3.0 "Ares"** · Desarrollado por [WolfTeI](https://wolftei.com.ar/)
> *Edición del Ciclo Phoenix-330 (Mayo 2026)*

Aplicación de escritorio nativa de alto rendimiento para la gestión de registros digitales complejos. Ahora con **Portabilidad Relacional Completa**, **Motor Relacional**, **Columnas Inteligentes** y **Generador de Reportes PDF Interactivos**.

---

## ✨ Características Principales

- **Portabilidad Relacional Completa (.srx) 🆕** — Al exportar cualquier tabla que contenga vínculos/relaciones, el sistema detecta de forma recursiva todas las tablas vinculadas y las empaqueta juntas en un único archivo encriptado. En la importación, el sistema autodetecta las tablas incluidas, resuelve colisiones primarias de manera segura con `INSERT OR IGNORE` y reconstruye los vínculos y adjuntos correspondientes.
- **Checkbox de Adjuntos Unificado 🆕** — La opción para exportar adjuntos ahora empaqueta los archivos físicos de *todas* las tablas involucradas en la exportación relacional de forma automática en una carpeta de adjuntos unificada dentro del contenedor blindado.
- **Motor Relacional (Vínculos)** — Establecé relaciones entre tablas. Seleccioná datos de otras tablas mediante desplegables asíncronos inteligentes que resuelven traducciones de ID a campos descriptivos de forma dinámica.
- **Columnas Inteligentes (Fórmulas)** — Motor de cálculo virtual tipo Excel. Creá columnas virtuales calculadas en tiempo real usando funciones lógicas, aritméticas y condicionales (`SI()`, `DIF_DIAS()`, `CONCAT()`, `MAYUS()`, etc.) y operadores `OR/AND` protegidos.
- **Generador de Reportes PDF Premium** — Diseñá reportes personalizados ordenando columnas por arrastre (*Drag & Drop*). Cuenta con una pantalla de carga interactiva con un spinner premium de efecto glow/desenfoque y una arquitectura asíncrona aislada para una experiencia de usuario fluida.
- **Configuración Granular de Tablas** — Controlá si una tabla permite adjuntos de archivos físicos o no, manteniendo el sistema optimizado y adaptado al tipo de información que manejás.
- **Reglas de Formato Condicional** — Pintá filas o celdas individuales automáticamente basándote en condiciones dinámicas y lógicas complejas (ej: `prioridad == 'URGENTE'`).
- **Buscador Global "Spotlight" (Deep Search)** — Motor de indexación ultrarrápido (`Ctrl+Shift+F`) que busca a través de todos los campos de todas tus tablas a la vez, con salto directo al registro e interfaz dedicada.
- **Importación Masiva (Excel/CSV)** — Cargá miles de registros instantáneamente. SERA detecta la estructura automáticamente, mapea los campos de origen a destino y valida los tipos de datos en base a reglas del catálogo.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Versión | Rol |
|---|---|---|---|
| **UI Framework** | Angular (Signals & Control Flow) | 21.0.0 | Capa de vista reactiva de alta velocidad |
| **Design System** | Angular Material (Material 3) | 21.0.0 | Componentes oscuros premium de alta productividad |
| **Desktop Runtime** | Tauri | 2.x | Runtime nativo y seguro con comunicación IPC blindada |
| **Backend / Lógica** | Rust | 2021 Edition | Motor nativo asíncrono y gestor criptográfico |
| **Base de Datos** | SQLite (Relational Engine) | — | Almacenamiento local estructurado |
| **Visual Library** | Chart.js & ng2-charts | 4.x / 10.x | Analítica visual y gráficos interactivos |
| **PDF Renderer** | html2canvas & jsPDF | 1.4 / 2.5 | Captura y renderizado de reportes A4 a PDF |
| **Packaging Utility**| zip | 2.2.1 | Creador de contenedores comprimidos y encriptados para portabilidad |

---

## 🚀 Instalación y Uso

### Instalar desde la Microsoft Store
SERA es una aplicación certificada para Windows. Buscá "SERA" en la **Microsoft Store** para obtener la versión oficial con firmas criptográficas válidas y actualizaciones automáticas de seguridad transparentes.

### Ejecutar en modo desarrollo
Si sos desarrollador de WolfTeI, podés correr el entorno local siguiendo estos pasos:
```bash
# Requisitos previos: Node.js 18+, Rust (stable), Angular CLI 21
npm install --legacy-peer-deps
npm run tauri dev
```

---

## 🔒 Seguridad y Blindaje (OWASP Top 10)

SERA implementa una arquitectura defensiva estricta por diseño:
- **Portabilidad Defensiva (v3.3.0):** Descarte de columnas virtuales/huérfanas e inyección controlada de datos relacionales mediante transacciones atómicas con mitigación de colisiones primarias (`INSERT OR IGNORE`), impidiendo inyecciones lógicas e inconsistencia referencial.
- **Sanitización de Reportes:** Escape automático de todos los textos configurados por el usuario mediante `textContent` nativo antes de la renderización del PDF, bloqueando inyecciones HTML y ataques XSS (OWASP A03).
- **Aislamiento Léxico en V-Engine:** Las fórmulas se tokenizan y evalúan dentro de contextos sin acceso a variables del navegador, de Tauri ni globales.
- **Consultas Parametrizadas:** Blindaje absoluto contra SQL Injection mediante Prepared Statements nativos en Rust con `rusqlite`.
- **Cifrado de Secretos:** Algoritmo AES-256-GCM (criptografía AEAD) para garantizar confidencialidad e integridad del empaquetado `.srx`.

Ver el reporte de auditoría completo en [`SECURITY_REPORT.md`](./SECURITY_REPORT.md).

---

## 📋 Historial de Versiones

### v3.3.0 "Ares" — 2026-05-16 — (Phoenix-330)
- **Funcionalidad (Portabilidad Relacional):** Implementación de exportación conjunta recursiva de tablas vinculadas.
- **Funcionalidad (Aislamiento de Tabs):** Desacoplamiento arquitectónico del Store de NgRx mediante diccionarios por tabla, resolviendo bugs de checkboxes concurrentes y formularios cruzados.
- **Seguridad (OWASP A08):** Mitigación de colisiones primarias durante importaciones masivas concurrentes mediante la adopción defensiva de transacciones robustas con `INSERT OR IGNORE`.
- **Retrocompatibilidad:** Soporte integrado para autodetectar e importar paquetes `.srx` multi-tabla o legacy unidimensionales sin fricción de usuario.

### v3.2.1 "Ares" — 2026-05-16 — (Phoenix-321)
- **Mejora UI:** Pantalla de carga interactiva con spinner premium y efecto de desenfoque/glow para la generación de reportes PDF.
- **Arquitectura:** Refactorización asíncrona en `PdfService` para instanciar contenedores HTML dinámicos aislados del DOM.
- **Seguridad (OWASP A03):** Escape automático de todos los textos del reporte PDF mediante `textContent` para neutralizar inyecciones HTML/XSS.

### v3.2.0 "Ares" — 2026-05-11 — (Phoenix-320)
- **Funcionalidad:** Implementación de Vínculos Relacionales entre tablas.
- **Funcionalidad:** Nuevo motor de Columnas Inteligentes (Virtual Calculations) en frontend.
- **Mejora UI:** Soporte para adjuntos condicionales y control granular por tabla.
- **Motor de Reglas:** Soporte para operadores lógicos `OR` en formato condicional.

---

## 🤝 Contacto
**WolfTeI** · [wolftei.com.ar](https://wolftei.com.ar/)
