import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ElementRef,
  HostListener,
  ChangeDetectorRef,
  AfterViewInit,
} from "@angular/core";
import { MaterialModule } from "../../shared/material.module";
import { SelectionModel } from "@angular/cdk/collections";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Store } from "@ngrx/store";
import { Observable, Subscription, map } from "rxjs";
import { Campos } from "../../interfaces/campos.interfaces";
import { DeleteRecord } from "../../interfaces/registros.interfaces";
import { StoreActions } from "../../store/store.actions";
import { selectCampos, selectContenido } from "../../store/store.selectors";
import { CommonModule } from "@angular/common";
import { FormularioRegistroComponent } from "../formulario-registro/formulario-registro.component";
import { DetalleRegistroComponent } from "../detalle-registro/detalle-registro";
import { MatMenuTrigger } from "@angular/material/menu";
import { TableConfigDialog } from "../table-config-dialog/table-config-dialog";
import { TableConfig, TableRule, CalculatedField } from "../../interfaces/tablas.interfaces";
import { invoke } from "@tauri-apps/api/core";
import { MatTableDataSource } from "@angular/material/table";
import { MatSort } from "@angular/material/sort";
import { FilterSeraDialog, FilterRule } from "../filter-sera-dialog/filter-sera-dialog";
import { SearchPaletteDialog } from "../search-palette-dialog/search-palette-dialog";
import { FormulaEngine } from "../../utils/formula-engine";
import { SeraPluginService } from "../../services/sera-plugin.service";
import { FormatNamePipe } from "../../shared/pipes/format-name.pipe";

@Component({
  selector: "app-table",
  standalone: true,
  imports: [MaterialModule, CommonModule, FormatNamePipe],
  templateUrl: "./table.component.html",
  styleUrl: "./table.component.scss",
})
export class TableComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() tabla!: string;
  @Output() elementosSeleccionados: EventEmitter<any> = new EventEmitter<any>();
  @Output() printPdf: EventEmitter<any[]> = new EventEmitter<any[]>();

  campos!: Observable<Campos[]>;
  contenido!: Observable<any>;
  campoSeleccion!: string;

  allColumns: string[] = []; // Todas las columnas originales
  displayedColumns: string[] = []; // Columnas actualmente renderizadas
  hiddenColumns: Set<string> = new Set(); // Columnas ocultas por el usuario

  dataSource = new MatTableDataSource<any>([]);
  dataSearch: any[] = [];
  selection = new SelectionModel<any>(true, []);

  subcriptions: Subscription[] = [];
  tableRules: TableRule[] = [];
  calculatedFields: CalculatedField[] = [];
  activeFilters: FilterRule[] = [];
  lastSearchValue: string = '';
  private searchDialogRef: any = null;
  
  // Vínculos Relacionales
  linkedFields: any[] = [];
  dictionaries: { [key: string]: { [id: string]: string } } = {};

  // Configuración de visualización
  allowAttachments: boolean = true;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('contextMenuTrigger', { read: MatMenuTrigger }) contextMenuTrigger!: MatMenuTrigger;
  @ViewChild('contextMenuTrigger', { read: ElementRef }) contextMenuTriggerEl!: ElementRef;

  // Context Menu State
  contextMenuPosition = { x: 0, y: 0 };
  isContextMenuVisible = true;
  contextMenuTarget: { row: any; col: string; value: any; isPluginRendered: boolean; hasPlugin: boolean; isPluginBypassed: boolean } | null = null;
  bypassedPluginCells: Set<string> = new Set(); // Guarda IDs de fila + columna para ignorar plugin temporalmente

  constructor(
    private store: Store,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    public pluginService: SeraPluginService
  ) {}

  ngOnInit(): void {
    this.campos = this.store.select(selectCampos).pipe(
      map(m => m[this.tabla.toLowerCase()] || [])
    );
    this.contenido = this.store.select(selectContenido).pipe(
      map(m => m[this.tabla.toLowerCase()] || [])
    );
    this.campoSeleccion = `select${this.tabla}`;
    
    // Configurar buscador local inteligente y tolerante a diccionarios relacionales
    this.dataSource.filterPredicate = (data: any, filter: string) => {
      const cleanFilter = filter.trim().toLowerCase();
      if (!cleanFilter) return true;

      const colsToSearch = this.allColumns.filter(c => c !== this.campoSeleccion && c !== 'actions' && c !== 'sera_adjuntos');
      return colsToSearch.some(col => {
        let val = data[col];
        if (this.dictionaries[col]) {
          val = this.translateValue(col, val);
        }
        const strVal = String(val || '').toLowerCase();
        return strVal.includes(cleanFilter);
      });
    };

    this.subcriptions = [
      this.campos.subscribe({
        next: (campos) => {
          // VALIDACIÓN: Solo actualizamos si los campos corresponden a esta tabla
          // El ID de la tabla siempre tiene el formato id_{nombre_tabla}
          const expectedId = `id_${this.tabla.toLowerCase()}`;
          const hasCorrectId = campos.some(c => c.Field.toLowerCase() === expectedId);

          if (!hasCorrectId && campos.length > 0) return;

          this.allColumns = [this.campoSeleccion];
          
          if (this.allowAttachments) {
            this.allColumns.push('sera_adjuntos');
          }

          campos.forEach((campo) => {
            const fieldLower = campo.Field.toLowerCase();
            const isId = fieldLower === 'id' || fieldLower.startsWith('id_');
            const isSystem = fieldLower.startsWith('sera_');

            if (!isId && !isSystem) {
              this.allColumns.push(campo.Field);
            }
          });
          this.allColumns.push("actions");
          this.updateDisplayedColumns();
        },
      }),
      this.contenido.subscribe({
        next: (contenido) => {
          this.dataRaw = contenido;
          this.loadRulesAndCalculate();
          this.cdr.detectChanges();
        },
      }),
    ];
    this.pluginService.registerTableSelection(this.tabla, this.selection);
  }

  private dataRaw: any[] = [];

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    
    // Configurar sortingDataAccessor personalizado para ordenar fechas y números de forma perfecta
    this.dataSource.sortingDataAccessor = (item: any, property: string) => {
      const value = item[property];
      if (value === undefined || value === null) return '';
      
      const propLower = property.toLowerCase();
      const isFechaCol = propLower.includes('fecha') || propLower.includes('date') || propLower.includes('timestamp');
      
      if (isFechaCol) {
        // Caso 1: Formato DD/MM/YYYY o DD/MM/YYYY HH:MM:SS
        if (typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(value)) {
          const parts = value.split(' ')[0].split('/');
          return Number(`${parts[2]}${parts[1]}${parts[0]}`);
        }
        
        // Caso 2: Formato ISO YYYY-MM-DD o YYYY-MM-DD HH:MM:SS
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
          const parts = value.split(' ')[0].split('-');
          return Number(`${parts[0]}${parts[1]}${parts[2]}`);
        }
        
        // Caso 3: Objeto Date real
        if (value instanceof Date) {
          return value.getTime();
        }
        
        // Intento genérico de parsear fecha
        const parsedDate = new Date(value);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.getTime();
        }
      }
      
      // Ordenamiento de números guardados como texto (evita orden alfabético incorrecto como [10, 2])
      if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
        return Number(value);
      }
      
      // Ordenamiento insensible a mayúsculas para strings comunes
      return typeof value === 'string' ? value.toLowerCase() : value;
    };
  }

  toggleColumnVisibility(column: string) {
    if (this.hiddenColumns.has(column)) {
      this.hiddenColumns.delete(column);
    } else {
      this.hiddenColumns.add(column);
    }
    this.updateDisplayedColumns();
  }

  updateDisplayedColumns() {
    this.displayedColumns = this.allColumns.filter(c => !this.hiddenColumns.has(c));
  }

  ngOnDestroy() {
    this.subcriptions.forEach((sub) => sub.unsubscribe());
    if (this.searchDialogRef) {
      this.searchDialogRef.close();
    }
    this.pluginService.unregisterTableSelection(this.tabla);
  }

  emitSelected(row: any) {
    this.selection.toggle(row);
    this.elementosSeleccionados.emit(this.selection);
  }

  emitAllSelected() {
    this.toggleAllRows();
    this.elementosSeleccionados.emit(this.selection);
  }

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows && numRows > 0;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }
    this.selection.select(...this.dataSource.data);
  }

  /** The label for the checkbox on the passed row */
  checkboxLabel(row?: any): string {
    if (!row) {
      return `${this.isAllSelected() ? "deselect" : "select"} all`;
    }

    return `${this.selection.isSelected(row) ? "deselect" : "select"} row ${
      row.position + 1
    }`;
  }

  openDialogUploadRegistro(id: string) {
    const dialogRef = this.dialog.open(FormularioRegistroComponent, {
      width: "500px",
      data: {
        message: "Actualizar Registro",
        tabla: this.tabla,
        contenido: this.dataSource,
        id: id,
        upload: true,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.snackBar.open("Registro Actualizado", "", { duration: 3000 });
      }
    });
  }

  openDetalleRegistro(row: any) {
    const dialogRef = this.dialog.open(DetalleRegistroComponent, {
      width: '95vw',
      height: '90vh',
      maxWidth: '98vw',
      data: {
        tabla: this.tabla,
        row: row
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.action === 'edit') {
        const id = row['id_' + this.tabla];
        this.openDialogUploadRegistro(id);
      }
    });
  }

  eliminarRegistro(id: string) {
    const tablaAEleiminar: DeleteRecord = {
      tabla: this.tabla,
      ids: parseInt(id),
    };
    this.store.dispatch(
      StoreActions.loadDeleteRecord({ deleteRecord: tablaAEleiminar })
    );
    this.snackBar.open("Registro Eliminado", "", { duration: 3000 });
  }


  openSearchPalette() {
    this.searchDialogRef = this.dialog.open(SearchPaletteDialog, {
      width: '450px',
      position: { top: '140px', right: '20px' },
      panelClass: 'spotlight-dialog-panel', 
      hasBackdrop: false, // NO BLOQUEA Clics en la tabla de atrás
      data: {
        initialValue: this.lastSearchValue,
        onSearch: (val: string) => {
          this.lastSearchValue = val;
          this.applyDataSourceSearch(val);
          return {
            filtered: this.dataSource.filteredData.length,
            total: this.dataSource.data.length
          };
        }
      }
    });

    this.searchDialogRef.afterClosed().subscribe(() => {
      // Al cerrar la paleta de búsqueda local, limpiamos el filtro y restablecemos todos los registros
      this.lastSearchValue = '';
      this.applyDataSourceSearch('');
      this.searchDialogRef = null;
      this.cdr.detectChanges();
    });
  }

  applyDataSourceSearch(filterValue: string) {
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  search(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.lastSearchValue = filterValue;
    this.applyDataSourceSearch(filterValue);
  }

  refresh() {
    this.dictionaries = {}; // Limpiamos traducciones viejas antes de refrescar
    this.selection.clear(); // Limpiamos selección al refrescar
    this.store.dispatch(StoreActions.loadContenido({ tabla: this.tabla }));
  }

  desmarcarTodo() {
    this.selection.clear();
    this.elementosSeleccionados.emit(this.selection);
  }

  async eliminarSeleccionados() {
    const total = this.selection.selected.length;
    if (total === 0) return;

    // Nota: Se eliminó window.confirm porque Tauri v2 lo bloquea por defecto sin permisos específicos.
    try {
      // En lugar de borrar de a uno, enviamos una lista de IDs para que el backend lo haga en una transacción
      for (const row of this.selection.selected) {
        // Buscamos la columna ID dinámicamente (la que empieza con id_)
        const idKey = Object.keys(row).find(key => key.toLowerCase().startsWith('id_')) || 'id';
        const id = row[idKey];
        
        console.log(`[SERA Debug] Eliminando en '${this.tabla}'. Columna ID encontrada: '${idKey}', Valor: ${id}`);

        if (id === undefined || id === null) {
          console.warn("[SERA Debug] No se pudo encontrar el ID para el registro:", row);
          continue;
        }

        await invoke('eliminar_registro', { tabla: this.tabla, id: parseInt(id) });
      }
        
        this.snackBar.open(`${total} registros eliminados correctamente`, 'OK', { duration: 3000 });
        this.refresh();
      } catch (e) {
        console.error("Error en eliminación masiva:", e);
        this.snackBar.open("Error al eliminar algunos registros", "Cerrar", { duration: 5000 });
      }
  }

  applyAdvancedFilters() {
    if (!this.activeFilters || this.activeFilters.length === 0) {
      this.dataSource.data = this.dataSearch; // Restablecer
      return;
    }

    const filtered = this.dataSearch.filter(row => {
      // Toda regla debe cumplirse (comportamiento AND)
      return this.activeFilters.every(rule => {
        const rowValue = row[rule.field];
        const valStr = String(rowValue || '').toLowerCase();
        const ruleValStr = String(rule.value || '').toLowerCase();

        switch (rule.operator) {
          case 'equals':
            return valStr === ruleValStr;
          case 'contains':
            return valStr.includes(ruleValStr);
          case 'not_contains':
            return !valStr.includes(ruleValStr);
          case 'lt':
            return Number(rowValue) < Number(rule.value);
          case 'gt':
            return Number(rowValue) > Number(rule.value);
          case 'is_empty':
            return valStr === '' || rowValue === null || rowValue === undefined;
          case 'is_not_empty':
            return valStr !== '' && rowValue !== null && rowValue !== undefined;
          default:
            return true;
        }
      });
    });

    this.dataSource.data = filtered;
  }

  openFilterDialog() {
    const camposFiltrados = this.allColumns.filter(c => 
      c !== this.campoSeleccion && 
      c !== 'actions' && 
      !c.startsWith('sera_')
    );

    const dialogRef = this.dialog.open(FilterSeraDialog, {
      width: '80%',
      minWidth: '500px',
      data: {
        campos: camposFiltrados,
        currentFilters: this.activeFilters
      }
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (!result) return;
      if (result.action === 'apply') {
        this.activeFilters = result.filters;
        this.applyAdvancedFilters();
        this.snackBar.open(`Aplicados ${this.activeFilters.length} filtro(s)`, 'OK', { duration: 3000 });
      } else if (result.action === 'clear') {
        this.activeFilters = [];
        this.applyAdvancedFilters();
        this.snackBar.open("Filtros eliminados", "OK", { duration: 3000 });
      }
      this.cdr.detectChanges(); 
    });
  }

  exportListView() {
    const dataToExport = this.selection.selected.length > 0 ? this.selection.selected : this.dataSource.filteredData;
    this.printPdf.emit(dataToExport);
  }

  async loadRulesAndCalculate() {
    try {
      const configJson: string = await invoke('get_tabla_config', { nombreTabla: this.tabla });
      if (configJson && configJson.trim() !== '' && configJson !== '{}') {
        const config: TableConfig = JSON.parse(configJson);
        this.tableRules = config.rules || [];
        this.calculatedFields = config.calculatedFields || [];
        this.linkedFields = config.linkedFields || [];
        this.allowAttachments = config.allowAttachments !== false;
        
        if (this.linkedFields.length > 0) {
          await this.buildDictionaries();
        } else {
          this.dictionaries = {};
        }
      } else {
        this.tableRules = [];
        this.calculatedFields = [];
        this.linkedFields = [];
        this.allowAttachments = true;
        this.dictionaries = {};
      }
      
      // Forzamos actualización de columnas después de cargar config
      this.store.dispatch(StoreActions.loadCampos({ tabla: this.tabla }));
    } catch (e) {
      console.error("Error loading table rules:", e);
      this.tableRules = [];
      this.calculatedFields = [];
    }
    
    this.applyVirtualCalculations();
  }

  applyVirtualCalculations() {
    if (!this.dataRaw) return;

    const processedData = this.dataRaw.map(row => {
      const newRow = { ...row };
      
      if (this.calculatedFields && this.calculatedFields.length > 0) {
        this.calculatedFields.forEach(cf => {
          if (cf.isActive && cf.targetField && cf.formula) {
            // evaluateForDisplay: muestra 'ERROR_FORMULA' al usuario si falla,
            // pero no afecta la lógica de reglas de color (que usa evaluate())
            newRow[cf.targetField] = FormulaEngine.evaluateForDisplay(cf.formula, row);
          }
        });
      }
      return newRow;
    });

    this.dataSearch = processedData;
    this.dataSource.data = this.dataSearch;
    this.cdr.detectChanges();
  }

  getRowStyle(row: any): any {
    if (!this.tableRules || this.tableRules.length === 0) return {};

    for (const rule of this.tableRules) {
      if (rule.applyTo === 'cell') continue; // Ignorar reglas de celda

      if (this.checkRuleMatch(rule, row)) {
        return {
          'background-color': rule.backgroundColor !== 'transparent' ? rule.backgroundColor : undefined,
          'color': rule.textColor || undefined,
        };
      }
    }
    return {};
  }

  getCellStyle(row: any, column: string): any {
    if (!this.tableRules || this.tableRules.length === 0) return {};

    for (const rule of this.tableRules) {
      // Solo aplicar si es regla de celda y coincide con esta columna
      if (rule.applyTo !== 'cell' || rule.targetColumn !== column) continue;

      if (this.checkRuleMatch(rule, row)) {
        return {
          'background-color': rule.backgroundColor !== 'transparent' ? rule.backgroundColor : undefined,
          'color': rule.textColor || undefined,
        };
      }
    }
    return {};
  }

  private checkRuleMatch(rule: TableRule, row: any): boolean {
    if (rule.type === 'formula' && rule.formula) {
      return !!FormulaEngine.evaluate(rule.formula, row);
    } 
    else if (rule.field && rule.operator) {
      const rowValue = row[rule.field];
      if (rowValue === undefined || rowValue === null) return false;
      
      const strRowVal = String(rowValue).toLowerCase();
      const strRuleVal = String(rule.value || '').toLowerCase();

      switch (rule.operator) {
        case 'equals':
          if (strRuleVal.includes(' or ')) {
            const targets = strRuleVal.split(' or ');
            return targets.some(t => strRowVal === t.trim());
          }
          return strRowVal === strRuleVal;
        case 'contains':
          if (strRuleVal.includes(' or ')) {
            const targets = strRuleVal.split(' or ');
            return targets.some(t => strRowVal.includes(t.trim()));
          }
          return strRowVal.includes(strRuleVal);
        case 'lt':
          return Number(rowValue) < Number(rule.value);
        case 'gt':
          return Number(rowValue) > Number(rule.value);
        case 'is_past':
          const datePast = new Date(rowValue);
          return !isNaN(datePast.getTime()) && datePast < new Date();
        case 'is_future':
          const dateFuture = new Date(rowValue);
          return !isNaN(dateFuture.getTime()) && dateFuture > new Date();
      }
    }
    return false;
  }


  @HostListener('click', ['$event'])
  onTableClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // 1. Delegación para el plugin de Código de Barras
    const barcodeBtn = target.closest('.badge-barcode-btn');
    if (barcodeBtn) {
      const showFn = (window as any).SeraAPI_barcode_show;
      if (showFn) {
        const val = barcodeBtn.getAttribute('data-value') || 
                    barcodeBtn.textContent?.replace('🏷️ Barcode: ', '').trim();
        if (val) {
          showFn(val);
        }
      }
      event.stopPropagation();
      return;
    }

    // 2. Delegación para el plugin Redactor de Datos PII
    const piiBtn = target.closest('.badge-pii-masked');
    if (piiBtn) {
      const toggleFn = (window as any).SeraAPI_redactor_toggle;
      if (toggleFn) {
        const val = piiBtn.getAttribute('data-value');
        if (val) {
          toggleFn(piiBtn, val);
        }
      }
      event.stopPropagation();
      return;
    }
  }

  async buildDictionaries() {
    this.dictionaries = {};
    for (const link of this.linkedFields) {
      try {
        const res: any[] = await invoke('get_contenido', { tabla: link.remoteTable });
        const dict: { [id: string]: string } = {};
        // El backend devuelve el array directamente
        res.forEach((row: any) => {
          dict[String(row[link.remoteField])] = String(row[link.displayField]);
        });
        this.dictionaries[link.localField] = dict;
      } catch (e) {
        console.error(`Error construyendo diccionario para ${link.localField}:`, e);
      }
    }
  }

  translateValue(column: string, value: any): string {
    if (this.dictionaries[column]) {
      const translation = this.dictionaries[column][String(value)];
      return translation !== undefined ? translation : `ID: ${value}`;
    }
    
    // Auto-detección de fechas ISO (YYYY-MM-DD o YYYY-MM-DD HH:MM:SS) para formateo visual.
    // Esto permite que en BD sigan siendo YYYY-MM-DD para un ordenamiento perfecto,
    // pero el usuario siempre las vea como DD/MM/YYYY.
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const datePart = value.split(' ')[0];
      const parts = datePart.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    return value;
  }

  formatDateSafe(value: any): string {
    if (!value) return '';
    // Si viene en formato ISO YYYY-MM-DD o YYYY-MM-DD HH:MM:SS
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const datePart = value.split(' ')[0];
      const parts = datePart.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    // Si ya viene como DD/MM/YYYY o cualquier otro string lo devolvemos tal cual para no romper
    return String(value);
  }

  openConfigDialog() {
    const camposActuales = this.allColumns.filter(c => 
      c !== this.campoSeleccion && 
      c !== 'actions' && 
      !c.startsWith('sera_')
    );

    const dialogRef = this.dialog.open(TableConfigDialog, {
      width: '95vw',
      maxWidth: '1350px',
      data: {
        tabla: this.tabla,
        campos: camposActuales
      }
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result && result.reload) {
        this.loadRulesAndCalculate();
        this.snackBar.open("Configuración de tabla actualizada", "OK", { duration: 3000 });
      }
      this.cdr.detectChanges();
    });
  }

  hasCellRenderer(column: string): boolean {
    return this.pluginService.cellRenderers.has(column.toLowerCase());
  }

  renderCell(column: string, value: any, row: any): string {
    const cellId = `${row['id_' + this.tabla]}-${column}`;
    if (this.bypassedPluginCells.has(cellId)) {
      return String(value === undefined || value === null ? '' : value);
    }
    const renderer = this.pluginService.cellRenderers.get(column.toLowerCase());
    return renderer ? renderer(value, row) : String(value === undefined || value === null ? '' : value);
  }



  // --- CONTEXT MENU LOGIC ---
  @HostListener('document:contextmenu', ['$event'])
  onGlobalContextMenu(event: MouseEvent) {
    // Si el evento fue re-despachado por nosotros mismos para reposicionar, dejarlo pasar
    if ((event as any)._isSeraRetrigger) return;

    if (!this.contextMenuTrigger?.menuOpen) return;

    const target = event.target as HTMLElement;
    if (target.closest('.mat-mdc-menu-panel')) return;

    // Interceptar contextmenu cuando el menú está abierto para reposicionarlo al instante
    event.preventDefault();
    event.stopPropagation();

    const backdrop = document.querySelector('.cdk-overlay-backdrop') as HTMLElement;
    if (backdrop) backdrop.style.display = 'none';
    const elementBelow = document.elementFromPoint(event.clientX, event.clientY);
    if (backdrop) backdrop.style.display = '';

    this.closeContextMenu();

    if (elementBelow) {
      setTimeout(() => {
        const newEvent = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: event.clientX,
          clientY: event.clientY,
          button: 2
        });
        (newEvent as any)._isSeraRetrigger = true;
        elementBelow.dispatchEvent(newEvent);
      }, 20);
    }
  }

  closeContextMenu() {
    if (this.contextMenuTrigger?.menuOpen) {
      this.contextMenuTrigger.closeMenu();
    }
    this.isContextMenuVisible = false;
    this.cdr.detectChanges();
  }

  onContextMenu(event: MouseEvent, row: any, col: string) {
    if (col === 'actions' || col === this.campoSeleccion || col === 'sera_adjuntos') return;

    event.preventDefault();

    const cellId = `${row['id_' + this.tabla]}-${col}`;
    const hasPlugin = this.hasCellRenderer(col);
    const isPluginBypassed = this.bypassedPluginCells.has(cellId);
    const isPluginRendered = hasPlugin && !isPluginBypassed;

    this.contextMenuTarget = {
      row: row,
      col: col,
      value: row[col],
      isPluginRendered: isPluginRendered,
      hasPlugin: hasPlugin,
      isPluginBypassed: isPluginBypassed
    };

    // 1. Destruir ancla vieja para purgar el caché de coordenadas de Angular CDK Overlay
    this.isContextMenuVisible = false;
    this.cdr.detectChanges();

    // 2. Asignar nuevas coordenadas
    this.contextMenuPosition.x = event.clientX;
    this.contextMenuPosition.y = event.clientY;

    // 3. Recrear ancla con las nuevas coordenadas
    this.isContextMenuVisible = true;
    this.cdr.detectChanges();

    // 4. Abrir menú en el ancla recién recreada
    setTimeout(() => {
      if (this.contextMenuTrigger) {
        this.contextMenuTrigger.openMenu();
      }
    }, 10);
  }

  async copyToClipboard(mode: 'cell' | 'row') {
    if (!this.contextMenuTarget) return;
    
    let textToCopy = '';
    if (mode === 'cell') {
      textToCopy = String(this.contextMenuTarget.value);
    } else {
      textToCopy = JSON.stringify(this.contextMenuTarget.row, null, 2);
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      this.snackBar.open("Copiado al portapapeles", "OK", { duration: 2000 });
    } catch (err) {
      this.snackBar.open("Error al copiar", "OK", { duration: 2000 });
    }
  }

  quickFilter(mode: 'include' | 'exclude') {
    if (!this.contextMenuTarget) return;

    const newFilter: FilterRule = {
      field: this.contextMenuTarget.col,
      operator: mode === 'include' ? 'equals' : 'not_equals',
      value: this.contextMenuTarget.value
    };

    const camposFiltrados = this.allColumns.filter(c => 
      c !== this.campoSeleccion && 
      c !== 'actions' && 
      !c.startsWith('sera_')
    );

    const dialogRef = this.dialog.open(FilterSeraDialog, {
      width: '80%',
      minWidth: '500px',
      data: { 
        campos: camposFiltrados,
        currentFilters: [...this.activeFilters, newFilter]
      }
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (!result) return;
      if (result.action === 'apply') {
        this.activeFilters = result.filters;
        this.applyAdvancedFilters();
        this.snackBar.open(`Aplicados ${this.activeFilters.length} filtro(s)`, 'OK', { duration: 3000 });
      } else if (result.action === 'clear') {
        this.activeFilters = [];
        this.applyAdvancedFilters();
        this.snackBar.open("Filtros eliminados", "OK", { duration: 3000 });
      }
      this.cdr.detectChanges(); 
    });
  }

  async addQuickVisualRule(colorHex: string, textColor: string) {
    if (!this.contextMenuTarget) return;

    const newRule: TableRule = {
      type: 'simple',
      field: this.contextMenuTarget.col,
      operator: 'equals',
      value: String(this.contextMenuTarget.value),
      backgroundColor: colorHex,
      textColor: textColor,
      applyTo: 'row'
    };

    try {
      let configJsonStr: any = null;
      try {
        configJsonStr = await invoke('get_tabla_config', { nombreTabla: this.tabla });
      } catch (e) {
        console.warn("Tabla sin config previa, creando nueva.");
      }
      
      let config: any = { rules: [], calculatedFields: [], linkedFields: [] };
      if (configJsonStr) {
        config = typeof configJsonStr === 'string' ? JSON.parse(configJsonStr) : configJsonStr;
      }
      
      if (!config.rules) config.rules = [];
      config.rules.push(newRule);

      await invoke('update_tabla_config', { nombreTabla: this.tabla, configJson: JSON.stringify(config) });
      
      // Actualizar datos locales y forzar renderizado
      this.tableRules = config.rules;
      this.loadRulesAndCalculate();
      this.snackBar.open("Regla visual rápida guardada", "OK", { duration: 3000 });
      this.cdr.detectChanges();
    } catch (e) {
      console.error(e);
      this.snackBar.open("Error al guardar regla visual", "OK", { duration: 3000 });
    }
  }

  bypassPluginRender() {
    if (!this.contextMenuTarget) return;
    const { row, col } = this.contextMenuTarget;
    const cellId = `${row['id_' + this.tabla]}-${col}`;
    this.bypassedPluginCells.add(cellId);
  }

  restorePluginRender() {
    if (!this.contextMenuTarget) return;
    const { row, col } = this.contextMenuTarget;
    const cellId = `${row['id_' + this.tabla]}-${col}`;
    this.bypassedPluginCells.delete(cellId);
  }

  quickExport(mode: 'row' | 'selected') {
    if (!this.contextMenuTarget) return;
    const dataToExport = mode === 'row' ? [this.contextMenuTarget.row] : this.selection.selected;
    this.printPdf.emit(dataToExport);
  }

  async addQuickIconRule(iconName: string, iconColor: string) {
    if (!this.contextMenuTarget) return;

    const { col, value } = this.contextMenuTarget;

    const newRule: TableRule = {
      type: 'simple',
      field: col,
      operator: 'equals',
      value: String(value),
      backgroundColor: '',
      textColor: iconColor,
      icon: iconName,
      applyTo: 'cell',
    };

    try {
      let configJsonStr: any = null;
      try {
        configJsonStr = await invoke('get_tabla_config', { nombreTabla: this.tabla });
      } catch (e) {
        console.warn("Tabla sin config previa, creando nueva.");
      }
      
      let config: any = { rules: [], calculatedFields: [], linkedFields: [] };
      if (configJsonStr) {
        config = typeof configJsonStr === 'string' ? JSON.parse(configJsonStr) : configJsonStr;
      }
      
      if (!config.rules) config.rules = [];
      config.rules.push(newRule);

      await invoke('update_tabla_config', { nombreTabla: this.tabla, configJson: JSON.stringify(config) });
      
      this.tableRules = config.rules;
      this.loadRulesAndCalculate();
      this.snackBar.open("Regla de ícono guardada", "OK", { duration: 3000 });
      this.cdr.detectChanges();
    } catch (e) {
      console.error(e);
      this.snackBar.open("Error al guardar regla de ícono", "OK", { duration: 3000 });
    }
  }

  getCellIcon(row: any, col: string): { icon: string, color: string } | null {
    if (!this.tableRules) return null;

    for (const rule of this.tableRules) {
      if (!rule.icon || rule.applyTo !== 'cell' || rule.field !== col) continue;

      let conditionMet = false;
      const cellValue = row[rule.field];

      if (rule.type === 'simple') {
        const val1 = String(cellValue).toLowerCase();
        const val2 = rule.value.toLowerCase();
        switch (rule.operator) {
          case 'equals': conditionMet = val1 === val2; break;
          case 'not_equals': conditionMet = val1 !== val2; break;
          case 'contains': conditionMet = val1.includes(val2); break;
        }
      }

      if (conditionMet) {
        return { icon: rule.icon, color: rule.textColor };
      }
    }
    return null;
  }
}

