import { Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormBuilder, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { ConfigData, UserConfig } from '../../interfaces/configData.interfaces';
import { StoreActions } from '../../store/store.actions';
import { selectConfigData } from '../../store/store.selectors';
import { MaterialModule } from '../../shared/material.module';
import { ThemeService } from '../../services/theme';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { AppInfoService } from '../../services/app-info.service';
import { ApiConfigComponent } from '../api-config/api-config.component';
import { SeraPluginService } from '../../services/sera-plugin.service';
import { PluginInfo } from '../../interfaces/plugin.interfaces';

@Component({
  selector: 'app-config-data-dialog',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule, 
    MaterialModule,
    ApiConfigComponent
  ],
  templateUrl: './config-data-dialog.component.html',
  styleUrl: './config-data-dialog.component.scss'
})
export class ConfigDataDialogComponent {
  formConfigurations!: FormGroup;
  configData: Observable<ConfigData>;

  nombreApp!: string;
  user!: UserConfig;

  /** Ruta relativa guardada en el campo membrete de la DB */
  membretePath = signal<string>('');
  /** Data URL base64 para preview del logo */
  logoPreview = signal<string>('');
  /** Indica si se está copiando el logo al directorio de SERA */
  cargandoLogo = signal<boolean>(false);

  // PESTAÑAS Y ESTADOS
  activeTab: string = 'general';
  animationsEnabled: boolean = true;
  
  loadingDb = signal<boolean>(false);
  loadingCache = signal<boolean>(false);
  auditLogs: any[] = [];

  // ESTADO DE PLUGINS
  /** Lista de plugins instalados localmente en SQLite */
  pluginsInstalados = signal<PluginInfo[]>([]);
  /** Estado de carga de la sección de plugins */
  cargandoPlugins = signal<boolean>(false);
  /** Busqueda filtro en plugins instalados */
  busquedaInstalados = signal<string>('');
  /** Sub-pestaña activa: instalados | marketplace */
  pluginSubTab = signal<'instalados' | 'marketplace'>('instalados');

  // ESTADO DEL MARKETPLACE
  /** Plugins del catálogo de GitHub/jsDelivr */
  marketplacePlugins = signal<any[]>([]);
  /** Indica si se está cargando el catálogo del marketplace */
  cargandoMarketplace = signal<boolean>(false);
  /** Búsqueda en el marketplace */
  busquedaMarketplace = signal<string>('');
  /** Plugin que se está instalando actualmente (por ID) */
  instalandoPluginId = signal<string | null>(null);
  /** URL del catálogo central de plugins en GitHub */
  private readonly MARKETPLACE_URL = 'https://raw.githubusercontent.com/carlosprost/sera-plugins-marketplace/main/plugins.json';

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    public themeService: ThemeService,
    public appInfo: AppInfoService,
    public pluginService: SeraPluginService,
    public dialogRef: MatDialogRef<ConfigDataDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.configData = this.store.select(selectConfigData);

    this.configData.subscribe((data) => {
      if (data) {
        this.nombreApp = data.nombreApp || '';
        this.user = data.user || { nombre: '', grado: '', institucion: '', dependencia: '', oficina: '', membrete: '' };
      } else {
        this.nombreApp = '';
        this.user = { nombre: '', grado: '', institucion: '', dependencia: '', oficina: '', membrete: '' };
      }
      this.createForm();
      // Cargar preview del logo si ya hay uno registrado en BD
      if (this.user.membrete) {
        this.membretePath.set(this.user.membrete);
        this.cargarLogoPreview(this.user.membrete);
      } else {
        // Si la BD no tiene el path (ej.: por el bug anterior), intentar
        // detectar automáticamente si existe un logo en la carpeta de SERA
        this.detectarLogoExistente();
      }
    });
  }

  createForm() {
    this.formConfigurations = this.fb.group({
      nombre: [this.user?.nombre || ''],
      // Los campos heredados se mantienen en el FormGroup para preservar datos existentes,
      // pero no se muestran en la UI simplificada
      grado: [this.user?.grado || ''],
      institucion: [this.user?.institucion || ''],
      dependencia: [this.user?.dependencia || ''],
      oficina: [this.user?.oficina || ''],
    });
  }

  /** Carga el preview del logo actual desde el backend en base64. */
  async cargarLogoPreview(ruta: string) {
    try {
      const base64 = await invoke<string>('get_logo_membrete_base64', { rutaRelativa: ruta });
      this.logoPreview.set(base64);
    } catch {
      this.logoPreview.set('');
    }
  }

  /**
   * Auto-detecta si existe un logo guardado en la carpeta de membrete de SERA,
   * aunque el campo en la BD esté vacío (migración desde bug anterior).
   */
  async detectarLogoExistente() {
    try {
      const ruta = await invoke<string>('detectar_logo_membrete');
      this.membretePath.set(ruta);
      await this.cargarLogoPreview(ruta);
    } catch {
      // No hay logo guardado, el estado vacío es el correcto
    }
  }

  /** Abre el diálogo nativo del sistema para seleccionar una imagen y la guarda en SERA. */
  async seleccionarLogo() {
    try {
      const rutaSeleccionada = await open({
        multiple: false,
        filters: [{ name: 'Imagen', extensions: ['png', 'jpg', 'jpeg'] }],
        title: 'Seleccioná el logotipo para los reportes'
      });

      if (!rutaSeleccionada || typeof rutaSeleccionada !== 'string') return;

      this.cargandoLogo.set(true);

      const rutaRelativa = await invoke<string>('guardar_logo_membrete', { rutaOrigen: rutaSeleccionada });
      this.membretePath.set(rutaRelativa);
      await this.cargarLogoPreview(rutaRelativa);

      this.snackBar.open('Logotipo guardado correctamente en SERA', 'OK', { duration: 2500 });
    } catch (err) {
      console.error('[SERA] Error al guardar el logotipo:', err);
      this.snackBar.open('No se pudo guardar el logotipo', 'Cerrar', { duration: 3000 });
    } finally {
      this.cargandoLogo.set(false);
    }
  }

  /** Elimina el logotipo actual del perfil (no borra el archivo físico). */
  quitarLogo() {
    this.membretePath.set('');
    this.logoPreview.set('');
    this.snackBar.open('Logotipo removido del perfil', 'OK', { duration: 2000 });
  }

  async cargarLogs() {
    try {
      this.auditLogs = await invoke<any[]>('get_audit_logs');
    } catch (err) {
      console.error('Error al cargar logs de auditoría:', err);
    }
  }

  setTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'security') {
      this.cargarLogs();
    }
    if (tab === 'plugins') {
      this.cargarPluginsInstalados();
    }
  }

  selectTheme(themeId: string) {
    this.themeService.setTheme(themeId);
    this.snackBar.open(`Tema visual cambiado a ${themeId.toUpperCase()}`, 'OK', { duration: 2500 });
  }

  updateCustomColor(key: 'primary' | 'bg' | 'card' | 'text', event: any) {
    const color = event.target.value;
    const current = { ...this.themeService.customColors() };
    current[key] = color;
    this.themeService.setCustomColors(current);
  }

  toggleAnimations() {
    this.animationsEnabled = !this.animationsEnabled;
    this.snackBar.open(
      this.animationsEnabled ? 'Animaciones de interfaz activadas' : 'Modo compacto de bajo rendimiento activado',
      'OK',
      { duration: 2500 }
    );
  }

  async optimizarDB() {
    this.loadingDb.set(true);
    try {
      await invoke('optimizar_db');
      this.snackBar.open('Mantenimiento SQLite completo: Índices y grillas compactadas (VACUUM)', 'ÉXITO', {
        duration: 3500,
        panelClass: ['snackbar-exito']
      });
      await this.cargarLogs();
    } catch (err) {
      console.error('Error al optimizar base de datos:', err);
      this.snackBar.open('Error al realizar el mantenimiento SQLite', 'ERROR', { duration: 3000 });
    } finally {
      this.loadingDb.set(false);
    }
  }

  async limpiarCache() {
    this.loadingCache.set(true);
    try {
      await invoke('limpiar_cache');
      this.snackBar.open('Archivos temporales purgados y caché del visor liberado.', 'ÉXITO', {
        duration: 3000
      });
      await this.cargarLogs();
    } catch (err) {
      console.error('Error al limpiar caché:', err);
      this.snackBar.open('Error al limpiar archivos temporales', 'ERROR', { duration: 3000 });
    } finally {
      this.loadingCache.set(false);
    }
  }

  dialogClose() {
    this.dialogRef.close();
  }

  onSubmit() {
    const obj: ConfigData = {
      nombreApp: this.nombreApp,
      user: {
        nombre: this.formConfigurations.value.nombre,
        // Campos heredados preservados para compatibilidad con la BD existente
        grado: this.formConfigurations.value.grado,
        institucion: this.formConfigurations.value.institucion,
        dependencia: this.formConfigurations.value.dependencia,
        oficina: this.formConfigurations.value.oficina,
        // El membrete ahora se gestiona fuera del form (file picker)
        membrete: this.membretePath(),
      },
    };

    // Despachar la acción correctamente con el objeto de configuración
    this.store.dispatch(StoreActions.loadUpdateConfig({ data: obj }));
    
    this.snackBar.open('Perfil guardado correctamente', 'ÉXITO', { duration: 3000 });
    this.dialogRef.close({ reload: true });
  }

  // ============================================================
  // MÉTODOS DE GESTIÓN DE PLUGINS
  // ============================================================

  /**
   * Carga el listado de plugins instalados desde SQLite mediante el comando Tauri.
   */
  async cargarPluginsInstalados() {
    this.cargandoPlugins.set(true);
    try {
      const plugins = await invoke<PluginInfo[]>('get_plugins');
      this.pluginsInstalados.set(plugins);
    } catch (err) {
      console.error('[SERA Plugins] Error al cargar plugins instalados:', err);
      this.snackBar.open('No se pudo cargar la lista de plugins', 'Cerrar', { duration: 3000 });
    } finally {
      this.cargandoPlugins.set(false);
    }
  }

  /** Filtra la lista de plugins instalados según la búsqueda */
  get pluginsInstaladosFiltrados() {
    const q = this.busquedaInstalados().toLowerCase();
    if (!q) return this.pluginsInstalados();
    return this.pluginsInstalados().filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      (p.descripcion || '').toLowerCase().includes(q) ||
      (p.autor || '').toLowerCase().includes(q)
    );
  }

  /**
   * Activa o desactiva un plugin en SQLite y recarga los plugins en caliente.
   */
  async togglePlugin(plugin: PluginInfo) {
    try {
      // Enviamos el NUEVO estado deseado (inverso del actual) para que Rust lo persista directamente.
      await invoke('toggle_plugin', { id: plugin.id, activo: !plugin.activo });
      if (plugin.activo) {
        // Descargar del DOM si se desactiva
        this.pluginService.descargarPlugin(plugin.id);
      } else {
        // Recargar en caliente si se activa
        await this.pluginService.cargarPluginsActivos();
      }
      await this.cargarPluginsInstalados();
      this.snackBar.open(
        plugin.activo ? `Plugin "${plugin.nombre}" desactivado` : `Plugin "${plugin.nombre}" activado`,
        'OK',
        { duration: 2500 }
      );
    } catch (err) {
      console.error('[SERA Plugins] Error al cambiar estado:', err);
      this.snackBar.open('Error al cambiar el estado del plugin', 'Cerrar', { duration: 3000 });
    }
  }

  /**
   * Elimina un plugin: borra los archivos físicos del disco y lo quita de SQLite.
   */
  async eliminarPlugin(plugin: PluginInfo) {
    if (!confirm(`¿Eliminás el plugin "${plugin.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await invoke('eliminar_plugin', { id: plugin.id });
      this.pluginService.descargarPlugin(plugin.id);
      await this.cargarPluginsInstalados();
      this.snackBar.open(`Plugin "${plugin.nombre}" eliminado correctamente`, 'OK', { duration: 2500 });
    } catch (err) {
      console.error('[SERA Plugins] Error al eliminar plugin:', err);
      this.snackBar.open('Error al eliminar el plugin', 'Cerrar', { duration: 3000 });
    }
  }

  // ============================================================
  // MÉTODOS DEL MARKETPLACE
  // ============================================================

  /**
   * Carga el catálogo central de plugins desde el repositorio GitHub de SERA.
   * Usa el CDN de raw.githubusercontent.com para obtener el JSON en caliente.
   */
  async cargarMarketplace() {
    this.cargandoMarketplace.set(true);
    try {
      const response = await fetch(this.MARKETPLACE_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      this.marketplacePlugins.set(Array.isArray(data) ? data : data.plugins || []);
    } catch (err) {
      console.error('[SERA Marketplace] Error al cargar catálogo:', err);
      this.snackBar.open('No se pudo conectar al Marketplace. Verificá tu conexión a internet.', 'Cerrar', { duration: 4000 });
      this.marketplacePlugins.set([]);
    } finally {
      this.cargandoMarketplace.set(false);
    }
  }

  /** Verifica si un plugin del marketplace ya está instalado */
  estaInstalado(pluginId: string): boolean {
    return this.pluginsInstalados().some(p => p.id === pluginId);
  }

  /** Filtra el marketplace según el texto de búsqueda */
  get marketplaceFiltrado() {
    const q = this.busquedaMarketplace().toLowerCase();
    if (!q) return this.marketplacePlugins();
    return this.marketplacePlugins().filter((p: any) =>
      (p.name || p.nombre || '').toLowerCase().includes(q) ||
      (p.description || p.descripcion || '').toLowerCase().includes(q) ||
      (p.author || p.autor || '').toLowerCase().includes(q)
    );
  }

  /**
   * Instala un plugin desde el marketplace:
   * 1. Descarga el JS y CSS desde la URL del CDN del plugin.
   * 2. Invoca el comando Rust `instalar_plugin_local` para escribirlos en disco y registrarlos en SQLite.
   * 3. Recarga los plugins activos en caliente.
   */
  async instalarDesdeMarketplace(mp: any) {
    const id = mp.id;
    if (this.estaInstalado(id)) return;
    this.instalandoPluginId.set(id);

    try {
      // Determinar las URLs del bundle (jsDelivr o URL directa del repo)
      const entryUrl: string = mp.entry_url || mp.entryUrl || '';
      const styleUrl: string = mp.style_url || mp.styleUrl || '';

      if (!entryUrl) throw new Error('El plugin no tiene URL de bundle JavaScript definida.');

      // Descargar el JS en forma de texto
      const jsRes = await fetch(entryUrl);
      if (!jsRes.ok) throw new Error(`Error al descargar JS: HTTP ${jsRes.status}`);
      const jsContent = await jsRes.text();

      // Descargar el CSS si existe
      let cssContent: string | null = null;
      if (styleUrl) {
        const cssRes = await fetch(styleUrl);
        if (cssRes.ok) cssContent = await cssRes.text();
      }

      // Invocar Rust para escribir los archivos en disco y registrar en SQLite.
      // Los parámetros usan snake_case para coincidir con la firma del comando Rust.
      await invoke('instalar_plugin_local', {
        id,
        nombre: mp.name || mp.nombre || id,
        version: mp.version || '1.0.0',
        descripcion: mp.description || mp.descripcion || '',
        autor: mp.author || mp.autor || 'Desconocido',
        jsContent: jsContent,
        cssContent: cssContent ?? '',
      });

      // Recargar plugins en caliente
      await this.pluginService.cargarPluginsActivos();
      await this.cargarPluginsInstalados();

      this.snackBar.open(`¡Plugin "${mp.name || id}" instalado correctamente!`, 'ÉXITO', {
        duration: 3500,
        panelClass: ['snackbar-exito']
      });
    } catch (err: any) {
      console.error('[SERA Marketplace] Error al instalar plugin:', err);
      this.snackBar.open(`Error al instalar el plugin: ${err.message || err}`, 'Cerrar', { duration: 4000 });
    } finally {
      this.instalandoPluginId.set(null);
    }
  }

  /** Cambia la sub-pestaña y carga los datos necesarios */
  setPluginSubTab(tab: 'instalados' | 'marketplace') {
    this.pluginSubTab.set(tab);
    if (tab === 'marketplace' && this.marketplacePlugins().length === 0) {
      this.cargarMarketplace();
    }
  }
}
