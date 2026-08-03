/**
 * Control de Vencimientos ⏰
 * Plugin Oficial de SERA v4
 *
 * Monitorea, calcula y resalta el estado de plazos de registros de forma dinámica.
 * Desarrollado con interfaz premium, heurística inteligente y persistencia local.
 */

(function () {
  'use strict';

  if (typeof window.SeraAPI === 'undefined') {
    console.error('[Control Vencimientos] window.SeraAPI no está disponible.');
    return;
  }

  const api = window.SeraAPI;
  const PLUGIN_ID = 'sera-plugin-vencimiento';
  
  // Guardar banners rechazados en esta sesión en memoria
  const bannersIgnorados = new Set();

  // ─────────────────────────────────────────────
  // A. INICIALIZAR Y REGISTRAR CELL RENDERERS
  // ─────────────────────────────────────────────

  // Carga configuraciones previas al arrancar y registra renderizadores
  const registrarRenderersGuardados = async () => {
    try {
      const tablas = await api.data.getTablas();
      const listaTablas = Array.isArray(tablas) ? tablas : [];

      listaTablas.forEach((t) => {
        const nombreTabla = t.nombre_tabla || t;
        const configRaw = localStorage.getItem(`sera-vencimiento-config-${nombreTabla.toLowerCase()}`);
        if (configRaw) {
          try {
            const config = JSON.parse(configRaw);
            if (config.colFecha) {
              // Registrar renderizador de celda dinámico para la columna de fecha configurada
              api.ui.registerCellRenderer(config.colFecha, (value, row) => {
                return calcularVencimientoBadge(value, row, config);
              });
              console.log(`[Control Vencimientos] Renderer registrado para tabla "${nombreTabla}" en columna "${config.colFecha}"`);
            }
          } catch (_) {}
        }
      });
    } catch (e) {
      console.warn('[Control Vencimientos] Error al precargar configuraciones:', e);
    }
  };

  // Ejecución inmediata
  registrarRenderersGuardados();

  // ─────────────────────────────────────────────
  // B. AUXILIARES DE CÁLCULO DE FECHAS
  // ─────────────────────────────────────────────

  // Analiza strings de fechas en formato ISO (YYYY-MM-DD) o Local (DD/MM/YYYY)
  const parsearFecha = (str) => {
    if (!str) return null;
    const trimStr = String(str).trim();
    
    // Formato ISO: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimStr)) {
      return new Date(trimStr + 'T00:00:00');
    }
    
    // Formato Local: DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimStr)) {
      const parts = trimStr.split('/');
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }

    const d = new Date(trimStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // Genera el badge HTML de colores para la celda
  const calcularVencimientoBadge = (value, row, config) => {
    if (!value) return '<span style="opacity:0.3">—</span>';
    
    let fechaLimite = null;
    let fechaBase = parsearFecha(value);
    
    if (!fechaBase) {
      return `<span style="opacity:0.5">${value}</span>`;
    }

    if (config.tipo === 'directa') {
      fechaLimite = fechaBase;
    } else if (config.tipo === 'calculada' && config.colPlazo) {
      const plazoDias = Number(row[config.colPlazo] || row[config.colPlazo.toUpperCase()] || 0);
      fechaLimite = new Date(fechaBase.getTime());
      fechaLimite.setDate(fechaLimite.getDate() + plazoDias);
    } else {
      return `<span>${value}</span>`;
    }

    // Calcular diferencia en días
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    fechaLimite.setHours(0, 0, 0, 0);
    
    const diffTime = fechaLimite.getTime() - hoy.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const fechaFormateada = `${String(fechaLimite.getDate()).padStart(2, '0')}/${String(fechaLimite.getMonth() + 1).padStart(2, '0')}/${fechaLimite.getFullYear()}`;

    if (diffDays < 0) {
      // Vencido
      return `
        <span class="badge-vencimiento-vencido" title="Vencido el ${fechaFormateada}">
          <span style="font-size:12px">⏳</span> Vencido hace ${Math.abs(diffDays)} d
        </span>
      `;
    } else if (diffDays <= 7) {
      // Alerta
      return `
        <span class="badge-vencimiento-alerta" title="Vence el ${fechaFormateada}">
          <span style="font-size:12px">⚠️</span> Vence en ${diffDays} d
        </span>
      `;
    } else {
      // Al día
      return `
        <span class="badge-vencimiento-ok" title="Vence el ${fechaFormateada}">
          <span style="font-size:12px">✅</span> Al día (${diffDays} d)
        </span>
      `;
    }
  };

  // ─────────────────────────────────────────────
  // C. DETECCIÓN HEURÍSTICA INTELIGENTE
  // ─────────────────────────────────────────────

  // Escanea campos para buscar posibles combinaciones de fechas y plazos
  const escanearCamposProbables = (campos) => {
    let colFechaProbable = null;
    let colPlazoProbable = null;
    let colVenceDirecta = null;

    campos.forEach((c) => {
      const nombre = (c.Field || c.nombre || '').toLowerCase();
      const tipo = (c.Type || c.tipo || '').toLowerCase();

      // Buscar campos de fecha de vencimiento directa
      if (nombre.includes('venc') || nombre.includes('vence') || nombre.includes('fecha_fin') || nombre.includes('deadline') || nombre.includes('limite')) {
        colVenceDirecta = c.Field || c.nombre;
      }
      
      // Buscar campos de fecha base
      if (nombre.includes('fecha') || nombre.includes('inicio') || nombre.includes('alta') || nombre.includes('date')) {
        if (!colFechaProbable) {
          colFechaProbable = c.Field || c.nombre;
        }
      }

      // Buscar campos de plazos/días
      if (nombre.includes('plazo') || nombre.includes('termino') || nombre.includes('dias') || nombre.includes('vigencia')) {
        if (tipo.includes('int') || tipo.includes('number') || tipo.includes('float') || tipo.includes('decimal') || tipo.includes('double')) {
          colPlazoProbable = c.Field || c.nombre;
        }
      }
    });

    if (colVenceDirecta) {
      return { tipo: 'directa', colFecha: colVenceDirecta };
    }
    if (colFechaProbable && colPlazoProbable) {
      return { tipo: 'calculada', colFecha: colFechaProbable, colPlazo: colPlazoProbable };
    }
    return null;
  };

  // ─────────────────────────────────────────────
  // D. FLUJO DE BANNER DE AUTODETECCIÓN EN CALIENTE
  // ─────────────────────────────────────────────

  // Detecta periódicamente si hay una tabla abierta para correr la heurística
  const chequearTablaActiva = async () => {
    const activeTab = document.querySelector('.desktop-tab-group .mdc-tab--active .tab-title');
    if (!activeTab) {
      // Remover banner de pantalla si existía
      removerBanner();
      return;
    }

    const rawName = activeTab.textContent.trim().toLowerCase().split(' ').join('_');
    
    // Ignorar si es una pestaña de resultados de búsqueda
    if (rawName.startsWith('res:')) {
      removerBanner();
      return;
    }

    // Verificar si ya tiene configuración guardada en localStorage o si el banner fue ignorado
    const guardada = localStorage.getItem(`sera-vencimiento-config-${rawName}`);
    if (guardada || bannersIgnorados.has(rawName)) {
      removerBanner();
      return;
    }

    // Evitar múltiples llamadas simultáneas
    if (document.querySelector('.vencimiento-banner')) return;

    try {
      const campos = await api.data.getCampos(rawName);
      if (!Array.isArray(campos) || campos.length === 0) return;

      const probable = escanearCamposProbables(campos);
      if (probable) {
        // Encontró campos probables. Inyectar banner inteligente.
        inyectarBannerAutodeteccion(rawName, probable);
      }
    } catch (_) {}
  };

  // Inyectar banner animado en la parte superior del espacio de trabajo
  const inyectarBannerAutodeteccion = (tabla, probable) => {
    removerBanner(); // Asegurar limpieza

    const workspace = document.querySelector('.main-workspace');
    if (!workspace) return;

    const banner = document.createElement('div');
    banner.className = 'vencimiento-banner';
    
    let mensajeSub = '';
    if (probable.tipo === 'directa') {
      mensajeSub = `Detectamos la columna directa de vencimiento: <strong>${probable.colFecha}</strong>`;
    } else {
      mensajeSub = `Detectamos campos para cálculo de plazos: <strong>${probable.colFecha}</strong> (fecha inicio) y <strong>${probable.colPlazo}</strong> (plazo en días)`;
    }

    banner.innerHTML = `
      <div class="vencimiento-banner-info">
        <span class="banner-icon">⏰</span>
        <div class="banner-text">
          <h4>¿Querés activar el Control de Vencimientos para "${tabla.split('_').join(' ').toUpperCase()}"?</h4>
          <p>${mensajeSub}</p>
        </div>
      </div>
      <div class="vencimiento-banner-actions">
        <button class="btn-decline" id="vencimiento-banner-decline">Configurar Manualmente</button>
        <button class="btn-decline" id="vencimiento-banner-close">Ahora No</button>
        <button class="btn-approve" id="vencimiento-banner-approve">Activar Alertas</button>
      </div>
    `;

    // Insertar banner al principio del contenedor principal
    workspace.insertBefore(banner, workspace.firstChild);

    // Eventos
    document.getElementById('vencimiento-banner-close').addEventListener('click', () => {
      bannersIgnorados.add(tabla);
      removerBanner();
    });

    document.getElementById('vencimiento-banner-decline').addEventListener('click', () => {
      removerBanner();
      abrirModalConfiguracion(tabla);
    });

    document.getElementById('vencimiento-banner-approve').addEventListener('click', () => {
      localStorage.setItem(`sera-vencimiento-config-${tabla}`, JSON.stringify(probable));
      bannersIgnorados.add(tabla);
      removerBanner();
      
      // Registrar Cell Renderer inmediatamente en caliente
      api.ui.registerCellRenderer(probable.colFecha, (value, row) => {
        return calcularVencimientoBadge(value, row, probable);
      });

      api.env.showNotification('¡Control de Vencimientos activado correctamente! Recargá la tabla para visualizar las alertas.', 'success');
    });
  };

  const removerBanner = () => {
    const banner = document.querySelector('.vencimiento-banner');
    if (banner) banner.remove();
  };

  // Poller de detección de tabla activa cada 2 segundos
  const intervalId = setInterval(chequearTablaActiva, 2000);

  // Limpiar recursos del interval si se descarga el plugin
  const observer = new MutationObserver(() => {
    const script = document.getElementById(`plugin-script-${PLUGIN_ID}`);
    if (!script) {
      clearInterval(intervalId);
      removerBanner();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ─────────────────────────────────────────────
  // E. MODAL DE CONFIGURACIÓN MANUAL
  // ─────────────────────────────────────────────

  // Abre el modal interactivo de glassmorphism para ajustar las columnas
  const abrirModalConfiguracion = async (tabla) => {
    try {
      const campos = await api.data.getCampos(tabla);
      if (!Array.isArray(campos) || campos.length === 0) {
        api.env.showNotification('No se pudieron recuperar las columnas de esta tabla.', 'error');
        return;
      }

      // Buscar configuración existente
      let configExistente = { tipo: 'directa', colFecha: '', colPlazo: '' };
      const guardada = localStorage.getItem(`sera-vencimiento-config-${tabla}`);
      if (guardada) {
        try { configExistente = JSON.parse(guardada); } catch (_) {}
      }

      // Crear overlay
      const overlay = document.createElement('div');
      overlay.className = 'vencimiento-modal-overlay';
      overlay.id = 'vencimiento-config-modal';

      // Construir opciones de select
      const optionsFecha = campos.map(c => `<option value="${c.Field || c.nombre}" ${configExistente.colFecha === (c.Field || c.nombre) ? 'selected' : ''}>${c.Field || c.nombre}</option>`).join('');
      const optionsPlazo = campos.map(c => `<option value="${c.Field || c.nombre}" ${configExistente.colPlazo === (c.Field || c.nombre) ? 'selected' : ''}>${c.Field || c.nombre}</option>`).join('');

      overlay.innerHTML = `
        <div class="vencimiento-modal">
          <div class="vencimiento-modal-header">
            <span class="modal-icon">⏰</span>
            <h3>Ajustar plazos de "${tabla.split('_').join(' ').toUpperCase()}"</h3>
          </div>
          <div class="vencimiento-modal-body">
            <p>Configurá cómo se calculan las fechas límites de tus expedientes para activar las alertas de vencimientos en la grilla.</p>
            
            <div class="vencimiento-field-group">
              <label for="vencimiento-select-tipo">Método de cálculo</label>
              <select id="vencimiento-select-tipo">
                <option value="directa" ${configExistente.tipo === 'directa' ? 'selected' : ''}>Fecha de Vencimiento Directa</option>
                <option value="calculada" ${configExistente.tipo === 'calculada' ? 'selected' : ''}>Fecha Inicio + Plazo en Días</option>
              </select>
            </div>

            <div class="vencimiento-field-group">
              <label id="vencimiento-label-fecha" for="vencimiento-select-fecha">Columna de Fecha base</label>
              <select id="vencimiento-select-fecha">
                ${optionsFecha}
              </select>
            </div>

            <div class="vencimiento-field-group" id="vencimiento-group-plazo" style="display: ${configExistente.tipo === 'calculada' ? 'flex' : 'none'}">
              <label for="vencimiento-select-plazo">Columna de Plazo (Días)</label>
              <select id="vencimiento-select-plazo">
                <option value="">-- Sin Plazo (0 días) --</option>
                ${optionsPlazo}
              </select>
            </div>
          </div>
          <div class="vencimiento-modal-footer">
            <button class="btn-cancel" id="vencimiento-btn-cancel">Cancelar</button>
            <button class="btn-save" id="vencimiento-btn-save">Guardar Ajustes</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      // Elementos y lógica del modal
      const selectTipo = document.getElementById('vencimiento-select-tipo');
      const groupPlazo = document.getElementById('vencimiento-group-plazo');
      const labelFecha = document.getElementById('vencimiento-label-fecha');

      selectTipo.addEventListener('change', () => {
        if (selectTipo.value === 'calculada') {
          groupPlazo.style.display = 'flex';
          labelFecha.textContent = 'Columna de Fecha de Inicio';
        } else {
          groupPlazo.style.display = 'none';
          labelFecha.textContent = 'Columna de Fecha de Vencimiento';
        }
      });

      document.getElementById('vencimiento-btn-cancel').addEventListener('click', () => {
        overlay.remove();
      });

      document.getElementById('vencimiento-btn-save').addEventListener('click', () => {
        const config = {
          tipo: selectTipo.value,
          colFecha: document.getElementById('vencimiento-select-fecha').value,
          colPlazo: selectTipo.value === 'calculada' ? document.getElementById('vencimiento-select-plazo').value : null
        };

        if (!config.colFecha) {
          api.env.showNotification('Tenés que seleccionar al menos la columna de fecha.', 'error');
          return;
        }

        // Guardar persistente
        localStorage.setItem(`sera-vencimiento-config-${tabla}`, JSON.stringify(config));
        
        // Registrar Cell Renderer inmediatamente en caliente
        api.ui.registerCellRenderer(config.colFecha, (value, row) => {
          return calcularVencimientoBadge(value, row, config);
        });

        overlay.remove();
        api.env.showNotification('¡Configuración de plazos guardada! Recargá la tabla para ver los cambios.', 'success');
      });

    } catch (err) {
      console.error('[Control Vencimientos] Error al abrir configurador:', err);
    }
  };

  // ─────────────────────────────────────────────
  // F. BOTÓN EN EL RIBBON DE LA APP
  // ─────────────────────────────────────────────
  api.ui.registerRibbonButton({
    id: `${PLUGIN_ID}-config-btn`,
    label: 'Plazos y Alertas',
    icon: 'alarm',
    tooltip: 'Configura las columnas y alertas de Control de Vencimientos',
    action: async () => {
      const activeTab = document.querySelector('.desktop-tab-group .mdc-tab--active .tab-title');
      if (!activeTab) {
        api.env.showNotification('Abrí una tabla para poder configurar los plazos de vencimientos.', 'info');
        return;
      }

      const rawName = activeTab.textContent.trim().toLowerCase().split(' ').join('_');
      if (rawName.startsWith('res:')) {
        api.env.showNotification('La pestaña activa es de búsquedas. Seleccioná una tabla real.', 'info');
        return;
      }

      // Abrir modal configurador
      abrirModalConfiguracion(rawName);
    }
  });

  console.log('[Control Vencimientos] Plugin inicializado correctamente ✅');

})();
