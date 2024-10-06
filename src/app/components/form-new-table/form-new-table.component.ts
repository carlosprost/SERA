import { Component, Inject, Optional } from "@angular/core";
import { MaterialModule } from "../../shared/material.module";
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { Store } from "@ngrx/store";
import { FormFields } from "../../interfaces/form.interfaces";
import { NuevaTabla } from "../../interfaces/tablas.interfaces";
import { StoreActions } from "../../store/store.actions";

@Component({
  selector: "app-form-new-table",
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule],
  templateUrl: "./form-new-table.component.html",
  styleUrl: "./form-new-table.component.scss",
})
export class FormNewTableComponent {
  newTable!: FormGroup;
  TableNameField: FormFields = {
    field: "tableName",
    label: "Nombre de la tabla",
    type: "text",
    value: "",
  };
  formFields: FormFields[][] = [
    [
      { field: "field1", label: "campo", type: "text", value: "" },
      { field: "checkboxNull1", label: "Vacío", type: "checkbox", value: "" },
      { field: "checkboxDate1", label: "Fecha", type: "checkbox", value: "" },
    ],
  ];
  formControlFields: { [key: string]: any } = {};

  constructor(
    private store: Store,
    private fb: FormBuilder,
    @Optional() public dialogRef: MatDialogRef<FormNewTableComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.crearCampos();
  }

  crearCampos() {
    this.formControlFields[this.TableNameField.field] = [
      this.TableNameField.value,
      [Validators.required],
    ];
    this.formFields.forEach((fields) => {
      fields.forEach((field) => {
        this.crearCampo(field);
      });
    });
    this.newTable = this.fb.group(this.formControlFields);
  }

  crearCampo(field: FormFields) {
    this.formControlFields[field.field] = [field.value];
  }

  agregarCampo() {
    let campo = {
      field: `field${this.formFields.length + 1}`,
      label: `campo${this.formFields.length + 1}`,
      type: "text",
      value: "",
    };

    let checkbox1 = {
      field: `checkboxNull${this.formFields.length + 1}`,
      label: "Vacío",
      type: "checkbox",
      value: "",
    };

    let checkbox2 = {
      field: `checkboxDate${this.formFields.length + 1}`,
      label: "Fecha",
      type: "checkbox",
      value: "",
    };

    this.TableNameField["value"] =
      this.newTable.value[this.TableNameField.field];
    this.formFields.forEach((fields) => {
      fields.forEach((field) => {
        field["value"] = this.newTable.value[field.field];
      });
    });

    this.formFields.push([campo, checkbox1, checkbox2]);

    this.crearCampos();
  }

  dialogClose() {
    this.dialogRef.close();
  }

  onSubmit() {
    const nombreTabla = this.newTable.value[this.TableNameField.field]
      .split(" ")
      .join("_")
      .toLowerCase();
    let cuerpoSQL = "";

    console.log(this.newTable.value);

    this.formFields.forEach((fields, index) => {
      let campo = this.newTable.value[fields[0].field]
        .split(" ")
        .join("_")
        .toLowerCase();
      let nulo = this.newTable.value[fields[1].field] ? "NULL" : "NOT NULL";
      let fecha = this.newTable.value[fields[2].field]
        ? "TIMESTAMP"
        : "VARCHAR(255)";

      if (index == this.formFields.length - 1) {
        cuerpoSQL += `${campo} ${fecha} ${nulo}`;
      } else {
        cuerpoSQL += `${campo} ${fecha} ${nulo}, `;
      }
    });

    let nuevaTabla: NuevaTabla = {
      nombre: nombreTabla,
      campos: cuerpoSQL,
    };

    this.store.dispatch(StoreActions.loadNewTable({ tabla: nuevaTabla }));

    this.dialogRef.close({ reload: true });
  }
}
