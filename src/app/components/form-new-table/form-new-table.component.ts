import { Component, Inject, Optional } from "@angular/core";
import { MaterialModule } from "../../shared/material.module";
import {
  FormBuilder,
  FormGroup,
  FormArray,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { Store } from "@ngrx/store";
import { NuevaTabla } from "../../interfaces/tablas.interfaces";
import { StoreActions } from "../../store/store.actions";
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';

@Component({
  selector: "app-form-new-table",
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule, CommonModule, DragDropModule],
  templateUrl: "./form-new-table.component.html",
  styleUrl: "./form-new-table.component.scss",
})
export class FormNewTableComponent {
  newTableForm: FormGroup;
  
  dataTypes = [
    { value: 'VARCHAR(255)', viewValue: 'Texto Corto' },
    { value: 'TEXT', viewValue: 'Texto Largo / Párrafo' },
    { value: 'INTEGER', viewValue: 'Número Entero' },
    { value: 'REAL', viewValue: 'Número Decimal' },
    { value: 'TIMESTAMP', viewValue: 'Fecha y Hora' },
    { value: 'BOOLEAN', viewValue: 'Booleano (Sí/No)' }
  ];

  constructor(
    private store: Store,
    private fb: FormBuilder,
    @Optional() public dialogRef: MatDialogRef<FormNewTableComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.newTableForm = this.fb.group({
      tableName: [this.data?.tableName || "", Validators.required],
      fields: this.fb.array([])
    });

    if (this.data?.isEdit && this.data?.fields) {
      // Filtramos la llave primaria (ID) ya que el backend la agrega automáticamente
      this.data.fields
        .filter((f: any) => f.Key !== 'PRI')
        .forEach((f: any) => {
          this.fields.push(this.createFieldGroup(f));
        });
    } else {
      this.fields.push(this.createFieldGroup());
    }
  }

  get fields(): FormArray {
    return this.newTableForm.get('fields') as FormArray;
  }

  createFieldGroup(fieldData?: any): FormGroup {
    return this.fb.group({
      name: [fieldData?.Field || "", Validators.required],
      type: [fieldData?.Type || "VARCHAR(255)", Validators.required],
      notNull: [fieldData?.Null === 'NO'],
      defaultValue: [fieldData?.Default || ""],
      oldName: [fieldData?.Field || null] // Para rastrear el mapeo en reestructuración
    });
  }

  agregarCampo() {
    this.fields.push(this.createFieldGroup());
  }

  removeField(index: number) {
    if (this.fields.length > 1) {
      this.fields.removeAt(index);
    }
  }

  drop(event: CdkDragDrop<any[]>) {
    // Reordenar los elementos en el FormArray
    const dir = event.currentIndex > event.previousIndex ? 1 : -1;
    const from = event.previousIndex;
    const to = event.currentIndex;

    const temp = this.fields.at(from);
    for (let i = from; i * dir < to * dir; i = i + dir) {
      const current = this.fields.at(i + dir);
      this.fields.setControl(i, current);
    }
    this.fields.setControl(to, temp);
  }

  dialogClose() {
    this.dialogRef.close();
  }

  onSubmit() {
    if (this.newTableForm.invalid) return;

    const formVal = this.newTableForm.value;
    const nombreTabla = formVal.tableName.trim().split(" ").join("_").toLowerCase();
    
    let cuerpoSQL = "";
    
    // El id se genera automáticamente en el backend (id_{nombre_tabla} INTEGER PRIMARY KEY AUTOINCREMENT)
    const fieldsList = formVal.fields;
    const mapeo: any[] = [];

    fieldsList.forEach((field: any, index: number) => {
      let fName = field.name.trim().split(" ").join("_").toLowerCase();
      let fType = field.type;
      let fNull = field.notNull ? "NOT NULL" : "";
      
      let fDefault = "";
      if (field.defaultValue && field.defaultValue.trim() !== '') {
          if (fType.includes('TEXT') || fType.includes('VARCHAR') || fType.includes('TIMESTAMP')) {
             fDefault = `DEFAULT '${field.defaultValue.trim()}'`;
          } else {
             fDefault = `DEFAULT ${field.defaultValue.trim()}`;
          }
      }

      // Concatenar omitiendo espacios extras
      const sqlParts = [fName, fType, fNull, fDefault].filter(p => p.trim() !== "").join(" ");
      cuerpoSQL += sqlParts + (index === fieldsList.length - 1 ? "" : ", ");

      // Si tiene oldName y está en modo edición, lo agregamos al mapeo para la migración
      if (this.data?.isEdit && field.oldName) {
        mapeo.push({ old_name: field.oldName, new_name: fName });
      }
    });

    if (this.data?.isEdit) {
      this.store.dispatch(StoreActions.loadRestructureTable({
         info: {
           nombre_viejo: this.data.tableName,
           nombre_nuevo: nombreTabla,
           campos_schema: cuerpoSQL,
           mapeo: mapeo
         }
      }));
    } else {
      let nuevaTabla: NuevaTabla = {
        nombre: nombreTabla,
        campos: cuerpoSQL,
      };
      this.store.dispatch(StoreActions.loadNewTable({ tabla: nuevaTabla }));
    }
    
    this.dialogRef.close({ reload: true });
  }
}
