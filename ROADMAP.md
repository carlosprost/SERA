# SERA Roadmap — Plan de Vuelo (Evolución y Futuro) 🚀

Este documento detalla las funcionalidades planificadas para las próximas versiones mayores (v4.x / v5.x), así como el historial de hitos completados y descartados.

---

## 💎 Estrategia de Producto y Monetización
El modelo de negocio de SERA mantiene la filosofía **sin suscripciones** y privacidad total (100% offline). La rentabilidad se basará en:

1. **Core Gratuito Intocable:** Las herramientas base, el motor relacional (V-Engine), las reglas visuales, el borrado masivo y el buscador Spotlight seguirán siendo 100% gratuitos para maximizar la adopción.
2. **Licencia SERA Pro (Pago Único):** Desbloqueo mediante *In-App Purchase* en la Microsoft Store para entornos de alta exigencia. Esta licencia perpetua activará funcionalidades "Power User":
   - **LAN Sync** (Sincronización P2P en red local).
   - **SERA Copilot** (IA Local).
   - **Workflows** (Automatizaciones en segundo plano).
   - **Bóveda Biométrica** (Cifrado selectivo por columnas).
3. **Kits por Industria (Add-ons):** Venta en tienda interna de plantillas pre-configuradas (archivos `.srx`) orientadas a nichos específicos (Ej: *SERA Legal*, *SERA Policial*, *SERA Inventario Pyme*).

---

## 🔮 Próximos Hitos: Ciclo Poseidón (v4.x) y Atenea (v5.x)

### 1. 🤖 SERA Copilot: IA 100% Local (Privacy-First)
- **Estado:** EN PLANIFICACIÓN 📝
- **Detalle:** Integración de un motor LLM ligero empaquetado y ejecutado directamente en Tauri.
- **Objetivo:** Interactuar con la base de datos mediante lenguaje natural ("Buscá los registros vencidos", "Armá un resumen del caso"). Todo el procesamiento es en la CPU/GPU local.

### 2. ⚙️ Motor de Automatizaciones (Workflows)
- **Estado:** EN PLANIFICACIÓN 📝
- **Detalle:** Sistema de reglas lógicas de causa-efecto integradas a las tablas (`SI pasa X, ENTONCES hacer Y`).

### 3. 🔌 Ecosistema Abierto: API Local y Plugins
- **Estado:** PARCIALMENTE COMPLETADO 🚀
- **Detalle:** 
  - **API Local Restringida:** *En Desarrollo 📝* — Microservidor REST en `localhost` protegido con Token para interactuar con SERA vía Python/PowerShell.
  - **Plugins Dinámicos:** *Lanzados y Publicados (v4.1.0) ✅* — Carga en caliente offline y sandbox `window.SeraAPI`. Se publicaron y catalogaron los primeros **7 plugins oficiales en producción** (CBU, CUIT, Redactor PII, Vencimientos, Barcodes, Patentes Metálicas 3D y Creador de Documentos Offline).
  - **Actualizaciones y Control de Versiones en Marketplace:** *En Planificación 📝 (previsto para v4.2.0)* — Sistema inteligente de detección de versiones para comparar la versión local con la remota y permitir la actualización de plugins en caliente con un solo click.

### 4. 📡 LAN Sync: Sincronización P2P en Red Local
- **Estado:** APROBADO ✅
- **Detalle:** Protocolo de sincronización directa entre computadoras en la misma oficina (red WiFi/LAN). Trabajo colaborativo sin salir a internet.

### 5. 🔔 Modo "System Tray" (Ejecución Silenciosa)
- **Estado:** APROBADO ✅
- **Detalle:** Minimizar SERA al área de notificaciones (junto al reloj de Windows).
- **Objetivo:** Fundamental para que los *Workflows* automáticos, la sincronización *LAN Sync* y la *API Local* sigan operando en segundo plano sin estorbar en la barra de tareas.

### 6. 🔐 Bóveda de Campos Biométricos (Cifrado Selectivo)
- **Estado:** EN PLANIFICACIÓN 📝
- **Detalle:** Marcar columnas específicas como "Ultrasensibles" (`[********]`). Para revelarlas, SERA pedirá la huella digital o el PIN a través de la integración nativa con Windows Hello.

### 7. 🗺️ Georreferenciación y Mapas Offline
- **Estado:** COMPLETADO VÍA PLUGIN ✅
- **Detalle:** Integrado con éxito a través del plugin oficial "Localizador Geográfico" (`sera-plugin-mapa`). Permite visualización interactiva en OpenStreetMap y mapeo unificado offline de coordenadas sin trackers de terceros.

### 8. 📤 Buzón de Ingreso Offline (Data Dropzones)
- **Estado:** EN PLANIFICACIÓN 📝
- **Detalle:** Exportación de formularios web HTML sueltos. Permite que terceros llenen información offline, generen un archivo `.srx-data` encriptado, y se incorporen arrastrándolos a SERA.

### 9. ⏳ Máquina del Tiempo (Historial de Revisiones)
- **Estado:** EN PLANIFICACIÓN 📝
- **Detalle:** Snapshotting por cada registro. Permite ver qué campos cambiaron, cuándo y revertir modificaciones específicas (Rollback estilo control de versiones).

### 10. 🪪 OCR y Extracción Inteligente de Imágenes
- **Estado:** EN ANÁLISIS / POSTERGADO 🕒
- **Detalle:** Extraer texto automáticamente de fotos (DNI, expedientes) arrastradas a SERA usando OCR local.

### 11. ⌨️ Motor de Productividad Avanzado (Atajos de Teclado Globales y Contextuales)
- **Estado:** EN PLANIFICACIÓN 📝 (previsto para v4.3.0)
- **Detalle:** Implementación de un sistema integral de atajos de teclado para operaciones rápidas sin mouse.
- **Objetivos de Cobertura:**
  - **Globales:** Nueva tabla (`Ctrl + N`), Paleta de comandos (`Ctrl + P`), Importar archivo (`Ctrl + I`), Exportar base de datos (`Ctrl + E`), Acerca de SERA (`F1`).
  - **En Grilla:** Nuevo registro (`Ctrl + Enter`), Editar registro seleccionado (`Enter` / Doble clic), Eliminar registros seleccionados (`Supr`), Seleccionar todo (`Ctrl + A`), Filtrar tabla (`Ctrl + Shift + L`), Generar PDF (`Ctrl + Shift + P`).
  - **En Formularios:** Guardar registro (`Ctrl + S`), cerrar/cancelar ventana (`Esc`).

---

## ✅ Hitos Completados & Estabilizados (Serie v3.x y v4.0.0 Poseidón)

### 1. 📎 Sistema de Adjuntos Pro
- Gestión de archivos asociados por registro con almacenamiento local seguro, apertura nativa y control granular por tabla.

### 2. 🔗 Relaciones entre Tablas (Lookups)
- Conexión dinámica entre tablas con selectores asíncronos y traducción de IDs en tiempo real.

### 3. 🧪 V-Engine: Fórmulas Inteligentes
- Motor de cálculo virtual tipo Excel con soporte para funciones lógicas, matemáticas y operadores `OR/AND`.

### 4. 📊 Dashboard de Estadísticas Visuales
- Panel inteligente con gráficos de Chart.js, selector dinámico de campos y análisis en tiempo real.

### 5. 🔍 Buscador Global (Deep Search)
- Sistema de búsqueda profunda "Spotlight" (`Ctrl+Shift+F`) que indexa todas las tablas en tiempo real con capacidad de salto al registro.

### 6. 🛠️ Acciones Masivas y Auditoría (ISO 27001)
- Borrado masivo, auditoría persistente SQLite de eventos críticos y exportación PDF profesional (membretes/firmas).

### 7. 🔌 Ecosistema de Plugins en Caliente (v4.0.0)
- Hot-loading offline en caliente mediante Blob URLs, sandbox visual y de datos robusto (`window.SeraAPI`) y Marketplace descentralizado integrado.

---

## 🚫 Funcionalidades Descartadas del Plan de Vuelo
- **Vistas Gráficas Avanzadas (Kanban/Calendario):** *Descartado.* Por riesgo técnico de inestabilidad en el motor de tablas actual.
- **🎭 Roles y Permisos (RBAC Simple):** *Descartado.* No aporta valor real a una herramienta local de terminal única.
- **Edición Masiva:** *Descartado.* Falta de aplicabilidad práctica real sin sobrecargar la UI.

---

## 🏆 Estado del Sistema
**SERA ha alcanzado una fase de gran madurez y estabilidad funcional.** Todas las herramientas principales del core se encuentran optimizadas bajo los estándares de seguridad OWASP y certificadas para el entorno de Windows Store.
