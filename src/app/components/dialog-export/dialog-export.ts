import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dialog-export',
  standalone: true,
  imports: [
    CommonModule, 
    MatDialogModule, 
    MatButtonModule, 
    MatCheckboxModule, 
    MatIconModule,
    FormsModule
  ],
  template: `
    <div class="export-container">
      <h2 mat-dialog-title>
        <mat-icon>ios_share</mat-icon> 
        Exportar Tabla
      </h2>
      
      <mat-dialog-content>
        <p class="description">Estás por exportar la tabla <strong>{{ data.nombreTabla }}</strong>.</p>
        
        <div class="options-box">
          <mat-checkbox [(ngModel)]="incluirAdjuntos" color="primary">
            <div class="checkbox-label">
              <span class="title">Incluir archivos adjuntos</span>
              <span class="subtitle">Empaqueta todos los documentos vinculados en el archivo .srx</span>
            </div>
          </mat-checkbox>
        </div>

        @if (incluirAdjuntos) {
          <div class="warning-box">
            <mat-icon>info</mat-icon>
            <span>El archivo final será más pesado debido a los adjuntos.</span>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">CANCELAR</button>
        <button mat-raised-button color="primary" (click)="onExport()">
          EXPORTAR...
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .export-container {
      padding: 8px;
      min-width: 350px;
    }
    mat-dialog-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 600;
      color: var(--sera-primary-color);
      margin-bottom: 16px !important;
      mat-icon { color: var(--sera-primary-color); }
    }
    .description {
      color: var(--sera-on-surface);
      opacity: 0.8;
      margin-bottom: 24px;
      font-size: 14px;
    }
    .options-box {
      background: rgba(var(--sera-text-rgb), 0.03);
      padding: 16px;
      border-radius: 8px;
      border: 1px solid rgba(var(--sera-text-rgb), 0.1);
    }
    .checkbox-label {
      display: flex;
      flex-direction: column;
      margin-left: 8px;
      .title { font-weight: 500; font-size: 14px; color: var(--sera-on-surface); }
      .subtitle { font-size: 11px; color: var(--sera-on-surface); opacity: 0.6; }
    }
    .warning-box {
      margin-top: 16px;
      padding: 10px 14px;
      background: rgba(var(--sera-primary-rgb, 33, 150, 243), 0.1);
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--sera-primary-color);
      font-size: 12px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    mat-dialog-actions {
      padding-top: 16px;
      button { font-weight: 600; letter-spacing: 0.5px; }
    }
  `]
})
export class DialogExportComponent {
  incluirAdjuntos: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<DialogExportComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { nombreTabla: string }
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onExport(): void {
    this.dialogRef.close({ incluirAdjuntos: this.incluirAdjuntos });
  }
}
