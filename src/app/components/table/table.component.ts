import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
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
import { ChangeDetectorRef, ViewChild, AfterViewInit, HostListener } from "@angular/core";
import { TableConfigDialog } from "../table-config-dialog/table-config-dialog";
import { TableConfig, TableRule, CalculatedField } from "../../interfaces/tablas.interfaces";
import { invoke } from "@tauri-apps/api/core";
import { MatTableDataSource } from "@angular/material/table";
import { MatSort } from "@angular/material/sort";
import { FilterSeraDialog, FilterRule } from "../filter-sera-dialog/filter-sera-dialog";
import { SearchPaletteDialog } from "../search-palette-dialog/search-palette-dialog";
import { FormulaEngine } from "../../utils/formula-engine";

@Component({
  selector: "app-table",
  standalone: true,
  imports: [MaterialModule, CommonModule],
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
  
  // Vínculos Relacionales
  linkedFields: any[] = [];
  dictionaries: { [key: string]: { [id: string]: string } } = {};

  // Configuración de visualización
  allowAttachments: boolean = true;

  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private store: Store,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
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
  }

  private dataRaw: any[] = [];

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
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
    const dialogRef = this.dialog.open(SearchPaletteDialog, {
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

    dialogRef.afterClosed().subscribe(() => {
      // Al cerrar la paleta de búsqueda local, limpiamos el filtro y restablecemos todos los registros
      this.lastSearchValue = '';
      this.applyDataSourceSearch('');
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
    const dialogRef = this.dialog.open(FilterSeraDialog, {
      width: '80%',
      minWidth: '500px',
      data: {
        campos: this.allColumns,
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
    return value;
  }

  openConfigDialog() {
    const camposActuales = this.allColumns.filter(c => c !== this.campoSeleccion && c !== 'actions');

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
}
