import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Optional, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MaterialModule } from '../../shared/material.module';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NewRecord } from '../../interfaces/registros.interfaces';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { Campos } from '../../interfaces/campos.interfaces';
import { FormFields } from '../../interfaces/form.interfaces';
import { StoreActions } from '../../store/store.actions';
import { selectCampos } from '../../store/store.selectors';
import { provideNativeDateAdapter } from '@angular/material/core';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-formulario-registro',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, DatePipe],
  templateUrl: './formulario-registro.component.html',
  styleUrl: './formulario-registro.component.scss',
  providers: [provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioRegistroComponent implements OnInit {
  isUpload: boolean = false;
  newRegister: FormGroup;
  TableName: string = '';
  campos!: Observable<Campos[]>;
  formFields: FormFields[] = [];
  formControlFields: { [key: string]: any } = {};
  id: string;
  adjuntos: any[] = [];
  tempAdjuntos: { nombre: string, ruta: string, fecha: Date }[] = [];
  
  // Vínculos Relacionales
  linkedFields: any[] = [];
  optionsMap: { [key: string]: any[] } = {};
  allowAttachments: boolean = true;

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar,
    @Optional() public dialogRef: MatDialogRef<FormularioRegistroComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.newRegister = this.fb.group({});
    this.TableName = data.tabla.toLowerCase();
    this.id = data.id;
    this.isUpload = data.upload;
    this.campos = this.store.select(selectCampos);
  }

  ngOnInit() {
    this.cargarConfiguracionYVínculos().then(() => {
      this.campos.subscribe({
        next: (campos) => {
          const temporalFields: FormFields[] = [];
          this.formControlFields = {};
          const contenidoTabla = this.data.contenido;

          campos.forEach((campo) => {
            if (campo.Field.toLowerCase() !== `id_${this.TableName}`) {
              let field: FormFields = {
                field: campo.Field,
                label: campo.Field,
                type: campo.Type,
                value: contenidoTabla !== undefined
                    ? this.cargarContenido(contenidoTabla, campo.Field)
                    : '',
              };
              temporalFields.push(field);
            }
          });
          
          this.formFields = temporalFields;
          this.crearCampos();
          
          if (this.isUpload) {
            this.cargarAdjuntos();
          }
          this.cdr.markForCheck();
        },
      });
    });
  }

  async cargarConfiguracionYVínculos() {
    try {
      const configJson: string = await invoke('get_tabla_config', { nombreTabla: this.TableName });
      const config = JSON.parse(configJson || '{}');
      this.linkedFields = config.linkedFields || [];
      this.allowAttachments = config.allowAttachments !== false;

      for (const link of this.linkedFields) {
        try {
          const res: any[] = await invoke('get_contenido', { tabla: link.remoteTable });
          // El backend devuelve el array directamente, no dentro de .data
          this.optionsMap[link.localField] = res.map((row: any) => ({
            value: row[link.remoteField],
            label: row[link.displayField]
          }));
        } catch (e) {
          console.error(`Error al cargar opciones para vínculo ${link.localField}:`, e);
        }
      }
      this.cdr.detectChanges();
    } catch (e) {
      console.error("Error cargando configuración de vínculos:", e);
    }
  }

  cargarContenido(contenido: any, index: string) {
    let resultado: any = '';
    // El dataSource de Angular Material puede venir en .data o directamente
    const data = contenido.data || (Array.isArray(contenido) ? contenido : []);
    
    data.forEach((element: any) => {
      if (element[`id_${this.TableName}`] == this.id) {
        resultado = element[index];
      }
    });
    return resultado;
  }

  crearCampos() {
    this.formFields.forEach((field) => {
      field.type = this.normalizarTipo(field.type, field.field);
      this.crearCampo(field);
    });
    this.newRegister = this.fb.group(this.formControlFields);
  }

  normalizarTipo(type: string, fieldName: string = ''): string {
    if (this.linkedFields.some(lf => lf.localField === fieldName)) {
      return 'select';
    }

    const t = type.toLowerCase();
    if (t.includes('date') || t.includes('time') || t.includes('timestamp')) return 'date';
    if (t.includes('int') || t.includes('real') || t.includes('num') || t.includes('double')) return 'number';
    if (t.includes('bool')) return 'boolean';
    return 'text';
  }

  crearCampo(field: FormFields) {
    let value = field.value;
    
    if (field.type === 'date' && value) {
      const d = new Date(value);
      value = !isNaN(d.getTime()) ? d : '';
    }
    
    if (field.type === 'boolean') {
      value = (value === 'true' || value === 1 || value === '1' || value === true);
    }

    this.formControlFields[field.field] = [value];
  }

  dialogClose() {
    this.dialogRef.close();
  }

  async onSubmit() {
    if (this.newRegister.invalid) return;

    let campos: string[] = [];
    let contenido: string[] = [];

    this.formFields.forEach((field) => {
      campos.push(`${field.field}`);
      const val = this.newRegister.value[field.field];

      if (field.type === 'date' && val instanceof Date) {
        contenido.push(`"${val.toISOString().slice(0, 19).replace('T', ' ')}"`);
      } else if (field.type === 'boolean') {
        contenido.push(val ? "1" : "0");
      } else if (field.type === 'number' || field.type === 'select') {
        // Los vínculos se guardan como el ID seleccionado (valor numérico)
        contenido.push(`${val}`);
      } else {
        contenido.push(`"${val}"`);
      }
    });

    let registro: NewRecord = {
      id: this.isUpload ? parseInt(this.id) : null,
      tabla: this.TableName,
      campos: campos,
      contenido: contenido,
    };

    try {
      if (this.isUpload) {
        this.store.dispatch(StoreActions.loadUpdateRecord({ registro: registro }));
      } else {
        const id = await invoke<number>('nuevo_registro', { registro });
        
        for (const adj of this.tempAdjuntos) {
          await invoke('guardar_adjunto', { 
            pathOrigen: adj.ruta, 
            nombre: adj.nombre,
            tabla: this.TableName, 
            registroId: id 
          });
        }
        
        this.store.dispatch(StoreActions.loadNewRecordSuccess({ id }));
        this.store.dispatch(StoreActions.loadContenido({ tabla: this.TableName }));
        this.snackBar.open("Registro creado con éxito", "Listo", { duration: 3000 });
      }
      this.dialogRef.close({ reload: true });
    } catch (e) {
      console.error("Error en onSubmit:", e);
      this.snackBar.open("Error al procesar el registro", "Cerrar", { duration: 5000 });
    }
  }

  async cargarAdjuntos() {
    try {
      if (this.isUpload && this.id) {
        const dbAdjuntos: any[] = await invoke('get_adjuntos', { tabla: this.TableName, registroId: parseInt(this.id) });
        this.adjuntos = [...dbAdjuntos, ...this.tempAdjuntos];
      } else {
        this.adjuntos = [...this.tempAdjuntos];
      }
      this.cdr.detectChanges();
    } catch (e) {
      console.error("Error al cargar adjuntos:", e);
      this.adjuntos = [...this.tempAdjuntos];
      this.cdr.detectChanges();
    }
  }

  async subirAdjunto() {
    const path = await open({
      multiple: false,
      title: 'Seleccionar archivo para adjuntar'
    });

    if (!path || Array.isArray(path)) return;

    if (this.isUpload) {
      try {
        await invoke('guardar_adjunto', { 
          pathOrigen: path, 
          nombre: path.split(/[\\/]/).pop() || 'Archivo',
          tabla: this.TableName, 
          registroId: parseInt(this.id) 
        });
        this.cargarAdjuntos();
        this.snackBar.open("Archivo adjuntado con éxito", "Listo", { duration: 3000 });
      } catch (e) {
        console.error("Error al guardar adjunto:", e);
        this.snackBar.open("Error al adjuntar archivo", "Cerrar", { duration: 5000 });
      }
    } else {
      const nombre = path.split(/[\\/]/).pop() || 'Archivo';
      this.tempAdjuntos.push({
        nombre,
        ruta: path,
        fecha: new Date()
      });
      this.cargarAdjuntos();
    }
  }

  async abrirAdjunto(ruta: string) {
    try {
      await invoke('abrir_adjunto', { rutaRelativa: ruta });
    } catch (e) {
      this.snackBar.open("Error al abrir el archivo", "Cerrar", { duration: 3000 });
    }
  }

  async borrarAdjunto(adj: any) {
    if (this.isUpload && adj.id) {
      if (!confirm("¿Estás seguro de que querés eliminar este archivo de forma permanente?")) return;
      try {
        await invoke('eliminar_adjunto', { id: adj.id });
        this.cargarAdjuntos();
        this.snackBar.open("Adjunto eliminado", "Listo", { duration: 3000 });
      } catch (e) {
        this.snackBar.open("Error al eliminar adjunto", "Cerrar", { duration: 5000 });
      }
    } else {
      this.tempAdjuntos = this.tempAdjuntos.filter(a => a !== adj);
      this.cargarAdjuntos();
    }
  }
}
