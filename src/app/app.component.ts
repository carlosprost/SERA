import { Component, ElementRef, ViewChild, ViewChildren, QueryList, ChangeDetectorRef, NgZone, AfterViewInit, OnInit, signal, HostListener } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SelectionModel } from "@angular/cdk/collections";
import { FormControl } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTabChangeEvent, MatTabsModule } from "@angular/material/tabs";
import { invoke } from "@tauri-apps/api/core";
import { Store } from "@ngrx/store";
import { Observable } from "rxjs";
import { ConfigData } from "./interfaces/configData.interfaces";
import { Tablas } from "./interfaces/tablas.interfaces";
import { StoreActions } from "./store/store.actions";
import { selectCampos, selectConfigData, selectTablas } from "./store/store.selectors";
import { DialogDeleteComponent } from "./components/dialog-delete/dialog-delete.component";
import { FormNewTableComponent } from "./components/form-new-table/form-new-table.component";
import { ConfigDataDialogComponent } from "./components/config-data-dialog/config-data-dialog.component";
import { FormularioRegistroComponent } from "./components/formulario-registro/formulario-registro.component";
import { TableComponent } from "./components/table/table.component";
import { MatDrawer, MatSidenavModule } from "@angular/material/sidenav";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatMenuModule } from "@angular/material/menu";
import { MatDividerModule } from "@angular/material/divider";
import { ReciboComponent } from "./components/recibo/recibo.component";
import { MatFormFieldModule } from "@angular/material/form-field";
import { PdfService } from "./services/pdf.service";
import { open, save } from "@tauri-apps/plugin-dialog";
import { DialogRenameComponent } from "./components/dialog-rename/dialog-rename.component";
import { AboutDialogComponent } from "./components/about-dialog/about-dialog";
import { DialogPassword } from "./components/dialog-password/dialog-password";
import * as XLSX from 'xlsx';
import { readFile } from '@tauri-apps/plugin-fs';
import { DialogImportExcel } from "./components/dialog-import-excel/dialog-import-excel";
import { DialogExportComponent } from "./components/dialog-export/dialog-export";
import { ThemeService } from "./services/theme";
import { HomeDashboardComponent } from "./components/home-dashboard/home-dashboard";
import { UiService } from "./services/ui.service";
import { TableDashboardComponent } from "./components/table-dashboard/table-dashboard";
import { GlobalSearchComponent } from "./components/global-search/global-search";
import { SearchResultsComponent } from "./components/search-results/search-results";
import { DialogSecurityAlertComponent } from "./components/dialog-security-alert/dialog-security-alert.component";
import { ConnectRemoteDialogComponent } from "./components/connect-remote-dialog/connect-remote-dialog.component";
import { listen } from '@tauri-apps/api/event';
import { SeraPluginService } from './services/sera-plugin.service';
import { RibbonButtonConfig } from './interfaces/plugin.interfaces';


/**
 * Componente raíz de SERA.
 * Orquesta la navegación por tabs, la gestión de tablas del sidebar
 * y la apertura de diálogos para crear/eliminar tablas y registros.
 */
@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    MatSidenavModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule,
    MatTabsModule,
    MatFormFieldModule,
    TableComponent,
    HomeDashboardComponent,
    TableDashboardComponent,
    SearchResultsComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
})
export class AppComponent implements AfterViewInit, OnInit {
  /** Señal para mostrar/ocultar el dashboard de la tabla activa */
  showTableDashboard = signal(false);
  /** Señal para controlar si el Ribbon global está en modo compacto/colapsado */
  ribbonCompacto = signal<boolean>(localStorage.getItem('sera_ribbon_compacto') === 'true');
  /** Señal para controlar la pestaña activa del Ribbon global */
  activeRibbonTab = signal<'inicio' | 'busqueda' | 'extensiones'>('inicio');

  toggleRibbonCompacto() {
    this.ribbonCompacto.update(c => {
      const newVal = !c;
      localStorage.setItem('sera_ribbon_compacto', String(newVal));
      return newVal;
    });
  }
  /** Observable con los datos de configuración del usuario. */
  configData: Observable<ConfigData>;
  /** Observable con el listado de tablas disponibles. */
  tablas: Observable<Tablas[]>;

  /** Tabs de tablas actualmente abiertas. */
  tabs: string[] = [];
  /** Índice del tab seleccionado. */
  selected = new FormControl(0);
  /** Elementos seleccionados en la tabla activa. */
  elementos: SelectionModel<any> = new SelectionModel<any>(true, []);


  /** Referencia dinámica a todas las tablas abiertas en los tabs. */
  @ViewChildren(TableComponent) tablasCargadas!: QueryList<TableComponent>;

  /** Devuelve la instancia de la tabla que está actualmente en foco. */
  get activeTable(): TableComponent | undefined {
    return this.tablasCargadas ? this.tablasCargadas.toArray()[this.selected.value ?? 0] : undefined;
  }

  /** Contenedor invisible para renderizado del PDF. */
  @ViewChild("pdf") elementPDF!: ElementRef<HTMLDivElement>;

  constructor(
    private store: Store,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private pdfService: PdfService,
    public themeService: ThemeService, // Inyectamos para activar el effect
    private uiService: UiService,
    public cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    public pluginService: SeraPluginService // Activa el sandbox window.SeraAPI al instanciarse
  ) {
    this.store.dispatch(StoreActions.loadStores());
    this.store.dispatch(StoreActions.loadListadoTablas());
    this.configData = this.store.select(selectConfigData);
    this.tablas = this.store.select(selectTablas);

    // Suscripciones a eventos de UI globales
    this.uiService.openNewTable$.subscribe(() => this.openFormNewTable());
    this.uiService.openImportExcel$.subscribe(() => this.importarExcel());
    this.uiService.openAttachments$.subscribe(() => this.openAttachmentsFolder());
  }

  async ngOnInit() {
    // Disparar migración asíncrona de fechas heredadas
    this.migrarFechasDb();

    // Cargar plugins activos desde la DB SQLite en caliente (Blob URL sandbox)
    this.pluginService.cargarPluginsActivos();

    // Escuchar alertas de intrusión en caliente (Tauri WAF)
    listen('security-alert', (event: any) => {
      this.ngZone.run(() => {
        this.dialog.open(DialogSecurityAlertComponent, {
          width: '600px',
          disableClose: true,
          panelClass: 'security-panic-panel',
          data: event.payload
        });
      });
    });
  }

  /**
   * Rutina de migración silenciosa para normalizar fechas en formato DD/MM/YYYY
   * almacenadas físicamente en la base de datos SQLite hacia el estándar ISO YYYY-MM-DD.
   * Se ejecuta asíncronamente en segundo plano una sola vez.
   */
  async migrarFechasDb() {
    const KEY_MIGRACION = 'sera_migration_dates_normalized_v4';
    if (localStorage.getItem(KEY_MIGRACION) === 'true') {
      return;
    }

    console.log('[SERA Migración] Iniciando normalización de fechas históricas...');
    let totalNormalizados = 0;

    try {
      // 1. Obtener todas las tablas registradas en el catálogo
      const tablasList: any[] = await invoke('get_tablas');
      
      for (const t of tablasList) {
        const nombreTabla = t.nombre_tabla;
        
        // 2. Obtener estructura de campos
        const campos: any[] = await invoke('get_campos', { tabla: nombreTabla });
        
        // Filtrar y detectar las columnas de fecha
        const camposFecha = campos.filter(c => {
          const fieldLower = (c.Field || '').toLowerCase();
          const tipoLower = (c.Type || c.tipo || '').toLowerCase();
          const isId = fieldLower === 'id' || fieldLower.startsWith('id_');
          const isSystem = fieldLower.startsWith('sera_');
          
          if (isId || isSystem) return false;
          
          return fieldLower.includes('fecha') || 
                 fieldLower.includes('date') || 
                 tipoLower.includes('date') || 
                 tipoLower.includes('timestamp');
        });

        if (camposFecha.length === 0) continue;

        // 3. Obtener el contenido de la tabla
        const contenido: any[] = await invoke('get_contenido', { tabla: nombreTabla });
        if (!contenido || contenido.length === 0) continue;

        // La clave primaria física de la tabla siempre tiene el formato id_{nombre_tabla}
        const idKey = `id_${nombreTabla.toLowerCase()}`;
        
        for (const row of contenido) {
          let requiereActualizacion = false;
          const camposUpdate: string[] = [];
          const contenidoUpdate: string[] = [];
          
          for (const c of campos) {
            const fieldLower = (c.Field || '').toLowerCase();
            const isId = fieldLower === 'id' || fieldLower.startsWith('id_');
            const isSystem = fieldLower.startsWith('sera_');
            
            if (isId || isSystem) continue;

            let val = row[c.Field];
            
            // Si es una columna de fecha y contiene una cadena con formato DD/MM/YYYY
            const esFecha = camposFecha.some(cf => cf.Field === c.Field);
            if (esFecha && typeof val === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(val.trim())) {
              const parts = val.trim().split('/');
              // Reordenar a YYYY-MM-DD
              val = `${parts[2]}-${parts[1]}-${parts[0]}`;
              requiereActualizacion = true;
            }

            camposUpdate.push(c.Field);
            // El backend requiere strings no nulos para evitar colisiones
            contenidoUpdate.push(val !== undefined && val !== null ? String(val) : '');
          }

          // Si el registro contenía fechas heredadas DD/MM/YYYY, procedemos a actualizarlo en SQLite
          if (requiereActualizacion) {
            const registroId = row[idKey] || row['id'];
            if (registroId !== undefined && registroId !== null) {
              const registro = {
                id: Number(registroId),
                tabla: nombreTabla,
                campos: camposUpdate,
                contenido: contenidoUpdate
              };
              
              await invoke('actualizar_registro', { registro });
              totalNormalizados++;
            }
          }
        }
      }

      // Marcar migración como completada con éxito en el almacenamiento local
      localStorage.setItem(KEY_MIGRACION, 'true');
      console.log(`[SERA Migración] Normalización finalizada. Registros actualizados: ${totalNormalizados}`);
      
      if (totalNormalizados > 0) {
        this.ngZone.run(() => {
          this.snackBar.open(`¡Base de datos optimizada! Se normalizaron ${totalNormalizados} fechas heredadas a formato ISO.`, 'Listo', { duration: 5000 });
          // Forzar refresco del store y vistas para consistencia en pantalla de inmediato
          this.store.dispatch(StoreActions.loadListadoTablas());
          if (this.tabs.length > 0) {
            const active = this.tabs[this.selected.value ?? 0];
            this.store.dispatch(StoreActions.loadContenido({ tabla: active }));
          }
        });
      }
    } catch (e) {
      console.error('[SERA Migración] Error crítico al normalizar fechas en la base de datos:', e);
    }
  }


  /**
   * Suscripción a cambios en la QueryList de TableComponents.
   * Cuando un tab lazy se renderiza por primera vez, la QueryList cambia
   * y el getter activeTable necesita re-evaluarse para que el ribbon reaccione.
   */
  ngAfterViewInit() {
    this.tablasCargadas.changes.subscribe(() => {
      this.cdr.detectChanges();
    });
  }

  /** Carga los campos y contenido al cambiar de tab. */
  selectTab(event: MatTabChangeEvent) {
    this.store.dispatch(
      StoreActions.loadCampos({ tabla: this.tabs[event.index] })
    );
    this.store.dispatch(
      StoreActions.loadContenido({ tabla: this.tabs[event.index] })
    );
  }

  /** Datos de pestañas de búsqueda: { 'SEARCH:term': { term: string, results: any } } */
  searchTabsData: { [key: string]: { term: string, results: any } } = {};

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Ctrl + Shift + F para búsqueda global
    if (event.ctrlKey && event.shiftKey && (event.key === 'F' || event.key === 'f')) {
      event.preventDefault();
      this.openGlobalSearch();
    }
    // Ctrl + F para búsqueda local en la tabla activa
    else if (event.ctrlKey && !event.shiftKey && (event.key === 'F' || event.key === 'f')) {
      event.preventDefault(); // Evitamos que el WebView intercepte y abra el buscador nativo de Edge
      if (this.activeTable) {
        this.activeTable.openSearchPalette();
      }
    }
    // Ctrl + F1 para colapsar/expandir el Ribbon
    else if (event.ctrlKey && event.key === 'F1') {
      event.preventDefault();
      this.toggleRibbonCompacto();
    }
  }

  openGlobalSearch() {
    const dialogRef = this.dialog.open(GlobalSearchComponent, {
      width: '700px',
      maxWidth: '90vw',
      panelClass: 'spotlight-dialog',
      position: { top: '10%' },
      backdropClass: 'spotlight-backdrop'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (result.action === 'full_search') {
          const tabId = `SEARCH:${result.term}`;
          this.searchTabsData[tabId] = { term: result.term, results: result.results };
          
          if (!this.tabs.includes(tabId)) {
            this.tabs = [...this.tabs, tabId];
          }
          // Seleccionar el tab (el índice es tabs.length - 1)
          this.selected.setValue(this.tabs.length - 1);
        } else if (result.action === 'go_to') {
          this.addTab(result.tabla);
          // Opcional: implementar scroll o highlight del registro en TableComponent
        }
      }
    });
  }

  onSearchNavigate(event: {tabla: string, row: any}) {
    this.addTab(event.tabla);
    // Podríamos disparar un evento para que TableComponent haga scroll al ID
    this.snackBar.open(`Navegando a ${event.tabla}`, "Cerrar", { duration: 2000 });
  }

  /**
   * Añade una nueva pestaña al visualizador.
   * Si la tabla ya está abierta, simplemente la selecciona.
   */
  addTab(tabName: string) {
    const index = this.tabs.findIndex(t => t.toLowerCase() === tabName.toLowerCase());
    if (index === -1) {
      this.tabs = [...this.tabs, tabName];
      this.selected.setValue(this.tabs.length - 1);
      const tablaActual = this.tabs[this.selected.value ?? 0];
      this.store.dispatch(StoreActions.loadCampos({ tabla: tablaActual }));
      this.store.dispatch(StoreActions.loadContenido({ tabla: tablaActual }));
    } else {
      this.selected.setValue(index);
    }
  }

  /** Cierra un tab y carga el tab adyacente si corresponde. */
  removeTab(index: number) {
    this.tabs = this.tabs.filter((_, i) => i !== index);
    const newIndex = Math.min(index, this.tabs.length - 1);
    this.selected.setValue(newIndex);
    if (this.tabs.length > 0) {
      this.store.dispatch(StoreActions.loadCampos({ tabla: this.tabs[newIndex] }));
      this.store.dispatch(StoreActions.loadContenido({ tabla: this.tabs[newIndex] }));
    }
  }

  /** Recibe los elementos seleccionados emitidos por TableComponent. */
  elementosSeleccionados(elementos: SelectionModel<any>) {
    this.elementos = elementos;
  }

  /** Abre el dialog de creación de recibo PDF recibiendo dinámicamente el dataset filtrado. */
  openDialogRecibo(datos: any[] = []) {
    // dataSource viene directamente de la tabla activa (selección o filtro)
    const dataSource = datos;
    
    // Extraer campos disponibles (excluyendo IDs) para el selector
    const camposDisponibles = dataSource.length > 0 
      ? Object.keys(dataSource[0]).filter(key => !key.toLowerCase().includes('id'))
      : [];

    const dialogRef = this.dialog.open(ReciboComponent, {
      width: "650px",
      data: { 
        message: "Configurar Reporte",
        campos: camposDisponibles,
        datos: dataSource.length > 0 ? dataSource : this.elementos.selected.map(item => ({ ...item }))
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      // El PDF ahora se genera directamente en el diálogo mostrando un spinner interactivo.
    });
  }

  /** Abre el dialog de configuración global del sistema (datos del usuario, institución, membrete). */
  openDialogAjustes() {
    this.dialog.open(ConfigDataDialogComponent, {
      width: '980px',
      height: '650px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'settings-dialog-panel',
      data: {},
    });
  }


  /** Abre el dialog para crear una nueva tabla. */
  openDialogNuevaTabla() {
    const dialogRef = this.dialog.open(FormNewTableComponent, {
      width: "800px",
      maxWidth: "90vw",
      maxHeight: "90vh",
      data: { message: "Crear nueva Tabla" },
    });

    dialogRef.afterClosed().subscribe((result) => {
      // El resultado ahora lo informan los Effects para mayor precisión
    });
  }

  /** Abre el dialog para crear un nuevo registro en la tabla activa. */
  openDialogNuevoRegistro() {
    const tablaActual = this.tabs[this.selected.value ?? 0];
    const dialogRef = this.dialog.open(FormularioRegistroComponent, {
      width: "500px",
      data: {
        message: "Crear nuevo Registro",
        tabla: tablaActual,
        upload: false,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.snackBar.open("Nuevo Registro Creado", "", { duration: 3000 });
      }
    });
  }

  eliminarTabla(nombre_tabla: string) {
    const isRemote = nombre_tabla.toLowerCase().startsWith('remoto_');
    
    // 1. Consultar la configuración de la tabla para buscar vínculos activos
    invoke<string>('get_tabla_config', { nombreTabla: nombre_tabla }).then(configStr => {
      this.ngZone.run(() => {
        let linkedTables: string[] = [];
        try {
          const config = JSON.parse(configStr);
          if (config && config.linkedFields && Array.isArray(config.linkedFields)) {
            linkedTables = config.linkedFields
              .map((lf: any) => lf.remoteTable)
              .filter((val: string, index: number, self: string[]) => val && self.indexOf(val) === index);
          }
        } catch (e) {
          console.error("Error al parsear config de tabla:", e);
        }

        // Configuración dinámica del diálogo según sea local o remota
        const dialogTitle = isRemote ? "¿Desenlazar tabla remota?" : "¿Eliminar tabla?";
        const dialogMessage = isRemote 
          ? `¿Seguro que deseas desenlazar la tabla remota "${nombre_tabla.split('_').join(' ').toUpperCase()}"? No se perderán los registros en el Host original, solo se quitará el enlace virtual de tu espacio de trabajo local.`
          : `¿Seguro que deseas eliminar la tabla "${nombre_tabla}"? Perderás todos sus registros y adjuntos físicos asociados permanentemente.`;

        // 2. Abre el diálogo pasando la lista de tablas vinculadas
        const dialogRef = this.dialog.open(DialogDeleteComponent, {
          width: "400px",
          data: {
            title: dialogTitle,
            message: dialogMessage,
            tabla: nombre_tabla,
            linkedTables: isRemote ? [] : linkedTables // Vínculos locales vacíos para remotas
          },
        });

        dialogRef.afterClosed().subscribe((result) => {
          if (result && result.reload) {
            this.ngZone.run(() => {
              const eliminadas: string[] = result.eliminadas || [nombre_tabla];
              
              // Si las tablas eliminadas estaban abiertas en los tabs, las removemos de forma limpia
              eliminadas.forEach(t => {
                const index = this.tabs.findIndex(tab => tab.toLowerCase() === t.toLowerCase());
                if (index !== -1) {
                  this.removeTab(index);
                }
                // Si es una tabla remota, limpiamos también la clave de localStorage de inmediato
                if (t.toLowerCase().startsWith('remoto_')) {
                  localStorage.removeItem('remote_conn_' + t.toLowerCase());
                }
              });

              // Forzar la recarga del catálogo en el Store
              this.store.dispatch(StoreActions.loadListadoTablas());

              let msg = '';
              if (isRemote) {
                msg = `Tabla remota "${nombre_tabla.split('_').join(' ').toUpperCase()}" desenlazada correctamente`;
              } else {
                if (eliminadas.length === 1) {
                  msg = `Tabla "${nombre_tabla}" eliminada correctamente`;
                } else {
                  msg = `Se eliminaron la tabla "${nombre_tabla}" y ${eliminadas.length - 1} tablas vinculadas`;
                }
              }
              this.snackBar.open(msg, "Cerrar", { duration: 4000 });
            });
          }
        });
      });
    }).catch(err => {
      console.error("Error al obtener config para eliminar tabla:", err);
      // Fallback a diálogo simple si hay error de Rust
      this.ngZone.run(() => {
        const dialogTitle = isRemote ? "¿Desenlazar tabla remota?" : "¿Eliminar tabla?";
        const dialogMessage = isRemote 
          ? `¿Seguro que deseas desenlazar la tabla remota "${nombre_tabla.split('_').join(' ').toUpperCase()}"?`
          : `¿Seguro que deseas eliminar la tabla "${nombre_tabla}"? Perderás todos los registros.`;

        const dialogRef = this.dialog.open(DialogDeleteComponent, {
          width: "350px",
          data: {
            title: dialogTitle,
            message: dialogMessage,
            tabla: nombre_tabla,
            linkedTables: []
          },
        });

        dialogRef.afterClosed().subscribe((result) => {
          if (result && result.reload) {
            this.ngZone.run(() => {
              const index = this.tabs.findIndex(tab => tab.toLowerCase() === nombre_tabla.toLowerCase());
              if (index !== -1) {
                this.removeTab(index);
              }
              if (nombre_tabla.toLowerCase().startsWith('remoto_')) {
                localStorage.removeItem('remote_conn_' + nombre_tabla.toLowerCase());
              }
              this.store.dispatch(StoreActions.loadListadoTablas());
              const msg = isRemote 
                ? `Tabla remota "${nombre_tabla.split('_').join(' ').toUpperCase()}" desenlazada` 
                : `Tabla "${nombre_tabla}" eliminada`;
              this.snackBar.open(msg, "Cerrar", { duration: 4000 });
            });
          }
        });
      });
    });
  }

  /** Abre el dialog para editar la estructura de una tabla específica. */
  abrirDialogoEdicionTabla(tableName?: string) {
    const tablaActual = tableName || this.tabs[this.selected.value ?? 0];
    if (!tablaActual) return;

    // Si la tabla es la activa, usamos los campos del Store
    if (tablaActual === this.tabs[this.selected.value ?? 0]) {
      this.store.select(selectCampos).subscribe(fields => {
        this.mostrarDialogEditor(tablaActual, fields[tablaActual.toLowerCase()] || []);
      }).unsubscribe();
    } else {
      // Si es una tabla del menú que no está en el tab activo, pedimos los campos a Rust
      invoke<any[]>('get_campos', { tabla: tablaActual }).then(fields => {
        this.mostrarDialogEditor(tablaActual, fields);
      }).catch(err => {
        this.snackBar.open("Error al cargar campos de la tabla", "Cerrar", { duration: 3000 });
      });
    }
  }

  /** Lógica común para abrir el modal del editor con los campos cargados. */
  private mostrarDialogEditor(nombreTabla: string, fields: any[]) {
    const dialogRef = this.dialog.open(FormNewTableComponent, {
      width: "900px",
      maxWidth: "95vw",
      maxHeight: "95vh",
      data: {
        message: `Editar estructura de: ${nombreTabla}`,
        isEdit: true,
        tableName: nombreTabla,
        fields: fields
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
       // El resultado ahora lo informan los Effects
    });
  }

  // ─── EXPORTACIÓN E IMPORTACIÓN (.srx) ───────────────────────────────────────

  /** Exporta la tabla activa a un archivo .srx encriptado con contraseña opcional. */
  async exportarTabla() {
    if (!this.activeTable) return;
    const nombreTabla = this.activeTable.tabla;

    // 1. Opciones de exportación (Adjuntos)
    const exportDialog = this.dialog.open(DialogExportComponent, {
      width: '450px',
      data: { nombreTabla }
    });

    exportDialog.afterClosed().subscribe(async (config) => {
      if (!config) return;
      const incluirAdjuntos = config.incluirAdjuntos;

      // 2. Pedir contraseña (opcional)
      const passwordDialog = this.dialog.open(DialogPassword, {
        width: '400px',
        data: {
          title: 'Cifrado de Exportación',
          message: 'Podés definir una contraseña para proteger este archivo. Si se deja en blanco, se usará la seguridad interna por defecto.'
        }
      });

      passwordDialog.afterClosed().subscribe(async (password) => {
        if (password === undefined) return;

        // 3. Selector de ruta de guardado
        const path = await save({
          title: 'Exportar Tabla SERA',
          filters: [{ name: 'SERA Data Package', extensions: ['srx'] }],
          defaultPath: `${nombreTabla}.srx`
        });

        if (!path) return;

        try {
          await invoke('exportar_tabla', { 
            nombreTabla, 
            path, 
            password: password || null,
            incluirAdjuntos 
          });
          this.ngZone.run(() => {
            this.snackBar.open(`Tabla "${nombreTabla}" exportada correctamente`, "Cerrar", { duration: 3000 });
          });
        } catch (error) {
          console.error("[SERA] Error al exportar:", error);
          this.ngZone.run(() => {
            this.snackBar.open("Error al exportar tabla: " + error, "Cerrar", { duration: 5000 });
          });
        }
      });
    });
  }

  /** Abre el diálogo para crear una nueva tabla. */
  openFormNewTable() {
    const dialogRef = this.dialog.open(FormNewTableComponent, {
      width: "400px",
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.addTab(result.nombre_tabla);
        this.store.dispatch(StoreActions.loadListadoTablas());
      }
    });
  }

  /** Abre el diálogo para conectar una tabla remota de la red local (LAN) */
  openDialogConectarRemota() {
    const dialogRef = this.dialog.open(ConnectRemoteDialogComponent, {
      width: '450px',
      panelClass: 'remote-conn-dialog-panel'
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && result.success) {
        this.addTab(result.tableName);
        this.store.dispatch(StoreActions.loadListadoTablas());
      }
    });
  }

  /** Importa una tabla desde un archivo .srx, manejando contraseñas y conflictos de nombre. */
  async importarTabla() {
    // 1. Seleccionar archivo
    const path = await open({
      title: 'Importar Tabla SERA (.srx)',
      filters: [{ name: 'SERA Data Package', extensions: ['srx'] }],
      multiple: false
    });

    if (!path || Array.isArray(path)) return;

    try {
      // 2. Intentar importar directamente con llave interna (password null)
      const nombreImportado = await invoke<string>('importar_tabla', { path, nuevoNombre: null, password: null });
      this.ngZone.run(() => {
        this.confirmarImportacion(nombreImportado);
      });
    } catch (error: any) {
      this.ngZone.run(() => {
        const errorStr = error.toString().toLowerCase();

        // 3. Si falla por descifrado, pedir contraseña
        if (errorStr.includes("descifrado") || errorStr.includes("contraseña") || errorStr.includes("decrypt")) {
          this.reintentarImportacionConPassword(path);
        } 
        // 4. Si falla por conflicto de nombre
        else if (errorStr.includes("already exists") || errorStr.includes("ya existe")) {
          this.resolverConflictoImportacion(path);
        } else {
          this.snackBar.open("Error al importar: " + error, "Cerrar", { duration: 5000 });
        }
      });
    }
  }

  /** Lógica de reintento pidiendo contraseña al usuario. */
  private async reintentarImportacionConPassword(path: string) {
    const dialogRef = this.dialog.open(DialogPassword, {
      width: '400px',
      data: {
        title: 'Archivo Protegido',
        message: 'Este archivo requiere una contraseña para ser descifrado correctamente.',
        required: false
      }
    });

    dialogRef.afterClosed().subscribe(async (password) => {
      if (password === undefined) return; // Canceló el diálogo

      try {
        const res = await invoke<string>('importar_tabla', { path, nuevoNombre: null, password });
        this.ngZone.run(() => {
          this.confirmarImportacion(res);
        });
      } catch (e: any) {
        this.ngZone.run(() => {
          const eStr = e.toString().toLowerCase();
          if (eStr.includes("exists") || eStr.includes("ya existe")) {
            this.resolverConflictoImportacion(path, password);
          } else {
            this.snackBar.open("Contraseña incorrecta o archivo corrupto", "Cerrar", { duration: 5000 });
          }
        });
      }
    });
  }

  /** Abre el diálogo para renombrar la tabla en conflicto. */
  private async resolverConflictoImportacion(path: string, passwordUsed: string | null = null) {
    // Extraer por defecto el nombre del archivo sin extensión para sugerir
    const fileName = path.split(/[\\/]/).pop()?.replace('.srx', '') || 'nueva_tabla';
    
    const dialogRef = this.dialog.open(DialogRenameComponent, {
      width: '400px',
      data: { nombreOriginal: fileName }
    });

    dialogRef.afterClosed().subscribe(async (nuevoNombre) => {
      if (nuevoNombre) {
        try {
          const res = await invoke<string>('importar_tabla', { path, nuevoNombre, password: passwordUsed });
          this.ngZone.run(() => {
            this.confirmarImportacion(res);
          });
        } catch (e) {
          this.ngZone.run(() => {
            this.snackBar.open("Error al reintentar importación: " + e, "Cerrar", { duration: 5000 });
          });
        }
      }
    });
  }


  /** Finaliza el proceso de importación y actualiza la UI. */
  private confirmarImportacion(nombreList: string) {
    const nombres = nombreList.split(',').map(n => n.trim());
    let mensaje = '';
    if (nombres.length === 1) {
      mensaje = `Tabla "${nombres[0]}" importada y lista para usar`;
    } else {
      mensaje = `Se importó la tabla "${nombres[0]}" junto con ${nombres.length - 1} tablas vinculadas`;
    }
    this.snackBar.open(mensaje, "¡Éxito!", { duration: 5000 });
    // Forzar recarga del listado de tablas en el Store
    this.store.dispatch(StoreActions.loadListadoTablas());
  }
  /** Muestra el diálogo "Acerca de SERA" con información del autor (WolfTeI). */
  showAbout() {
    this.dialog.open(AboutDialogComponent, {
      width: '450px',
      panelClass: 'custom-dialog-container',
      autoFocus: false
    });
  }

  /** Importa datos desde un archivo Excel o CSV. */
  async importarExcel() {
    // 1. Seleccionar archivo
    const path = await open({
      title: 'Importar desde Excel o CSV',
      filters: [{ name: 'Documentos de datos', extensions: ['xlsx', 'xls', 'csv'] }],
      multiple: false
    });

    if (!path || Array.isArray(path)) return;

    try {
      // 2. Leer archivo como bytes
      const fileData = await readFile(path);
      
      // 3. Parsear con XLSX con soporte explícito para fechas
      const workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convertir a JSON
      let jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      // Formatear objetos Date a strings YYYY-MM-DD (Evitando offset de Timezone)
      jsonData = jsonData.map(row => {
        const newRow: any = {};
        for (const key in row) {
          if (row[key] instanceof Date) {
            const d = row[key] as Date;
            const pad = (n: number) => n.toString().padStart(2, '0');
            // Almacenamos SIEMPRE en formato YYYY-MM-DD (ISO) para que SQLite ordene bien.
            // La UI se encargará de mostrarlo como DD/MM/YYYY
            newRow[key] = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          } else {
            newRow[key] = row[key];
          }
        }
        return newRow;
      });

      if (!jsonData || jsonData.length === 0) {
        this.snackBar.open("El archivo está vacío o no tiene un formato válido", "Cerrar", { duration: 3000 });
        return;
      }

      // 4. Abrir el diálogo de importación
      const fileName = path.split(/[\\/]/).pop() || 'archivo';
      const activeTableName = this.activeTable ? this.activeTable.tabla : null;

      const dialogRef = this.dialog.open(DialogImportExcel, {
        width: '800px',
        maxWidth: '90vw',
        data: {
          json: jsonData,
          fileName: fileName,
          activeTable: activeTableName
        }
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result && result.success) {
          this.snackBar.open(`Importación en "${result.tableName}" completada con éxito`, "¡Éxito!", { duration: 4000 });
          this.store.dispatch(StoreActions.loadListadoTablas());
          
          // Si se creó una nueva tabla, la abrimos o refrescamos la actual
          if (result.tableName === activeTableName && this.activeTable) {
            this.activeTable.refresh();
          } else {
            this.addTab(result.tableName);
          }
        }
      });

    } catch (error) {
      console.error("[SERA] Error al procesar Excel:", error);
      this.snackBar.open("Error al procesar el archivo: " + error, "Cerrar", { duration: 5000 });
    }
  }

  /** Abre la carpeta física donde se guardan los adjuntos. */
  async openAttachmentsFolder() {
    try {
      await invoke('open_attachments_folder');
    } catch (error) {
      console.error("[SERA] Error al abrir carpeta de adjuntos:", error);
      this.snackBar.open("No se pudo abrir la carpeta de adjuntos", "Error", { duration: 3000 });
    }
  }
}

