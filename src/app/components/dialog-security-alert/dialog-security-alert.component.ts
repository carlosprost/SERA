import { Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { invoke } from '@tauri-apps/api/core';

@Component({
  selector: 'app-dialog-security-alert',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="panic-dialog">
      <div class="panic-dialog__header">
        <mat-icon class="panic-dialog__icon animate-pulse">security</mat-icon>
        <h1 class="panic-dialog__title">¡ALERTA DE SEGURIDAD DETECTADA!</h1>
      </div>
      
      <div class="panic-dialog__body">
        <p class="panic-dialog__description">
          El Firewall de SERA (WAF de Entrada) acaba de interceptar y bloquear un intento de 
          <strong>Inyección de Código Malicioso (Script/XSS)</strong> desde la red local.
        </p>

        <div class="panic-dialog__details">
          <div class="panic-dialog__detail-row">
            <span class="panic-dialog__label">Dirección IP Emisor:</span>
            <span class="panic-dialog__value panic-dialog__value--highlight">{{ data.ip }}</span>
          </div>
          <div class="panic-dialog__detail-row">
            <span class="panic-dialog__label">Tabla Objetivo:</span>
            <span class="panic-dialog__value">{{ data.tabla | uppercase }}</span>
          </div>
          <div class="panic-dialog__detail-row">
            <span class="panic-dialog__label">Campo Afectado:</span>
            <span class="panic-dialog__value">{{ data.campo }}</span>
          </div>
          <div class="panic-dialog__detail-row">
            <span class="panic-dialog__label">Firma de script detectada:</span>
            <span class="panic-dialog__value panic-dialog__value--badge">{{ data.firma }}</span>
          </div>
        </div>

        <div class="panic-dialog__payload-box">
          <span class="panic-dialog__payload-label">Carga útil bloqueada (Raw Payload):</span>
          <pre class="panic-dialog__payload-value"><code>{{ data.payload }}</code></pre>
        </div>

        <p class="panic-dialog__warning">
          Te recomendamos apagar el servidor de red local inmediatamente para auditar la procedencia 
          de esta IP y evitar posibles fugas de información.
        </p>
      </div>

      <div class="panic-dialog__actions">
        <button 
          mat-flat-button 
          color="warn" 
          class="panic-dialog__btn panic-dialog__btn--panic"
          [disabled]="cargando()"
          (click)="apagarServidor()">
          <mat-icon>power_settings_new</mat-icon>
          <span>APAGAR SERVIDOR INMEDIATAMENTE</span>
        </button>
        
        <button 
          mat-stroked-button 
          class="panic-dialog__btn panic-dialog__btn--ignore"
          [disabled]="cargando()"
          (click)="ignorar()">
          <span>Ignorar Amenaza (Bajo mi riesgo)</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .panic-dialog {
      background: rgba(30, 5, 5, 0.95);
      backdrop-filter: blur(20px);
      border: 2px solid #ff1744;
      border-radius: 16px;
      padding: 24px;
      color: #ffcdd2;
      box-shadow: 0 0 40px rgba(255, 23, 68, 0.4);
      max-width: 600px;
      font-family: inherit;
    }

    .panic-dialog__header {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 1px solid rgba(255, 23, 68, 0.2);
      padding-bottom: 16px;
    }

    .panic-dialog__icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #ff1744;
      text-shadow: 0 0 10px rgba(255, 23, 68, 0.7);
    }

    .panic-dialog__title {
      margin: 0;
      font-size: 1.4rem;
      font-weight: 800;
      color: #ff1744;
      letter-spacing: 1px;
    }

    .panic-dialog__body {
      margin: 20px 0;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .panic-dialog__description {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.5;
      color: #ffebee;
    }

    .panic-dialog__details {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 23, 68, 0.1);
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .panic-dialog__detail-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
    }

    .panic-dialog__label {
      color: rgba(255, 205, 210, 0.6);
    }

    .panic-dialog__value {
      font-weight: 600;
      color: #ffebee;
    }

    .panic-dialog__value--highlight {
      color: #ff1744;
      font-family: monospace;
      font-size: 1rem;
    }

    .panic-dialog__value--badge {
      background: rgba(255, 23, 68, 0.15);
      color: #ff8a80;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid rgba(255, 23, 68, 0.3);
    }

    .panic-dialog__payload-box {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .panic-dialog__payload-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: rgba(255, 205, 210, 0.5);
    }

    .panic-dialog__payload-value {
      background: #000000;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 12px;
      margin: 0;
      max-height: 120px;
      overflow-y: auto;
      color: #ff8a80;
      font-size: 0.8rem;
      font-family: 'Fira Code', monospace;
      white-space: pre-wrap;
    }

    .panic-dialog__warning {
      margin: 0;
      font-size: 0.8rem;
      color: #ff8a80;
      line-height: 1.4;
      font-weight: 500;
    }

    .panic-dialog__actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 24px;
    }

    .panic-dialog__btn {
      width: 100% !important;
      height: 48px !important;
      border-radius: 8px !important;
      font-weight: 700 !important;
    }

    .panic-dialog__btn--panic {
      background-color: #ff1744 !important;
      color: #ffffff !important;
      box-shadow: 0 4px 15px rgba(255, 23, 68, 0.4) !important;
      transition: all 0.2s ease;
    }

    .panic-dialog__btn--panic:hover {
      background-color: #d50000 !important;
      box-shadow: 0 6px 20px rgba(255, 23, 68, 0.6) !important;
    }

    .panic-dialog__btn--ignore {
      color: rgba(255, 205, 210, 0.7) !important;
      border-color: rgba(255, 255, 255, 0.1) !important;
    }

    .panic-dialog__btn--ignore:hover {
      background: rgba(255, 255, 255, 0.03) !important;
      color: #ffffff !important;
    }

    .animate-pulse {
      animation: alert-pulse 1.5s infinite alternate;
    }

    @keyframes alert-pulse {
      from {
        transform: scale(1);
        opacity: 0.7;
      }
      to {
        transform: scale(1.15);
        opacity: 1;
        color: #ff5252;
      }
    }
  `]
})
export class DialogSecurityAlertComponent {
  cargando = signal<boolean>(false);

  constructor(
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<DialogSecurityAlertComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  // Apagar inmediatamente el socket del servidor HTTP local
  async apagarServidor() {
    this.cargando.set(true);
    try {
      // 1. Detener socket en el backend Rust
      await invoke('toggle_api_servidor', {
        habilitar: false,
        puerto: 54321 // puerto placeholder, toggle_api_servidor prioriza apagar
      });

      // 2. Desactivar flag en persistencia de SQLite config
      const config: any = await invoke('get_config');
      if (config) {
        config.user.apiEnabled = 0;
        await invoke('update_config', { config });
      }

      this.snackBar.open('¡Cerrado de Emergencia Exitoso! El servidor local ha sido apagado.', 'OK', {
        duration: 4000
      });
      
      this.dialogRef.close({ apagado: true });
    } catch (err) {
      console.error('[SERA] Error al apagar servidor de emergencia:', err);
      this.snackBar.open('No se pudo apagar el servidor de forma remota.', 'Cerrar', { duration: 3000 });
    } finally {
      this.cargando.set(false);
    }
  }

  ignorar() {
    this.dialogRef.close({ apagado: false });
  }
}
