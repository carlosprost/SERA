import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-dialog-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './dialog-password.html',
  styleUrl: './dialog-password.scss'
})
export class DialogPassword {
  password = '';
  hide = true;

  constructor(
    public dialogRef: MatDialogRef<DialogPassword>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string, message: string, required?: boolean }
  ) {}

  onConfirm() {
    this.dialogRef.close(this.password);
  }
}
