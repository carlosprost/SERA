# ⏰ Control de Vencimientos y Plazos para SERA

Este plugin oficial de **SERA** te permite monitorear y calcular plazos de tus expedientes directamente en la grilla principal, aplicando colores y alertas estéticas de vencimientos en tiempo real.

---

## 🚀 Características
- **Detección Inteligente:** El plugin escanea automáticamente las columnas al abrir tu tabla y te propone la configuración óptima en un solo click (Heurística automática).
- **Cálculo Directo o Compuesto:**
  - **Fecha Directa:** Pinta las celdas en base a una fecha límite fija.
  - **Fecha Compuesta (Fecha Inicio + Plazo en Días):** Calcula la fecha de vencimiento sumando los días de plazo a la fecha base en tiempo real y pinta el estado.
- **Glassmorphism Configurator:** Panel interactivo integrado con diseño oscuro premium para ajustar manualmente las columnas asociadas.
- **Persistencia Local (LocalStorage):** Las configuraciones se guardan de forma 100% offline y segura por cada tabla en el navegador local, sin realizar conexiones remotas.

---

## 🛠️ Estructura del Código
- `manifest.json`: Metadatos e icono del plugin.
- `dist/index.js`: IIFE que inicializa la API `window.SeraAPI`, implementa el algoritmo de cálculo de plazos, renderiza las celdas e inyecta el configurador visual y el banner de bienvenida.
- `dist/style.css`: Estilos visuales de los badges y la ventana modal con diseño traslúcido.

---

## 📜 Licencia
Este plugin está liberado bajo la licencia **MIT** de código abierto para libre distribución y modificación por la comunidad.
