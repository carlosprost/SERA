import { Component, Inject, inject, signal } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { PdfService } from "../../services/pdf.service";
import { MatButtonModule } from "@angular/material/button";
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";

import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatTabsModule } from "@angular/material/tabs";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatIconModule } from "@angular/material/icon";
import { MatListModule } from "@angular/material/list";
import { CdkDragDrop, DragDropModule, moveItemInArray } from "@angular/cdk/drag-drop";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-recibo",
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    ReactiveFormsModule,
    FormsModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatCheckboxModule,
    MatIconModule,
    MatListModule,
    DragDropModule
  ],
  templateUrl: "./recibo.component.html",
  styleUrl: "./recibo.component.scss",
})
export class ReciboComponent {
  fb = inject(FormBuilder);
  pdfService = inject(PdfService);
  snackBar = inject(MatSnackBar);

  formularioRecibo!: FormGroup;
  
  /** Señal reactiva para indicar si se está generando el reporte. */
  generando = signal(false);

  /** Lista de configuración de columnas: nombre y si está seleccionada. */
  camposConfig: { nombre: string, seleccionado: boolean }[] = [];

  constructor(
    public dialogRef: MatDialogRef<ReciboComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { message: string, campos: string[], datos: any[] }
  ) {
    this.createForm();
    this.initCampos();
  }

  initCampos() {
    if (this.data.campos) {
      this.camposConfig = this.data.campos.map(c => ({ nombre: c, seleccionado: true }));
    }
  }

  createForm(){
    this.formularioRecibo = this.fb.group({
      titulo: [''],
      descripcion: [''],
      descripcion_post: [''],
      incluir_firma: [false],
      firma_texto: ['']
    })
  }

  /** Maneja el reordenamiento de los campos mediante Drag & Drop. */
  drop(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.camposConfig, event.previousIndex, event.currentIndex);
  }

  async save() {
    // Retornamos el formulario + la lista de columnas seleccionadas en el orden actual.
    const result = {
      ...this.formularioRecibo.value,
      columnas: this.camposConfig
        .filter(c => c.seleccionado)
        .map(c => c.nombre)
    };

    this.generando.set(true);

    try {
      await this.pdfService.generarPdf(
        null,
        result,
        this.data.datos
      );
      this.snackBar.open("Documento PDF generado correctamente", "", { duration: 3000 });
      this.dialogRef.close(result);
    } catch (error) {
      console.error("[SERA] Error generando reporte PDF:", error);
      this.snackBar.open("Error al generar el documento PDF", "Cerrar", { duration: 5000 });
    } finally {
      this.generando.set(false);
    }
  }
}
