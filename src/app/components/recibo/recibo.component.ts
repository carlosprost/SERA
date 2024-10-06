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

@Component({
  selector: "app-recibo",
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    ReactiveFormsModule
  ],
  templateUrl: "./recibo.component.html",
  styleUrl: "./recibo.component.scss",
})
export class ReciboComponent {
  fb = inject(FormBuilder);


  formularioRecibo!: FormGroup
  

  constructor(
    public dialogRef: MatDialogRef<ReciboComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.createForm()
  }

  createForm(){
    this.formularioRecibo = this.fb.group({
      titulo: [''],
      descripcion: [''],
    })
  }

  save() {
    this.dialogRef.close(this.formularioRecibo.value);
  }
}
