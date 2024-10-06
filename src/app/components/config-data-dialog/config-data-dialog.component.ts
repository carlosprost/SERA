import { Component, Inject } from '@angular/core';
import { MaterialModule } from '../../shared/material.module';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { ConfigData, UserConfig } from '../../interfaces/configData.interfaces';
import { StoreActions } from '../../store/store.actions';
import { selectConfigData } from '../../store/store.selectors';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-config-data-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent, MatInputModule],
  templateUrl: './config-data-dialog.component.html',
  styleUrl: './config-data-dialog.component.scss'
})
export class ConfigDataDialogComponent {
  formConfigurations!: FormGroup;
  configData: Observable<ConfigData>;

  nombreApp!: string;
  user!: UserConfig;

  constructor(
    private store: Store,
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<ConfigDataDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.configData = this.store.select(selectConfigData);

    this.configData.subscribe((data) => {
      this.nombreApp = data.nombreApp;
      this.user = data.user;
    });
    this.createForm();
  }

  createForm() {
    this.createFields();
  }

  createFields() {
    this.formConfigurations = this.fb.group({
      nombre: this.user.nombre,
      grado: this.user.grado,
      institucion: this.user.institucion,
      dependencia: this.user.dependencia,
      oficina: this.user.oficina,
      membrete: this.user.membrete,
    });
  }

  dialogClose() {
    this.dialogRef.close();
  }

  onSubmit() {
    let obj: ConfigData = {
      nombreApp: this.nombreApp,
      user: {
        nombre: this.formConfigurations.value.nombre,
        grado: this.formConfigurations.value.grado,
        institucion: this.formConfigurations.value.institucion,
        dependencia: this.formConfigurations.value.dependencia,
        oficina: this.formConfigurations.value.oficina,
        membrete: this.formConfigurations.value.membrete,
      },
    };

    this.store.dispatch(
      StoreActions.loadUpdateConfig(
        StoreActions.loadUpdateConfig({ data: obj })
      )
    );
    this.dialogRef.close({ reload: true });
  }
}
