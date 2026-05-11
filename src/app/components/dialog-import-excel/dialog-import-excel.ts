import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { invoke } from '@tauri-apps/api/core';

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
    MatInputModule
  ],
  templateUrl: './dialog-import-excel.html',
  styleUrl: './dialog-import-excel.scss',
})
export class DialogImportExcel {
  mode: 'new' | 'existing' = 'new';
  tableName: string = '';
  previewRows: any[] = [];
  headers: string[] = [];

  constructor(
    public dialogRef: MatDialogRef<DialogImportExcel>,
    @Inject(MAT_DIALOG_DATA) public data: { json: any[], fileName: string, activeTable: string | null },
    private snackBar: MatSnackBar
  ) {
    if (data.json && data.json.length > 0) {
      this.headers = Object.keys(data.json[0]);
      this.previewRows = data.json.slice(0, 5);
    }
    
    // Sugerir nombre de tabla basado en el archivo, quitando extensión y espacios
    this.tableName = data.fileName.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_");
    
    if (data.activeTable) {
      this.mode = 'existing';
    }
  }

  async onConfirm() {
    if (this.mode === 'new' && !this.tableName) {
      this.snackBar.open("Debes ingresar un nombre para la tabla", "Cerrar", { duration: 3000 });
      return;
    }

    try {
      if (this.mode === 'new') {
        // 1. Crear la tabla
        // Inferimos campos como TEXT
        const camposSql = this.headers.map(h => `${h} TEXT`).join(", ");
        await invoke('crear_tabla', { tabla: { nombre: this.tableName, campos: camposSql } });
      }

      // 2. Preparar datos para bulk insert
      const targetTable = this.mode === 'new' ? this.tableName : this.data.activeTable;
      
      const bulkData = {
        tabla: targetTable,
        campos: this.headers,
        contenido: this.data.json.map(row => 
          this.headers.map(h => row[h] !== undefined && row[h] !== null ? row[h].toString() : "")
        )
      };

      // 3. Ejecutar bulk insert
      await invoke('importar_bulk', { registro: bulkData });

      this.dialogRef.close({ success: true, tableName: targetTable });
    } catch (error) {
      console.error("Error al importar:", error);
      this.snackBar.open("Error al importar datos: " + error, "Cerrar", { duration: 5000 });
    }
  }
}
