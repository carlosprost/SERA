import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material.module';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-recetario',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon>science</mat-icon> Recetario de Fórmulas Inteligentes
    </h2>
    
    <div mat-dialog-content class="recetario-container">
      <section class="guia-section">
        <h3><mat-icon>info</mat-icon> Reglas Básicas</h3>
        <ul>
          <li><strong>Campos:</strong> Usá corchetes para los nombres: <code>[stock]</code> o <code>[&lt;stock&gt;]</code>.</li>
          <li><strong>Separador:</strong> Usá siempre punto y coma <code>;</code> entre argumentos.</li>
          <li><strong>Texto:</strong> Siempre entre comillas dobles: <code>"Agotado"</code>.</li>
        </ul>
      </section>

      <mat-divider></mat-divider>

      <section class="guia-section">
        <h3><mat-icon>functions</mat-icon> Funciones Lógicas</h3>
        <div class="formula-item">
          <p><strong>SI(condición; verdadero; falso)</strong></p>
          <code>SI([stock] &lt;= 5; "PEDIR"; "OK")</code>
        </div>
        <div class="formula-item">
          <p><strong>OR / AND</strong></p>
          <code>SI([stock] &lt; 5 OR [estado] === "URGENTE"; "ROJO"; "BLANCO")</code>
        </div>
      </section>

      <mat-divider></mat-divider>

      <section class="guia-section">
        <h3><mat-icon>calendar_today</mat-icon> Fechas y Tiempo</h3>
        <div class="formula-item">
          <p><strong>DIF_DIAS(inicio; fin)</strong></p>
          <p class="desc">Calcula días entre fechas. Usá <code>HOY()</code> para el día actual.</p>
          <code>DIF_DIAS([fecha_creacion]; HOY())</code>
        </div>
      </section>

      <mat-divider></mat-divider>

      <section class="guia-section">
        <h3><mat-icon>text_fields</mat-icon> Texto</h3>
        <div class="formula-item">
          <p><strong>CONCAT(t1; t2; ...)</strong></p>
          <code>CONCAT("Ref: "; [codigo]; " - "; [nombre])</code>
        </div>
        <div class="formula-item">
          <p><strong>MAYUS / MINUS</strong></p>
          <code>MAYUS([proveedor])</code>
        </div>
      </section>

      <div class="ejemplo-final mat-elevation-z2">
        <p><strong>💡 Ejemplo Pro: Semáforo de Stock</strong></p>
        <code>SI([stock] &lt;= 0; "AGOTADO"; SI([stock] &lt;= 10; "CRÍTICO"; "DISPONIBLE"))</code>
      </div>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="close()">Entendido</button>
    </div>
  `,
  styles: [`
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--sera-primary-color);
      background: var(--sera-bg-color);
      padding: 20px;
      margin: 0;
    }
    .recetario-container {
      background: var(--sera-bg-color);
      color: var(--sera-text-color);
      padding: 20px;
      max-height: 70vh;
    }
    .guia-section {
      margin: 20px 0;
      h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--sera-primary-color);
        font-size: 1.1rem;
        margin-bottom: 12px;
      }
      ul {
        padding-left: 20px;
        li { margin-bottom: 8px; font-size: 0.9rem; }
      }
    }
    .formula-item {
      margin-bottom: 15px;
      p { margin: 0 0 5px 0; font-size: 0.9rem; font-weight: 500; }
      .desc { font-size: 0.8rem; color: var(--sera-text-color); opacity: 0.6; font-style: italic; }
    }
    code {
      display: block;
      background: rgba(var(--sera-text-rgb), 0.05);
      padding: 10px;
      border-radius: 6px;
      font-family: 'Consolas', 'Monaco', monospace;
      color: var(--sera-primary-color);
      border-left: 3px solid var(--sera-primary-color);
      margin-top: 5px;
    }
    .ejemplo-final {
      background: rgba(var(--sera-primary-rgb, 33, 150, 243), 0.1);
      border: 1px solid rgba(var(--sera-primary-rgb, 33, 150, 243), 0.3);
      padding: 15px;
      border-radius: 8px;
      margin-top: 25px;
      p { margin: 0 0 10px 0; color: var(--sera-primary-color); font-weight: bold; }
    }
    mat-divider {
      background: rgba(var(--sera-text-rgb), 0.1);
    }
    mat-dialog-actions {
      background: var(--sera-bg-color);
      padding: 10px 20px !important;
      margin: 0;
    }
  `]
})
export class RecetarioComponent {
  constructor(private dialogRef: MatDialogRef<RecetarioComponent>) {}
  close() {
    this.dialogRef.close();
  }
}
