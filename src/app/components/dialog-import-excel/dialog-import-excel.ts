import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SeraButtonComponent } from '../../shared/components/ui/sera-button/sera-button.component';
import { invoke } from '@tauri-apps/api/core';

export interface CampoMapeado {
  index: number;
  originalName: string;
  cleanName: string;
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'DATE';
  selected: boolean;
}

export interface FilaEncabezadoOpcion {
  rowNumber: number; // 1-based, 0 = Sin encabezados
  label: string;
  preview: string;
}

export interface FilaDatosConIndice {
  originalRowNumber: number; // 1-based
  cells: any[];
}

@Component({
  selector: 'app-dialog-import-excel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTooltipModule,
    SeraButtonComponent
  ],
  templateUrl: './dialog-import-excel.html',
  styleUrl: './dialog-import-excel.scss',
})
export class DialogImportExcel implements OnInit {
  mode: 'new' | 'existing' = 'new';
  tableName: string = '';
  
  // Hojas de cálculo
  sheetNames: string[] = [];
  selectedSheet: string = '';
  
  // Filas en crudo de la hoja actual
  rawSheetRows: any[][] = [];
  
  // Opciones de filas de encabezado
  headerOptions: FilaEncabezadoOpcion[] = [];
  selectedHeaderRow: number = 1; // 1-based (Fila 1), 0 = Sin encabezados
  
  // Campos mapeados estilo QGIS
  campos: CampoMapeado[] = [];
  
  // Filas de datos computadas con su número de fila original
  dataRows: FilaDatosConIndice[] = [];
  
  // Previsualización de datos procesados (primeras filas)
  previewRows: any[] = [];
  
  cargando: boolean = false;

  tiposDisponibles = [
    { value: 'TEXT', viewValue: 'Texto' },
    { value: 'INTEGER', viewValue: 'Número Entero' },
    { value: 'REAL', viewValue: 'Número Decimal' },
    { value: 'DATE', viewValue: 'Fecha (YYYY-MM-DD)' }
  ];

  constructor(
    public dialogRef: MatDialogRef<DialogImportExcel>,
    @Inject(MAT_DIALOG_DATA) public data: {
      sheetsData?: { [sheetName: string]: any[][] };
      sheetNames?: string[];
      fileName: string;
      activeTable: string | null;
      json?: any[];
    },
    private snackBar: MatSnackBar
  ) {
    // Sugerir nombre de tabla limpio basado en el archivo
    this.tableName = this.sanitizeTableName(this.data.fileName);
    if (this.data.activeTable) {
      this.mode = 'existing';
    }
  }

  ngOnInit() {
    if (this.data.sheetsData && this.data.sheetNames && this.data.sheetNames.length > 0) {
      this.sheetNames = this.data.sheetNames;
      this.selectedSheet = this.sheetNames[0];
      this.cargarHoja(this.selectedSheet);
    } else if (this.data.json && this.data.json.length > 0) {
      // Compatibilidad con objeto JSON heredado
      const keys = Object.keys(this.data.json[0]);
      const rows: any[][] = [keys];
      this.data.json.forEach(item => {
        rows.push(keys.map(k => item[k] ?? ''));
      });
      this.rawSheetRows = rows;
      this.reconstruirOpcionesDeCabecera();
      this.procesarCampos();
    }
  }

  onSheetChange() {
    this.cargarHoja(this.selectedSheet);
  }

  cargarHoja(sheetName: string) {
    if (!this.data.sheetsData || !this.data.sheetsData[sheetName]) return;
    this.rawSheetRows = this.data.sheetsData[sheetName] || [];
    this.reconstruirOpcionesDeCabecera();
    this.procesarCampos();
  }

  /**
   * Reconstruye las opciones del selector de cabeceras escaneando las primeras 12 filas.
   * Aplica heurística inteligente para preseleccionar la fila con mayores etiquetas textuales válidas.
   */
  reconstruirOpcionesDeCabecera() {
    this.headerOptions = [];
    const maxScan = Math.min(this.rawSheetRows.length, 12);
    
    let bestRow = 1;
    let bestScore = -1;

    for (let r = 0; r < maxScan; r++) {
      const row = this.rawSheetRows[r] || [];
      const nonEmpties = row.filter(c => c !== undefined && c !== null && String(c).trim() !== '');
      const previewText = nonEmpties.slice(0, 5).map(c => String(c).trim()).join(' | ');

      // Ponderación de cabecera: cantidad de textos descriptivos no numéricos
      let textHeadersCount = 0;
      row.forEach(cell => {
        if (cell !== undefined && cell !== null) {
          const str = String(cell).trim();
          if (str.length > 0) {
            const esNumero = /^-?\d+(\.\d+)?$/.test(str);
            const esFecha = /^\d{4}-\d{2}-\d{2}/.test(str);
            const esPrefijoMetadata = str.toLowerCase().startsWith('desde:') || str.toLowerCase().startsWith('hasta:');
            if (!esNumero && !esFecha && !esPrefijoMetadata) {
              textHeadersCount++;
            }
          }
        }
      });

      // El score premia fuertemente filas con múltiples columnas de texto
      const score = (textHeadersCount * 10) + nonEmpties.length;
      if (score > bestScore && textHeadersCount >= 2) {
        bestScore = score;
        bestRow = r + 1; // 1-based
      }

      this.headerOptions.push({
        rowNumber: r + 1,
        label: `Fila ${r + 1}`,
        preview: previewText.length > 60 ? previewText.substring(0, 57) + '...' : (previewText || '(Vacía)')
      });
    }

    this.headerOptions.push({
      rowNumber: 0,
      label: 'Sin encabezados',
      preview: 'Generar columnas automáticas (columna_1, columna_2...)'
    });

    // Anotamos la recomendada en la etiqueta de la opción
    if (bestScore > 0 && bestRow > 0) {
      const opt = this.headerOptions.find(o => o.rowNumber === bestRow);
      if (opt) {
        opt.label += ' ★ Recomendada';
      }
      this.selectedHeaderRow = bestRow;
    } else {
      this.selectedHeaderRow = 1;
    }
  }

  onHeaderRowChange() {
    this.procesarCampos();
  }

  /**
   * Permite hacer clic directo en cualquier fila de la previsualización para usarla como encabezado.
   */
  seleccionarFilaComoEncabezado(rowNumber: number) {
    if (!rowNumber || rowNumber === this.selectedHeaderRow) return;
    this.selectedHeaderRow = rowNumber;
    this.procesarCampos();
    this.snackBar.open(`Encabezados configurados según la Fila ${rowNumber}`, "Listo", { duration: 3000 });
  }

  procesarCampos() {
    if (!this.rawSheetRows || this.rawSheetRows.length === 0) {
      this.campos = [];
      this.dataRows = [];
      this.previewRows = [];
      return;
    }

    // Determinar ancho máximo de columnas en las primeras 40 filas
    let maxCols = 0;
    const scanLimit = Math.min(this.rawSheetRows.length, 40);
    for (let i = 0; i < scanLimit; i++) {
      if (this.rawSheetRows[i] && this.rawSheetRows[i].length > maxCols) {
        maxCols = this.rawSheetRows[i].length;
      }
    }

    const nuevosCampos: CampoMapeado[] = [];
    const nombresUsados = new Set<string>();

    let headerRowValues: any[] = [];
    let startDataRowIndex = 0;

    if (this.selectedHeaderRow > 0) {
      const headerIndex = this.selectedHeaderRow - 1;
      headerRowValues = this.rawSheetRows[headerIndex] || [];
      startDataRowIndex = this.selectedHeaderRow;
    } else {
      // Sin encabezados
      startDataRowIndex = 0;
    }

    // Filtrar filas de datos conservando su número de fila original en el archivo
    this.dataRows = [];
    for (let r = startDataRowIndex; r < this.rawSheetRows.length; r++) {
      const row = this.rawSheetRows[r];
      if (row && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')) {
        this.dataRows.push({
          originalRowNumber: r + 1,
          cells: row
        });
      }
    }

    for (let colIdx = 0; colIdx < maxCols; colIdx++) {
      let origName = '';
      if (this.selectedHeaderRow > 0 && headerRowValues[colIdx] !== undefined && String(headerRowValues[colIdx]).trim() !== '') {
        origName = String(headerRowValues[colIdx]).trim();
      } else {
        origName = `columna_${colIdx + 1}`;
      }

      // Nombre limpio para SQLite
      let clean = this.sanitizeColumnName(origName) || `columna_${colIdx + 1}`;
      let uniqueName = clean;
      let counter = 2;
      while (nombresUsados.has(uniqueName.toLowerCase())) {
        uniqueName = `${clean}_${counter}`;
        counter++;
      }
      nombresUsados.add(uniqueName.toLowerCase());

      // Inferir tipo de dato a partir de las filas de datos
      const tipoInferido = this.inferirTipoColumna(colIdx);

      // Decidir si viene seleccionada: solo si tiene al menos un valor en los datos
      const tieneDatos = this.dataRows.slice(0, 50).some(dr => dr.cells[colIdx] !== undefined && String(dr.cells[colIdx]).trim() !== '');

      nuevosCampos.push({
        index: colIdx,
        originalName: origName,
        cleanName: uniqueName,
        type: tipoInferido,
        selected: tieneDatos
      });
    }

    this.campos = nuevosCampos;
    this.actualizarPreview();
  }

  inferirTipoColumna(colIdx: number): 'TEXT' | 'INTEGER' | 'REAL' | 'DATE' {
    const sample = this.dataRows
      .slice(0, 30)
      .map(dr => dr.cells[colIdx])
      .filter(v => v !== undefined && v !== null && String(v).trim() !== '');

    if (sample.length === 0) return 'TEXT';

    const esFecha = sample.every(v => /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()));
    if (esFecha) return 'DATE';

    const esEntero = sample.every(v => /^-?\d+$/.test(String(v).trim()));
    if (esEntero) return 'INTEGER';

    const esDecimal = sample.every(v => /^-?\d+(\.\d+)?$/.test(String(v).trim()));
    if (esDecimal) return 'REAL';

    return 'TEXT';
  }

  toggleTodos(marcar: boolean) {
    this.campos.forEach(c => c.selected = marcar);
    this.actualizarPreview();
  }

  onCampoChange() {
    this.actualizarPreview();
  }

  actualizarPreview() {
    const camposActivos = this.campos.filter(c => c.selected);
    this.previewRows = this.dataRows.slice(0, 8).map(dr => {
      const rowObj: any = {
        _originalRowNumber: dr.originalRowNumber
      };
      camposActivos.forEach(c => {
        const val = dr.cells[c.index];
        rowObj[c.cleanName] = val !== undefined && val !== null ? val : '';
      });
      return rowObj;
    });
  }

  get camposSeleccionados(): CampoMapeado[] {
    return this.campos.filter(c => c.selected);
  }

  sanitizeTableName(rawName: string): string {
    return (rawName || 'tabla_importada')
      .replace(/\.[^/.]+$/, '')
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
  }

  sanitizeColumnName(name: string): string {
    return (name || '')
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
  }

  async onConfirm() {
    const camposAImportar = this.camposSeleccionados;
    if (camposAImportar.length === 0) {
      this.snackBar.open("Tenés que seleccionar al menos una columna para importar", "Cerrar", { duration: 3500 });
      return;
    }

    if (this.mode === 'new' && !this.tableName.trim()) {
      this.snackBar.open("Ingresá un nombre para la nueva tabla", "Cerrar", { duration: 3000 });
      return;
    }

    this.cargando = true;
    const targetTable = this.mode === 'new' ? this.sanitizeTableName(this.tableName) : (this.data.activeTable || '');

    try {
      if (this.mode === 'new') {
        // Crear tabla con los tipos elegidos
        const camposSql = camposAImportar.map(c => `"${c.cleanName}" ${c.type}`).join(', ');
        await invoke('crear_tabla', { tabla: { nombre: targetTable, campos: camposSql } });
      }

      // Preparar filas para bulk insert
      const bulkData = {
        tabla: targetTable,
        campos: camposAImportar.map(c => c.cleanName),
        contenido: this.dataRows.map(dr => 
          camposAImportar.map(c => dr.cells[c.index] !== undefined && dr.cells[c.index] !== null ? String(dr.cells[c.index]).trim() : '')
        )
      };

      await invoke('importar_bulk', { bulk: bulkData });

      this.dialogRef.close({ success: true, tableName: targetTable });
    } catch (error) {
      console.error("[SERA] Error al importar:", error);
      this.snackBar.open("Error al importar datos: " + error, "Cerrar", { duration: 5000 });
    } finally {
      this.cargando = false;
    }
  }
}
