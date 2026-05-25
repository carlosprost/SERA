import { Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from '../../shared/material.module';
import { invoke } from '@tauri-apps/api/core';

interface TablaDisponible {
  id_tablas: number;
  nombre_tabla: string;
}

interface TablaExpuesta {
  tabla: string;
  codigo: string;
  token: string;
  permiso: 'READ' | 'READ_WRITE' | 'FULL';
  cifradoE2e: boolean;
}

@Component({
  selector: 'app-dialog-expose-table',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  template: `
    <div class="expose-dialog">
      <div class="expose-dialog__header">
        <div class="expose-dialog__title-group">
          <mat-icon class="expose-dialog__logo-icon">add_link</mat-icon>
          <div>
            <h2 class="expose-dialog__title">Exponer Tablas a la Red</h2>
            <p class="expose-dialog__subtitle">Seleccioná qué tablas del sistema querés publicar en la red local.</p>
          </div>
        </div>
        <button mat-icon-button (click)="onCerrar()" class="expose-dialog__close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-divider class="expose-dialog__divider"></mat-divider>

      <!-- BARRA DE BÚSQUEDA -->
      <div class="expose-dialog__search-bar">
        <mat-form-field appearance="outline" class="expose-dialog__search-field">
          <mat-label>Buscar tabla...</mat-label>
          <input matInput type="text" [(ngModel)]="searchQuery" (input)="filtrarTablas()" placeholder="Ej. Categorías">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
      </div>

      <!-- LISTADO DE TABLAS -->
      <div class="expose-dialog__content">
        @if (tablasFiltradas().length === 0) {
          <div class="expose-dialog__empty">
            <mat-icon class="expose-dialog__empty-icon">search_off</mat-icon>
            <span class="expose-dialog__empty-text">No se encontraron tablas con ese nombre.</span>
          </div>
        } @else {
          <div class="expose-dialog__list">
            @for (t of tablasFiltradas(); track t.id_tablas) {
              <div 
                class="expose-dialog__item" 
                [class.expose-dialog__item--active]="isExpuesta(t.nombre_tabla)">
                <div class="expose-dialog__item-info">
                  <mat-icon class="expose-dialog__item-icon">folder_open</mat-icon>
                  <div class="expose-dialog__item-details">
                    <span class="expose-dialog__item-name">{{ t.nombre_tabla | uppercase }}</span>
                    <span class="expose-dialog__item-status" [class.expose-dialog__item-status--active]="isExpuesta(t.nombre_tabla)">
                      {{ isExpuesta(t.nombre_tabla) ? 'Expuesta' : 'Privada' }}
                    </span>
                  </div>
                </div>
                
                <div class="expose-dialog__item-action">
                  <button 
                    mat-flat-button
                    [color]="isExpuesta(t.nombre_tabla) ? 'warn' : 'primary'"
                    class="expose-dialog__action-btn"
                    [disabled]="procesandoTabla() === t.nombre_tabla"
                    (click)="toggleExposicion(t.nombre_tabla)">
                    @if (procesandoTabla() === t.nombre_tabla) {
                      <mat-spinner diameter="18"></mat-spinner>
                    } @else {
                      <ng-container>
                        <mat-icon>{{ isExpuesta(t.nombre_tabla) ? 'cloud_off' : 'cloud_queue' }}</mat-icon>
                        <span>{{ isExpuesta(t.nombre_tabla) ? 'Quitar de Red' : 'Exponer' }}</span>
                      </ng-container>
                    }
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <div class="expose-dialog__footer">
        <button mat-button class="expose-dialog__done-btn" (click)="onCerrar()">Listo</button>
      </div>
    </div>
  `,
  styles: [`
    .expose-dialog {
      background: var(--sera-bg-color, #111a24);
      border: 1px solid rgba(var(--sera-primary-rgb, 0, 188, 212), 0.25);
      border-radius: 16px;
      padding: 24px;
      color: var(--sera-text-color, #ffffff);
      font-family: 'Outfit', 'Inter', sans-serif;
      box-shadow: 0 15px 35px rgba(0,0,0,0.5);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      max-height: 85vh;
    }

    .expose-dialog__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .expose-dialog__title-group {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .expose-dialog__logo-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: var(--sera-primary-color, #00bcd4);
    }

    .expose-dialog__title {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: var(--sera-text-color, #f1f5f9);
    }

    .expose-dialog__subtitle {
      margin: 4px 0 0 0;
      font-size: 0.8rem;
      color: var(--sera-text-color, #64748b);
      opacity: 0.8;
    }

    .expose-dialog__close-btn {
      color: var(--sera-text-color, #94a3b8) !important;
      opacity: 0.7;
    }
    .expose-dialog__close-btn:hover {
      opacity: 1;
    }

    .expose-dialog__divider {
      margin: 0 0 20px 0;
      opacity: 0.12;
    }

    .expose-dialog__search-bar {
      margin-bottom: 16px;
      width: 100%;
    }

    .expose-dialog__search-field {
      width: 100%;
    }
    .expose-dialog__search-field ::ng-deep .mat-mdc-text-field-wrapper {
      background: rgba(0, 0, 0, 0.2) !important;
    }

    .expose-dialog__content {
      flex: 1;
      overflow-y: auto;
      min-height: 250px;
      max-height: 380px;
      padding-right: 4px;
    }
    .expose-dialog__content::-webkit-scrollbar {
      width: 6px;
    }
    .expose-dialog__content::-webkit-scrollbar-thumb {
      background: rgba(var(--sera-text-rgb, 255, 255, 255), 0.15);
      border-radius: 3px;
    }

    .expose-dialog__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 40px 0;
      color: var(--sera-text-color, #64748b);
      opacity: 0.7;
    }
    .expose-dialog__empty-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
    }
    .expose-dialog__empty-text {
      font-size: 0.9rem;
      font-weight: 500;
    }

    .expose-dialog__list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .expose-dialog__item {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .expose-dialog__item:hover {
      border-color: rgba(var(--sera-primary-rgb, 0, 188, 212), 0.2);
      background: rgba(255, 255, 255, 0.04);
    }
    .expose-dialog__item--active {
      background: linear-gradient(135deg, rgba(var(--sera-primary-rgb, 0, 188, 212), 0.05) 0%, rgba(255, 255, 255, 0.01) 100%);
      border-color: rgba(var(--sera-primary-rgb, 0, 188, 212), 0.25);
    }

    .expose-dialog__item-info {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .expose-dialog__item-icon {
      color: var(--sera-text-color, #94a3b8);
      opacity: 0.6;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }
    .expose-dialog__item--active .expose-dialog__item-icon {
      color: var(--sera-primary-color, #00bcd4);
      opacity: 0.9;
    }

    .expose-dialog__item-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .expose-dialog__item-name {
      font-size: 0.92rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: var(--sera-text-color, #f1f5f9);
    }

    .expose-dialog__item-status {
      font-size: 0.72rem;
      font-weight: 500;
      color: var(--sera-text-color, #64748b);
      opacity: 0.8;
    }
    .expose-dialog__item-status--active {
      color: var(--sera-primary-color, #00bcd4);
    }

    .expose-dialog__item-action {
      display: flex;
      align-items: center;
    }

    .expose-dialog__action-btn {
      font-weight: 600;
      font-size: 0.8rem !important;
      height: 36px !important;
      border-radius: 8px !important;
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
    }
    .expose-dialog__action-btn span {
      line-height: 1 !important;
    }
    .expose-dialog__action-btn mat-icon {
      font-size: 16px !important;
      width: 16px !important;
      height: 16px !important;
      margin: 0 !important;
    }

    .expose-dialog__footer {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    }

    .expose-dialog__done-btn {
      background: var(--sera-primary-color, #00bcd4) !important;
      color: var(--sera-on-primary, #111a24) !important;
      font-weight: 600 !important;
      border-radius: 8px !important;
      height: 40px !important;
      padding: 0 24px !important;
      box-shadow: 0 4px 10px rgba(var(--sera-primary-rgb, 0, 188, 212), 0.2) !important;
    }
    .expose-dialog__done-btn:hover {
      opacity: 0.9;
    }
  `]
})
export class DialogExposeTableComponent {
  searchQuery = '';
  tablasFiltradas = signal<TablaDisponible[]>([]);
  procesandoTabla = signal<string>('');

  constructor(
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<DialogExposeTableComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      tablasDisponibles: TablaDisponible[], 
      tablasExpuestas: Map<string, TablaExpuesta> 
    }
  ) {
    this.filtrarTablas();
  }

  filtrarTablas() {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      this.tablasFiltradas.set([...this.data.tablasDisponibles]);
    } else {
      this.tablasFiltradas.set(
        this.data.tablasDisponibles.filter(t => 
          t.nombre_tabla.toLowerCase().includes(q)
        )
      );
    }
  }

  isExpuesta(tablaNombre: string): boolean {
    return this.data.tablasExpuestas.has(tablaNombre);
  }

  async toggleExposicion(tablaNombre: string) {
    const estaExpuesta = this.isExpuesta(tablaNombre);
    this.procesandoTabla.set(tablaNombre);

    try {
      if (estaExpuesta) {
        // A. Revocar exposición en el backend
        await invoke('revocar_tabla_cmd', { tabla: tablaNombre });
        this.data.tablasExpuestas.delete(tablaNombre);
        this.snackBar.open(`Tabla '${tablaNombre}' removida de la red local.`, 'OK', { duration: 2000 });
      } else {
        // B. Exponer en el backend
        const credenciales: any = await invoke('exponer_tabla_cmd', {
          tabla: tablaNombre,
          permiso: 'READ',
          e2e: true
        });

        this.data.tablasExpuestas.set(tablaNombre, {
          tabla: tablaNombre,
          codigo: credenciales.codigo,
          token: credenciales.token,
          permiso: 'READ',
          cifradoE2e: true
        });
        
        this.snackBar.open(`Tabla '${tablaNombre}' expuesta en red local.`, 'ÉXITO', { duration: 2500 });
      }
    } catch (err) {
      console.error('[SERA] Error al alterar exposición de la tabla:', err);
      this.snackBar.open('No se pudo conmutar el estado de red de la tabla.', 'Cerrar', { duration: 3000 });
    } finally {
      this.procesandoTabla.set('');
    }
  }

  onCerrar() {
    this.dialogRef.close({ tablasExpuestas: this.data.tablasExpuestas });
  }
}
