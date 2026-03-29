import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Optional } from '@angular/core';
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
import { FormNewTableComponent } from '../form-new-table/form-new-table.component';
import { provideNativeDateAdapter } from '@angular/material/core';

@Component({
  selector: 'app-formulario-registro',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule],
  templateUrl: './formulario-registro.component.html',
  styleUrl: './formulario-registro.component.scss',
  providers: [provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioRegistroComponent {
  isUpload: boolean = false;
  newRegister: FormGroup;
  TableName: string = '';
  campos!: Observable<Campos[]>;
  formFields: FormFields[] = [];
  formControlFields: { [key: string]: any } = {};
  id: string;

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    @Optional() public dialogRef: MatDialogRef<FormNewTableComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    // Inicialización inmediata para evitar errores en el template antes de que llegue la data
    this.newRegister = this.fb.group({});
    
    // Normalizamos el nombre a minúsculas para coincidir con la convención de la DB
    this.TableName = data.tabla.toLowerCase();
    this.id = data.id;
    this.isUpload = data.upload;
    const contenidoTabla = data.contenido;
    this.campos = this.store.select(selectCampos);

    this.campos.subscribe({
      next: (campos) => {
        // Usamos una lista temporal para asegurar un cambio de referencia al final
        const temporalFields: FormFields[] = [];
        this.formControlFields = {};

        campos.forEach((campo) => {
          // Filtramos la llave primaria (ID) para que no sea editable
          if (campo.Field.toLowerCase() !== `id_${this.TableName}`) {
            let field: FormFields = {
              field: campo.Field,
              label: campo.Field,
              type: campo.Type,
              value:
                contenidoTabla !== undefined
                  ? this.cargarContenido(contenidoTabla, campo.Field)
                  : '',
            };
            temporalFields.push(field);
          }
        });
        
        this.formFields = temporalFields;
        this.crearCampos();
        // Forzamos la detección de cambios para OnPush ya que estamos en un callback asíncrono
        this.cdr.markForCheck();
      },
    });
  }

  cargarContenido(contenido: any, index: string) {
    let resultado: any = '';
    contenido.data.forEach((element: any) => {
      // Búsqueda de ID insensible a mayúsculas para mayor robustez
      if (element[`id_${this.TableName}`] == this.id) {
        resultado = element[index];
      }
    });
    return resultado;
  }

  crearCampos() {
    this.formFields.forEach((field) => {
      // Normalizar tipo de dato de SQLite para el frontend
      field.type = this.normalizarTipo(field.type);
      this.crearCampo(field);
    });
    this.newRegister = this.fb.group(this.formControlFields);
  }

  normalizarTipo(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('date') || t.includes('time') || t.includes('timestamp')) return 'date';
    if (t.includes('int') || t.includes('real') || t.includes('num') || t.includes('double')) return 'number';
    if (t.includes('bool')) return 'boolean';
    return 'text';
  }

  crearCampo(field: FormFields) {
    let value = field.value;
    
    // Si es fecha, intentar convertir el valor existente a objeto Date
    if (field.type === 'date' && value) {
      const d = new Date(value);
      value = !isNaN(d.getTime()) ? d : '';
    }
    
    // Si es booleano, normalizar a booleano real
    if (field.type === 'boolean') {
      value = (value === 'true' || value === 1 || value === '1' || value === true);
    }

    this.formControlFields[field.field] = [value];
  }

  dialogClose() {
    this.dialogRef.close();
  }

  onSubmit() {
    const nombreTabla = this.TableName;
    let campos: string[] = [];
    let contenido: string[] = [];

    this.formFields.forEach((field) => {
      campos.push(`${field.field}`);
      const val = this.newRegister.value[field.field];

      if (field.type === 'date' && val instanceof Date) {
        // Formato SQLite estándar: YYYY-MM-DD HH:MM:SS
        contenido.push(`"${val.toISOString().slice(0, 19).replace('T', ' ')}"`);
      } else if (field.type === 'boolean') {
        // En SQLite los booleanos son generalmente 0 o 1
        contenido.push(val ? "1" : "0");
      } else if (field.type === 'number') {
        contenido.push(`${val}`);
      } else {
        contenido.push(`"${val}"`);
      }
    });

    let registro: NewRecord = {
      id: null,
      tabla: nombreTabla,
      campos: campos,
      contenido: contenido,
    };
    if (this.isUpload) {
      registro.id = parseInt(this.id);
      this.store.dispatch(
        StoreActions.loadUpdateRecord({ registro: registro })
      );
    } else {
      this.store.dispatch(StoreActions.loadNewRecord({ registro: registro }));
    }

    this.dialogRef.close({ reload: true });
  }
}
