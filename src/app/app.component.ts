import { Component, ElementRef, ViewChild, ViewChildren, QueryList, ChangeDetectorRef, AfterViewInit, OnInit } from "@angular/core";
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
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
})
export class AppComponent implements AfterViewInit, OnInit {
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

  /** Indica si hay una comprobación de actualizaciones en curso. */
  isCheckingUpdate = false;

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
    public cdr: ChangeDetectorRef
  ) {
    this.store.dispatch(StoreActions.loadStores());
    this.store.dispatch(StoreActions.loadListadoTablas());
    this.configData = this.store.select(selectConfigData);
    this.tablas = this.store.select(selectTablas);
  }

  async ngOnInit() {
    await this.checkForUpdates();
  }

  /**
   * Comprueba en segundo plano si existe una actualización en el servidor (GitHub Releases).
   * Si hay una nueva versión, pregunta al usuario y ejecuta el proceso de descarga,
   * instalación y reinicio de manera automática.
   */
  async checkForUpdates() {
    try {
      // Importamos dinámicamente para no bloquear el inicio de la app
      const { check } = await import('@tauri-apps/plugin-updater');
      const { ask } = await import('@tauri-apps/plugin-dialog');
      const { relaunch } = await import('@tauri-apps/plugin-process');

      const update = await check();
      
      if (update) {
        const yes = await ask(
          `¡Hay una nueva versión de SERA disponible (${update.version})!\n\n¿Deseas descargar e instalar la actualización ahora?`, 
          { title: 'Actualización Disponible', kind: 'info' }
        );
        
        if (yes) {
          // Mostramos un mensaje que no desaparece mientras descarga
          const snack = this.snackBar.open(`Descargando e instalando versión ${update.version}... Por favor, no cierres la aplicación.`, "", { duration: 0 });
          
          await update.downloadAndInstall();
          
          snack.dismiss();
          this.snackBar.open(`Actualización instalada con éxito. Reiniciando...`, "", { duration: 2000 });
          
          // Damos un pequeño margen para que el usuario lea el mensaje
          setTimeout(async () => {
            await relaunch();
          }, 1500);
        }
      }
    } catch (error) {
      console.error("[SERA Updater] Error comprobando actualizaciones:", error);
    }
  }

  /**
   * Comprobación manual de actualizaciones iniciada por el usuario desde el ribbon.
   * A diferencia del check automático al inicio, informa explícitamente si la app
   * ya está en su última versión.
   */
  async checkForUpdatesManual() {
    if (this.isCheckingUpdate) return;
    this.isCheckingUpdate = true;

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const { ask, message } = await import('@tauri-apps/plugin-dialog');
      const { relaunch } = await import('@tauri-apps/plugin-process');

      const update = await check();

      if (update) {
        // Hay una nueva versión disponible
        const yes = await ask(
          `¡Nueva versión disponible: v${update.version}!\n\n¿Deseas descargar e instalar la actualización ahora?`,
          { title: 'Actualización Disponible', kind: 'info' }
        );

        if (yes) {
          const snack = this.snackBar.open(
            `Descargando versión ${update.version}... No cierres la aplicación.`,
            '',
            { duration: 0 }
          );

          await update.downloadAndInstall();

          snack.dismiss();
          this.snackBar.open('Actualización instalada. Reiniciando...', '', { duration: 2000 });

          setTimeout(async () => {
            await relaunch();
          }, 1500);
        }
      } else {
        // Sin actualizaciones disponibles — informar explícitamente al usuario
        await message(
          'SERA está actualizado.\nYa tenés la última versión disponible.',
          { title: 'Sin actualizaciones', kind: 'info' }
        );
      }
    } catch (error) {
      console.error('[SERA Updater Manual] Error:', error);
      this.snackBar.open('No se pudo verificar actualizaciones. Revisá tu conexión.', 'Cerrar', { duration: 4000 });
    } finally {
      this.isCheckingUpdate = false;
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

  /** Agrega una tabla al panel de tabs si no estaba abierta. */
  addTab(tabName: string) {
    if (!this.tabs.includes(tabName)) {
      this.tabs = [...this.tabs, tabName];
      this.selected.setValue(this.tabs.length - 1);
      const tablaActual = this.tabs[this.selected.value ?? 0];
      this.store.dispatch(StoreActions.loadCampos({ tabla: tablaActual }));
      this.store.dispatch(StoreActions.loadContenido({ tabla: tablaActual }));
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

  /** Exporta la tabla activa a un archivo .srx encriptado. */
  async exportarTabla() {
    if (!this.activeTable) return;
    const nombreTabla = this.activeTable.tabla;

    // 1. Selector de ruta de guardado
    const path = await save({
      title: 'Exportar Tabla SERA',
      filters: [{ name: 'SERA Data Package', extensions: ['srx'] }],
      defaultPath: `${nombreTabla}.srx`
    });

    if (!path) return;

    try {
      await invoke('exportar_tabla', { nombreTabla, path });
      this.snackBar.open(`Tabla "${nombreTabla}" exportada correctamente`, "Cerrar", { duration: 3000 });
    } catch (error) {
      console.error("[SERA] Error al exportar:", error);
      this.snackBar.open("Error al exportar tabla: " + error, "Cerrar", { duration: 5000 });
    }
  }

  /** Importa una tabla desde un archivo .srx, manejando conflictos de nombre. */
  async importarTabla() {
    // 1. Seleccionar archivo
    const path = await open({
      title: 'Importar Tabla SERA (.srx)',
      filters: [{ name: 'SERA Data Package', extensions: ['srx'] }],
      multiple: false
    });

    if (!path || Array.isArray(path)) return;

    try {
      // 2. Intentar importar directamente
      const nombreImportado = await invoke<string>('importar_tabla', { path, nuevoNombre: null });
      this.confirmarImportacion(nombreImportado);
    } catch (error: any) {
      // 3. Manejar conflicto si la tabla ya existe
      if (error.toString().includes("already exists") || error.toString().toLowerCase().includes("ya existe")) {
        this.resolverConflictoImportacion(path);
      } else {
        this.snackBar.open("Error al importar: " + error, "Cerrar", { duration: 5000 });
      }
    }
  }

  /** Abre el diálogo para renombrar la tabla en conflicto. */
  private async resolverConflictoImportacion(path: string) {
    // Extraer por defecto el nombre del archivo sin extensión para sugerir
    const fileName = path.split(/[\\/]/).pop()?.replace('.srx', '') || 'nueva_tabla';
    
    const dialogRef = this.dialog.open(DialogRenameComponent, {
      width: '400px',
      data: { nombreOriginal: fileName }
    });

    dialogRef.afterClosed().subscribe(async (nuevoNombre) => {
      if (nuevoNombre) {
        try {
          const res = await invoke<string>('importar_tabla', { path, nuevoNombre });
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
}
