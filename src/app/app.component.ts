import { Component, ElementRef, ViewChild, ViewChildren, QueryList, ChangeDetectorRef, AfterViewInit, OnInit, signal, HostListener } from "@angular/core";
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
import { ThemeSelectorDialogComponent } from "./components/theme-selector-dialog/theme-selector-dialog";
import { ThemeService } from "./services/theme";
import { HomeDashboardComponent } from "./components/home-dashboard/home-dashboard";
import { UiService } from "./services/ui.service";
import { TableDashboardComponent } from "./components/table-dashboard/table-dashboard";
import { GlobalSearchComponent } from "./components/global-search/global-search";
import { SearchResultsComponent } from "./components/search-results/search-results";


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
    public cdr: ChangeDetectorRef
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
    const index = this.tabs.indexOf(tabName);
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
        campos: camposDisponibles
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        await this.pdfService.generarPdf(
          this.elementPDF.nativeElement,
          result,
          datos.length > 0 ? datos : this.elementos.selected
        );
        this.snackBar.open("Documento PDF generado correctamente", "", { duration: 3000 });
      }
    });
  }

  /** Abre el dialog de configuración global del sistema (datos del usuario, institución, membrete). */
  openDialogAjustes() {
    this.dialog.open(ConfigDataDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      data: {},
    });
  }

  /** Abre el diálogo para seleccionar el tema visual de la aplicación. */
  openThemeSelector() {
    this.dialog.open(ThemeSelectorDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      panelClass: 'theme-selector-panel'
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

  /** Abre el dialog de confirmación para eliminar una tabla. */
  eliminarTabla(nombre_tabla: string) {
    const dialogRef = this.dialog.open(DialogDeleteComponent, {
      width: "250px",
      data: {
        title: "¿Seguro que desea eliminar la tabla?",
        message: "Perderá todos los datos de los registros.",
        tabla: nombre_tabla,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      // El effect de Redux maneja la recarga automáticamente al finalizar
    });
  }

  /** Abre el dialog para editar la estructura de una tabla específica. */
  abrirDialogoEdicionTabla(tableName?: string) {
    const tablaActual = tableName || this.tabs[this.selected.value ?? 0];
    if (!tablaActual) return;

    // Si la tabla es la activa, usamos los campos del Store
    if (tablaActual === this.tabs[this.selected.value ?? 0]) {
      this.store.select(selectCampos).subscribe(fields => {
        this.mostrarDialogEditor(tablaActual, fields);
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
          this.snackBar.open(`Tabla "${nombreTabla}" exportada correctamente`, "Cerrar", { duration: 3000 });
        } catch (error) {
          console.error("[SERA] Error al exportar:", error);
          this.snackBar.open("Error al exportar tabla: " + error, "Cerrar", { duration: 5000 });
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
      this.confirmarImportacion(nombreImportado);
    } catch (error: any) {
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
        this.confirmarImportacion(res);
      } catch (e: any) {
        const eStr = e.toString().toLowerCase();
        if (eStr.includes("exists") || eStr.includes("ya existe")) {
          this.resolverConflictoImportacion(path, password);
        } else {
          this.snackBar.open("Contraseña incorrecta o archivo corrupto", "Cerrar", { duration: 5000 });
        }
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
          this.confirmarImportacion(res);
        } catch (e) {
          this.snackBar.open("Error al reintentar importación: " + e, "Cerrar", { duration: 5000 });
        }
      }
    });
  }


  /** Finaliza el proceso de importación y actualiza la UI. */
  private confirmarImportacion(nombre: string) {
    this.snackBar.open(`Tabla "${nombre}" importada y lista para usar`, "¡Éxito!", { duration: 4000 });
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
      
      // 3. Parsear con XLSX
      const workbook = XLSX.read(fileData, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convertir a JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

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

