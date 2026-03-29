import { Component, Inject, inject } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
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

  formularioRecibo!: FormGroup;
  
  /** Lista de configuración de columnas: nombre y si está seleccionada. */
  camposConfig: { nombre: string, seleccionado: boolean }[] = [];

  constructor(
    public dialogRef: MatDialogRef<ReciboComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { message: string, campos: string[] }
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

  save() {
    // Retornamos el formulario + la lista de columnas seleccionadas en el orden actual.
    const result = {
      ...this.formularioRecibo.value,
      columnas: this.camposConfig
        .filter(c => c.seleccionado)
        .map(c => c.nombre)
    };
    this.dialogRef.close(result);
  }
}
