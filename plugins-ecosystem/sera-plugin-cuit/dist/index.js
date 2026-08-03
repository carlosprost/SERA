/**
 * Validador de CUIT/CUIL 🇦🇷
 * Plugin Oficial de SERA v4
 *
 * Valida la integridad estructural de CUITs/CUILs de forma automática.
 * Intercepta inserciones a la base de datos y formatea visualmente la grilla de datos.
 */

(function () {
  'use strict';

  if (typeof window.SeraAPI === 'undefined') {
    console.error('[Validador CUIT] window.SeraAPI no está disponible.');
    return;
  }

  const api = window.SeraAPI;
  const PLUGIN_ID = 'sera-plugin-cuit';

  // Algoritmo de validación de CUIT (Módulo 11)
  const validarCUIT = (cuit) => {
    const raw = String(cuit).replace(/\D/g, '');
    if (raw.length !== 11) return false;

    const factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;
    for (let i = 0; i < 10; i++) {
      suma += parseInt(raw[i]) * factores[i];
    }
    
    let verificadorCalculado = 11 - (suma % 11);
    if (verificadorCalculado === 11) verificadorCalculado = 0;
    if (verificadorCalculado === 10) verificadorCalculado = 9;

    const verificadorReal = parseInt(raw[10]);
    return verificadorCalculado === verificadorReal;
  };

  // Formateador estético a XX-XXXXXXXX-X
  const formatearCUIT = (cuit) => {
    const raw = String(cuit).replace(/\D/g, '');
    if (raw.length !== 11) return cuit;
    return `${raw.substring(0, 2)}-${raw.substring(2, 10)}-${raw.substring(10)}`;
  };

  // 1. REGISTRAR CELL RENDERERS E INTERCEPTORES DE FORMA DINÁMICA Y TOLERANTE
  const inicializarRenderersYInterceptores = async () => {
    try {
      const tablas = await api.data.getTablas();
      const listaTablas = Array.isArray(tablas) ? tablas : [];

      for (const t of listaTablas) {
        const nombreTabla = t.nombre_tabla || t;
        const campos = await api.data.getCampos(nombreTabla);
        
        // Buscamos cualquier campo cuyo nombre contenga "cuit" o "cuil" (e.g., cuit, cuil, cuit/cuil, cuit-cuil, etc.)
        const camposCuit = campos.filter(c => {
          const name = (c.Field || c.nombre || '').toLowerCase();
          return name.includes('cuit') || name.includes('cuil');
        });

        for (const campo of camposCuit) {
          const nombreCampo = campo.Field || campo.nombre;
          
          // Registrar el cell renderer para esta columna específica en minúsculas
          api.ui.registerCellRenderer(nombreCampo.toLowerCase(), (value) => {
            if (!value) return '<span style="opacity:0.3">—</span>';
            
            const esValido = validarCUIT(value);
            const formateado = formatearCUIT(value);

            if (esValido) {
              return `
                <span class="badge-cuit-valido" title="CUIT/CUIL Válido">
                  <span style="font-size:12px">✓</span> ${formateado}
                </span>
              `;
            } else {
              return `
                <span class="badge-cuit-invalido" title="CUIT/CUIL Inválido (Verificador incorrecto)">
                  <span style="font-size:12px">⚠️</span> ${formateado}
                </span>
              `;
            }
          });

          // Registrar interceptor de inserción/edición
          api.data.onBeforeInsert(nombreTabla, async (record) => {
            const campoClave = Object.keys(record).find(k => k.toLowerCase() === nombreCampo.toLowerCase()) || nombreCampo;
            const valorCuit = record[campoClave];

            if (valorCuit) {
              const esValido = validarCUIT(valorCuit);
              if (!esValido) {
                throw new Error(`[Validador CUIT] El CUIT/CUIL "${valorCuit}" ingresado en "${nombreCampo}" posee un dígito verificador inválido.`);
              }
              // Normalizar a puros números antes de persistir físicamente en SQLite
              record[campoClave] = String(valorCuit).replace(/\D/g, '');
            }
            return record;
          });
          console.log(`[Validador CUIT] Interceptor y Renderer activados para tabla "${nombreTabla}", columna "${nombreCampo}"`);
        }
      }
    } catch (e) {
      console.warn('[Validador CUIT] Error al inicializar renderers e interceptores:', e);
    }
  };

  inicializarRenderersYInterceptores();

  // 3. BOTÓN EN EL RIBBON (AUDITORÍA RÁPIDA)
  api.ui.registerRibbonButton({
    id: `${PLUGIN_ID}-audit-btn`,
    label: 'Auditar CUITs',
    icon: 'verified',
    tooltip: 'Audita la integridad de todos los CUITs de la tabla abierta',
    action: async () => {
      const activeTab = document.querySelector('.desktop-tab-group .mdc-tab--active .tab-title');
      if (!activeTab) {
        api.env.showNotification('Por favor, abrí una tabla para auditar sus CUITs.', 'info');
        return;
      }

      const rawName = activeTab.textContent.trim().toLowerCase().split(' ').join('_');
      if (rawName.startsWith('res:')) {
        api.env.showNotification('Pestaña de búsqueda activa. Por favor abrí una tabla real.', 'info');
        return;
      }

      try {
        const campos = await api.data.getCampos(rawName);
        const campoCuit = campos.find(c => {
          const name = (c.Field || c.nombre || '').toLowerCase();
          return name.includes('cuit') || name.includes('cuil');
        });

        if (!campoCuit) {
          api.env.showNotification(`La tabla "${activeTab.textContent.trim()}" no posee ninguna columna de tipo CUIT/CUIL.`, 'warning');
          return;
        }

        const registros = await api.data.getContenido(rawName);
        let total = 0;
        let incorrectos = 0;

        registros.forEach((r) => {
          const val = r[campoCuit.Field || campoCuit.nombre];
          if (val) {
            total++;
            if (!validarCUIT(val)) incorrectos++;
          }
        });

        if (incorrectos > 0) {
          api.env.showNotification(`Auditoría finalizada: Se detectaron ${incorrectos} CUIT/CUIL inválidos de ${total} registros analizados.`, 'error');
        } else {
          api.env.showNotification(`Auditoría finalizada: Todos los CUIT/CUIL (${total}) son correctos y válidos.`, 'success');
        }
      } catch (err) {
        api.env.showNotification('Ocurrió un error al intentar auditar la tabla.', 'error');
      }
    }
  });

  console.log('[Validador CUIT] Plugin inicializado correctamente ✅');

})();
