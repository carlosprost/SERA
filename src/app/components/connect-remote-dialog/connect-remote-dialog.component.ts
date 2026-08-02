import { Component, signal, Inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from '../../shared/material.module';
import { invoke } from '@tauri-apps/api/core';

@Component({
  selector: 'app-connect-remote-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    MatDialogModule
  ],
  template: `
    <div class="remote-conn">
      <div class="remote-conn__header">
        <mat-icon class="remote-conn__icon">settings_input_antenna</mat-icon>
        <div>
          <h1 class="remote-conn__title">Enlazar Tabla Remota</h1>
          <p class="remote-conn__subtitle">Conectate a otra base de datos de la red local.</p>
        </div>
      </div>

      <div class="remote-conn__body">
        <form [formGroup]="connForm" class="remote-conn__form">
          
          <!-- IP DEL HOST -->
          <div class="remote-conn__row">
            <mat-form-field appearance="outline" class="remote-conn__field">
              <mat-label>Dirección IP del Host Local</mat-label>
              <input matInput formControlName="host" placeholder="Ej: 192.168.1.150" required>
              <mat-icon matSuffix>dns</mat-icon>
              <mat-error *ngIf="connForm.get('host')?.hasError('required')">La IP es requerida</mat-error>
            </mat-form-field>
          </div>

          <!-- PUERTO -->
          <div class="remote-conn__row">
            <mat-form-field appearance="outline" class="remote-conn__field">
              <mat-label>Puerto del Servidor</mat-label>
              <input matInput type="number" formControlName="port" placeholder="54321" required>
              <mat-icon matSuffix>lan</mat-icon>
              <mat-error *ngIf="connForm.get('port')?.hasError('required')">El puerto es requerido</mat-error>
            </mat-form-field>
          </div>

          <!-- NOMBRE DE LA TABLA REMOTA -->
          <div class="remote-conn__row">
            <mat-form-field appearance="outline" class="remote-conn__field">
              <mat-label>Nombre de la Tabla Remota</mat-label>
              <input matInput formControlName="tableName" placeholder="Ej: expedientes" required>
              <mat-icon matSuffix>table_chart</mat-icon>
              <mat-hint>El nombre exacto de la tabla física en el host.</mat-hint>
              <mat-error *ngIf="connForm.get('tableName')?.hasError('required')">El nombre de tabla es requerido</mat-error>
            </mat-form-field>
          </div>

          <!-- CÓDIGO DE CONEXIÓN O TOKEN -->
          <div class="remote-conn__row">
            <mat-form-field appearance="outline" class="remote-conn__field">
              <mat-label>Código de Conexión (o Token Bearer)</mat-label>
              <input matInput formControlName="token" placeholder="Ej: Y3D88-DC34" required>
              <mat-icon matSuffix>vpn_key</mat-icon>
              <mat-error *ngIf="connForm.get('token')?.hasError('required')">La credencial es requerida</mat-error>
            </mat-form-field>
          </div>

        </form>
      </div>

      <div class="remote-conn__actions">
        <button mat-button (click)="dialogRef.close()" [disabled]="cargando()">Cancelar</button>
        <button 
          mat-flat-button 
          color="primary" 
          [disabled]="connForm.invalid || cargando()"
          (click)="probarYEnlazar()">
          <span class="button-content-wrapper">
            <mat-spinner diameter="18" class="button-spinner" *ngIf="cargando()"></mat-spinner>
            {{ cargando() ? 'CONECTANDO...' : 'ENLAZAR TABLA' }}
          </span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .remote-conn {
      background: rgba(25, 25, 30, 0.95);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 24px;
      color: #ffffff;
      max-width: 480px;
    }

    .remote-conn__header {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 16px;
      margin-bottom: 20px;
    }

    .remote-conn__icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      line-height: 36px;
      display: flex !important;
      align-items: center;
      justify-content: center;
      overflow: visible !important;
      color: var(--sera-primary-color, #38bdf8);
    }

    .remote-conn__title {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .remote-conn__subtitle {
      margin: 2px 0 0 0;
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.5);
    }

    .remote-conn__form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .remote-conn__field {
      width: 100%;
    }

    .remote-conn__actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
    }
  `]
})
export class ConnectRemoteDialogComponent {
  connForm!: FormGroup;
  cargando = signal<boolean>(false);

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private ngZone: NgZone,
    public dialogRef: MatDialogRef<ConnectRemoteDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.connForm = this.fb.group({
      host: ['', [Validators.required]],
      port: [54321, [Validators.required]],
      tableName: ['', [Validators.required]],
      token: ['', [Validators.required]]
    });
  }

  // Lógica para conectarse al servidor remoto, validar estado y enlazar tabla
  async probarYEnlazar() {
    this.cargando.set(true);
    const { host, port, tableName, token } = this.connForm.value;
    const urlBase = `http://${host}:${port}`;
    const nameTrim = tableName.trim().toLowerCase();

    try {
      // 1. Probar el estado del servidor remoto (healthcheck)
      console.log(`[SERA Cliente] Probando conexión con ${urlBase}/api/v1/status`);
      const response = await fetch(`${urlBase}/api/v1/status`);
      if (!response.ok) {
        throw new Error('El servidor remoto no respondió de forma correcta.');
      }
      
      const statusData = await response.json();
      if (statusData.app !== 'SERA') {
        throw new Error('El host especificado no ejecuta un servidor SERA válido.');
      }

      // 2. Probar acceso a la tabla y validar credenciales consultando sus campos
      console.log(`[SERA Cliente] Solicitando columnas de la tabla remota ${nameTrim}`);
      const schemaResponse = await fetch(`${urlBase}/api/v1/tablas/${nameTrim}/campos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (schemaResponse.status === 401 || schemaResponse.status === 403) {
        throw new Error('Credenciales inválidas o permisos denegados para esta tabla.');
      }
      
      if (!schemaResponse.ok) {
        throw new Error(`La tabla '${nameTrim}' no existe o no está expuesta en el host.`);
      }

      const fields = await schemaResponse.json();

      // 3. Registrar virtualmente la tabla remota en el catálogo local de SQLite del cliente
      const virtualConfig = {
        isRemote: true,
        remoteUrl: urlBase,
        remoteToken: token,
        remoteTableName: nameTrim,
        linkedFields: [],
        colorRules: []
      };

      const nuevaTablaStruct = {
        nombre: `remoto_${nameTrim}`, // sufijo para evitar colisiones locales
        campos: fields.map((f: any) => `"${f.Field}" TEXT`).join(', '),
        config: JSON.stringify(virtualConfig)
      };

      console.log('[SERA Cliente] Registrando tabla remota virtual de forma local...');
      await invoke('crear_tabla', { tabla: nuevaTablaStruct });

      this.ngZone.run(() => {
        this.snackBar.open(`¡Tabla remota '${nameTrim}' enlazada con éxito!`, 'Listo', {
          duration: 4000
        });
        this.dialogRef.close({ success: true, tableName: `remoto_${nameTrim}` });
      });

    } catch (err: any) {
      console.error('[SERA Cliente] Error de conexión remota:', err);
      this.ngZone.run(() => {
        this.snackBar.open(`Conexión fallida: ${err.message || err}`, 'Cerrar', {
          duration: 5000,
          panelClass: ['snackbar-error']
        });
      });
    } finally {
      this.cargando.set(false);
    }
  }
}
