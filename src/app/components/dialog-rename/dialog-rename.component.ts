import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-dialog-rename',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatDialogModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatButtonModule
  ],
  template: `
    <h2 mat-dialog-title>Conflicto de Nombres</h2>
    <mat-dialog-content>
      <p>La tabla <strong>"{{ data.nombreOriginal }}"</strong> ya existe en la base de datos local.</p>
      <p>Por favor, elegí un nuevo nombre para importarla:</p>
      
      <mat-form-field appearance="outline" style="width: 100%; margin-top: 10px;">
        <mat-label>Nuevo nombre de tabla</mat-label>
        <input matInput [(ngModel)]="nuevoNombre" (keyup.enter)="onConfirm()">
      </mat-form-field>
      
      <p style="font-size: 0.85em; color: #666; margin-top: 5px;">
        <i>Nota: Los espacios se convertirán en guiones bajos automáticamente.</i>
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">CANCELAR</button>
      <button mat-raised-button color="primary" (click)="onConfirm()" [disabled]="!nuevoNombre">IMPORTAR</button>
    </mat-dialog-actions>
  `
})
export class DialogRenameComponent {
  nuevoNombre: string;

  constructor(
    public dialogRef: MatDialogRef<DialogRenameComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { nombreOriginal: string }
  ) {
    // Sugerir un nombre por defecto
    this.nuevoNombre = `${data.nombreOriginal}_copia`;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (this.nuevoNombre) {
      // Normalizar nombre (regla de oro en SERA: sin espacios)
      const nombreLimpio = this.nuevoNombre.trim().toLowerCase().replace(/\s+/g, '_');
      this.dialogRef.close(nombreLimpio);
    }
  }
}
