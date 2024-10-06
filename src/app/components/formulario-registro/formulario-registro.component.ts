import { ChangeDetectionStrategy, Component, Inject, Optional } from '@angular/core';
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
  newRegister!: FormGroup;
  TableName: string = '';
  campos!: Observable<Campos[]>;
  formFields: FormFields[] = [];
  formControlFields: { [key: string]: any } = {};
  id: string;

  constructor(
    private store: Store,
    private fb: FormBuilder,
    @Optional() public dialogRef: MatDialogRef<FormNewTableComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.TableName = data.tabla;
    this.id = data.id;
    this.isUpload = data.upload;
    const contenidoTabla = data.contenido;
    this.campos = this.store.select(selectCampos);

    

    this.campos.subscribe({
      next: (campos) => {
        campos.forEach((campo) => {
          if (campo.Field !== `id_${this.TableName}`) {
            let field: FormFields = {
              field: campo.Field,
              label: campo.Field,
              type: campo.Type,
              value:
                contenidoTabla !== undefined
                  ? this.cargarContenido(contenidoTabla, campo.Field)
                  : '',
            };
            this.formFields.push(field);
          }
        });
        this.crearCampos();
      },
    });
  }

  cargarContenido(contenido: any, index: string) {
    let resultado: string = '';
    contenido.forEach((element: any) => {
      if (element[`id_${this.TableName}`] === this.id) {
        resultado = element[index];
      }
    });
    return resultado;
  }

  crearCampos() {
    this.formFields.forEach((field) => {
      this.crearCampo(field);
    });
    this.newRegister = this.fb.group(this.formControlFields);
  }

  crearCampo(field: FormFields) {
    console.log(field.type);
    
    this.formControlFields[field.field] = field.type === 'timestamp' ? [new Date(field.value)] : [field.value];
  }

  dialogClose() {
    this.dialogRef.close();
  }

  onSubmit() {
    const nombreTabla = this.TableName;
    let campos: string[] = [];
    let contenido: string[] = [];

    this.formFields.forEach((field, index) => {
      campos.push(`${field.field}`);
      if(field.type === 'timestamp'){
        contenido.push(`"${this.newRegister.value[field.field].toISOString().slice(0, 19).replace('T', ' ')}"`);
      }else{
        contenido.push(`"${this.newRegister.value[field.field]}"`);
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
