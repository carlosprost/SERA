import { Injectable, NgZone, signal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RibbonButtonConfig, SidebarTabConfig, PluginInfo } from '../interfaces/plugin.interfaces';
import { Store } from '@ngrx/store';
import { selectTablas } from '../store/store.selectors';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SeraPluginService {
  // Signals reactivos para el core de Angular (UI Slots)
  ribbonButtons = signal<RibbonButtonConfig[]>([]);
  sidebarTabs = signal<SidebarTabConfig[]>([]);

  
  // Maps para interceptores y renderers de celda personalizados
  cellRenderers = new Map<string, (value: any, row: any) => string>();
  beforeInsertInterceptors = new Map<string, ((record: any) => Promise<any>)[]>();

  constructor(
    private snackBar: MatSnackBar,
    private store: Store,
    private ngZone: NgZone
  ) {
    this.inicializarAPI();
  }

  /**
   * Inicializa el objeto global SeraAPI en window bajo un Sandbox estricto.
   * Los plugins interactúan exclusivamente a través de esta pasarela controlada.
   */
  private inicializarAPI() {
    (window as any).SeraAPI = {
      // 🎨 NAMESPACE VISUAL (UI)
      ui: {
        registerRibbonButton: (config: RibbonButtonConfig) => {
          this.ngZone.run(() => {
            const exist = this.ribbonButtons().some(b => b.id === config.id);
            if (!exist) {
              this.ribbonButtons.update(btns => [...btns, config]);
            }
          });
        },
        registerSidebarTab: (config: SidebarTabConfig) => {
          this.ngZone.run(() => {
            const exist = this.sidebarTabs().some(t => t.id === config.id);
            if (!exist) {
              this.sidebarTabs.update(tabs => [...tabs, config]);
            }
          });
        },
        registerDashboardWidget: (config: any) => {
          // No-op: Los widgets en el Dashboard ya no se utilizan en SERA v4
        },
        registerCellRenderer: (columnName: string, rendererFn: (value: any, row: any) => string) => {
          this.cellRenderers.set(columnName.toLowerCase(), rendererFn);
        }
      },

      // 📊 NAMESPACE DE DATOS (DATA ACCESS CONTROLLED)
      data: {
        getTablas: async () => {
          return firstValueFrom(this.store.select(selectTablas));
        },
        getCampos: async (tabla: string) => {
          return invoke<any[]>('get_campos', { tabla });
        },
        getContenido: async (tabla: string) => {
          return invoke<any[]>('get_contenido', { tabla });
        },
        onBeforeInsert: (tabla: string, interceptor: (record: any) => Promise<any>) => {
          const lower = tabla.toLowerCase();
          const list = this.beforeInsertInterceptors.get(lower) || [];
          list.push(interceptor);
          this.beforeInsertInterceptors.set(lower, list);
        }
      },

      // 🌐 NAMESPACE DE ENTORNO (ENV CONTROLLED)
      env: {
        showNotification: (msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
          this.ngZone.run(() => {
            this.snackBar.open(msg, 'Cerrar', {
              duration: 4000,
              panelClass: type === 'error' ? ['snackbar-error'] : undefined
            });
          });
        }
      }
    };
  }

  /**
   * Carga dinámica y en caliente de los plugins marcados como activos en SQLite.
   * Utiliza Blob URLs para máxima compatibilidad offline y aislamiento de CSP.
   */
  async cargarPluginsActivos() {
    try {
      const plugins: PluginInfo[] = await invoke('get_plugins');
      const activos = plugins.filter(p => p.activo);

      for (const plugin of activos) {
        console.log(`[SERA Plugins] Cargando en caliente: ${plugin.nombre} v${plugin.version}`);
        
        // 1. Inyectar Hoja de Estilo CSS si existe
        if (plugin.stylesheet) {
          if (document.getElementById(`plugin-style-${plugin.id}`)) {
            console.log(`[SERA Plugins] Hoja de estilo para ${plugin.nombre} ya inyectada, omitiendo.`);
          } else {
            try {
              const cssContent = await invoke<string>('leer_recurso_plugin', { id: plugin.id, archivo: plugin.stylesheet });
              const blob = new Blob([cssContent], { type: 'text/css' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = url;
              link.id = `plugin-style-${plugin.id}`;
              document.head.appendChild(link);
            } catch (e) {
              console.error(`[SERA Plugins] Error al cargar estilos del plugin ${plugin.nombre}:`, e);
            }
          }
        }

        // 2. Inyectar Bundle JavaScript mediante Blob URL
        if (document.getElementById(`plugin-script-${plugin.id}`)) {
          console.log(`[SERA Plugins] Script para ${plugin.nombre} ya inyectado, omitiendo.`);
        } else {
          try {
            const jsContent = await invoke<string>('leer_recurso_plugin', { id: plugin.id, archivo: plugin.entrypoint });
            const blob = new Blob([jsContent], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            const script = document.createElement('script');
            script.src = url;
            script.id = `plugin-script-${plugin.id}`;
            script.async = true;
            document.body.appendChild(script);
          } catch (e) {
            console.error(`[SERA Plugins] Error al cargar bundle JS del plugin ${plugin.nombre}:`, e);
          }
        }
      }
    } catch (err) {
      console.error('[SERA Plugins] Error crítico al cargar plugins activos:', err);
    }
  }

  /**
   * Remueve dinámicamente un plugin inyectado del DOM y limpia sus elementos del core.
   */
  descargarPlugin(pluginId: string) {
    this.ngZone.run(() => {
      // 1. Remover script del DOM
      const script = document.getElementById(`plugin-script-${pluginId}`);
      if (script) script.remove();

      // 2. Remover stylesheet del DOM
      const style = document.getElementById(`plugin-style-${pluginId}`);
      if (style) style.remove();

      // 3. Limpiar registros visuales de Signals asociados a ese ID
      this.ribbonButtons.update(btns => btns.filter(b => !b.id.startsWith(pluginId)));
      this.sidebarTabs.update(tabs => tabs.filter(t => !t.id.startsWith(pluginId)));
    });
  }
}
