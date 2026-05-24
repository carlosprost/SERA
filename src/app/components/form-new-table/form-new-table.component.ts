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
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { invoke } from "@tauri-apps/api/core";
import { ChangeDetectorRef } from '@angular/core';

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
    { value: 'DATE', viewValue: 'Fecha' },
    { value: 'TIME', viewValue: 'Hora' },
    { value: 'TIMESTAMP', viewValue: 'Fecha y Hora' },
    { value: 'BOOLEAN', viewValue: 'Booleano (Sí/No)' },
    { value: 'LINK', viewValue: 'Vínculo (Relacional)' }
  ];

  tablasDisponibles: any[] = [];
  camposRemotos: { [key: string]: string[] } = {};
  configActual: any = { rules: [], calculatedFields: [], linkedFields: [] };

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    @Optional() public dialogRef: MatDialogRef<FormNewTableComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.newTableForm = this.fb.group({
      tableName: [this.data?.tableName || "", Validators.required],
      allowAttachments: [true], // Por defecto activado para nuevas tablas
      fields: this.fb.array([])
    });

    this.cargarDatosIniciales();
  }

  async cargarDatosIniciales() {
    try {
      const todasLasTablas: any[] = await invoke('get_tablas');
      // Filtramos para que no aparezca la tabla actual en la lista de vínculos
      this.tablasDisponibles = todasLasTablas.filter(t => t.nombre_tabla.toLowerCase() !== this.data?.tableName?.toLowerCase());
      
      if (this.data?.isEdit) {
        const configJson: string = await invoke('get_tabla_config', { nombreTabla: this.data.tableName });
        this.configActual = JSON.parse(configJson || '{}');
        // Actualizamos el checkbox según la config guardada (si no existe, asumimos true para compatibilidad)
        this.newTableForm.patchValue({
          allowAttachments: this.configActual.allowAttachments !== false
        });
      }

      if (this.data?.isEdit && this.data?.fields) {
        this.data.fields
          .filter((f: any) => f.Key !== 'PRI')
          .forEach((f: any) => {
            const link = this.configActual.linkedFields?.find((lf: any) => lf.localField === f.Field);
            this.fields.push(this.createFieldGroup(f, link));
          });
      } else {
        this.fields.push(this.createFieldGroup());
      }
    } catch (e) {
      console.error("Error inicializando formulario", e);
    }
  }

  get fields(): FormArray {
    return this.newTableForm.get('fields') as FormArray;
  }

  createFieldGroup(fieldData?: any, linkData?: any): FormGroup {
    const type = linkData ? 'LINK' : (fieldData?.Type || "VARCHAR(255)");
    const group = this.fb.group({
      name: [fieldData?.Field || "", Validators.required],
      type: [type, Validators.required],
      notNull: [fieldData?.Null === 'NO'],
      defaultValue: [fieldData?.Default || ""],
      oldName: [fieldData?.Field || null],
      // Metadatos de vínculo
      remoteTable: [linkData?.remoteTable || ""],
      remoteField: [linkData?.remoteField || ""],
      displayField: [linkData?.displayField || ""]
    });

    if (linkData?.remoteTable) {
      this.onRemoteTableChange(linkData.remoteTable);
    }

    return group;
  }

  async onRemoteTableChange(nombreTabla: string) {
    if (!nombreTabla) return;
    
    // Normalizamos a minúsculas por seguridad con SQLite
    const tablaNormalized = nombreTabla.toLowerCase();
    
    try {
      console.log(`[SERA] Buscando campos para: ${tablaNormalized}`);
      const camposRes: any[] = await invoke('get_campos', { tabla: tablaNormalized });
      
      // Actualizamos el objeto creando una nueva referencia para disparar la detección de cambios
      this.camposRemotos = {
        ...this.camposRemotos,
        [nombreTabla]: camposRes.map(c => c.Field)
      };
      
      this.cdr.detectChanges();
      console.log(`[SERA] Campos encontrados:`, this.camposRemotos[nombreTabla]);
    } catch (e) {
      console.error("Error al cargar campos remotos", e);
    }
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
    const from = event.previousIndex;
    const to = event.currentIndex;
    
    const fieldsArray = this.fields.value;
    const item = fieldsArray.splice(from, 1)[0];
    fieldsArray.splice(to, 0, item);
    
    // Reconstruir el FormArray para que coincida con el nuevo orden
    this.fields.clear();
    fieldsArray.forEach((f: any) => {
      // Re-creamos el grupo con los valores actuales
      const group = this.fb.group({
        name: [f.name, Validators.required],
        type: [f.type, Validators.required],
        notNull: [f.notNull],
        defaultValue: [f.defaultValue],
        oldName: [f.oldName],
        remoteTable: [f.remoteTable],
        remoteField: [f.remoteField],
        displayField: [f.displayField]
      });
      this.fields.push(group);
    });
  }

  dialogClose() {
    this.dialogRef.close();
  }

  onSubmit() {
    if (this.newTableForm.invalid) return;

    const formVal = this.newTableForm.value;
    const nombreTabla = formVal.tableName.trim().split(" ").join("_").toLowerCase();
    
    let cuerpoSQL = "";
    const fieldsList = formVal.fields;
    const mapeo: any[] = [];
    const newLinkedFields: any[] = [];

    fieldsList.forEach((field: any, index: number) => {
      let fName = field.name.trim().split(" ").join("_").toLowerCase();
      let fType = field.type;

      if (fType === 'LINK') {
        fType = 'INTEGER';
        if (field.remoteTable && field.displayField) {
          newLinkedFields.push({
            localField: fName,
            remoteTable: field.remoteTable,
            remoteField: `id_${field.remoteTable.toLowerCase()}`, // El ID es automático
            displayField: field.displayField
          });
        }
      }
      
      let fNull = field.notNull ? "NOT NULL" : "";
      
      let fDefault = "";
      if (field.defaultValue && field.defaultValue.trim() !== '') {
          if (fType.includes('TEXT') || fType.includes('VARCHAR') || fType.includes('TIMESTAMP') || fType.includes('DATE') || fType.includes('TIME')) {
             fDefault = `DEFAULT '${field.defaultValue.trim()}'`;
          } else {
             fDefault = `DEFAULT ${field.defaultValue.trim()}`;
          }
      }

      const sqlParts = [`"${fName}"`, fType, fNull, fDefault].filter(p => p.trim() !== "").join(" ");
      cuerpoSQL += sqlParts + (index === fieldsList.length - 1 ? "" : ", ");

      if (this.data?.isEdit && field.oldName) {
        mapeo.push({ old_name: field.oldName, new_name: fName });
      }
    });

    const finalConfig = {
      ...this.configActual,
      linkedFields: newLinkedFields,
      allowAttachments: formVal.allowAttachments
    };
    const configJson = JSON.stringify(finalConfig);

    if (this.data?.isEdit) {
      this.store.dispatch(StoreActions.loadRestructureTable({
         info: {
           nombre_viejo: this.data.tableName,
           nombre_nuevo: nombreTabla,
           campos_schema: cuerpoSQL,
           mapeo: mapeo,
           config: configJson
         }
      }));
    } else {
      let nuevaTabla: NuevaTabla = {
        nombre: nombreTabla,
        campos: cuerpoSQL,
        config: configJson
      };
      this.store.dispatch(StoreActions.loadNewTable({ tabla: nuevaTabla }));
    }
    
    this.dialogRef.close({ reload: true });
  }
}
