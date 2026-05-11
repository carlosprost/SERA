import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { invoke } from '@tauri-apps/api/core';

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [
    CommonModule, 
    MatDialogModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatIconModule, 
    MatListModule, 
    MatProgressSpinnerModule,
    FormsModule
  ],
  templateUrl: './global-search.html',
  styleUrl: './global-search.scss'
})
export class GlobalSearchComponent {
  searchTerm = '';
  results = signal<any>({});
  loading = signal(false);

  constructor(public dialogRef: MatDialogRef<GlobalSearchComponent>) {}

  async onSearch() {
    if (this.searchTerm.length < 2) {
      this.results.set({});
      return;
    }

    this.loading.set(true);
    try {
      const res = await invoke<any>('search_global', { term: this.searchTerm });
      this.results.set(res);
    } catch (e) {
      console.error("[SERA] Error en búsqueda global:", e);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Al presionar Enter, cerramos con el término para abrir la pestaña de resultados completa.
   */
  onEnter() {
    if (this.searchTerm.length >= 2) {
      this.dialogRef.close({ action: 'full_search', term: this.searchTerm, results: this.results() });
    }
  }

  /**
   * Al seleccionar un resultado específico de la vista previa.
   */
  selectResult(tabla: string, row: any) {
    this.dialogRef.close({ action: 'go_to', tabla, row });
  }

  get tableNames() {
    return Object.keys(this.results());
  }

  /** Obtiene un resumen legible de una fila para la vista previa */
  getRowSummary(row: any): string {
    return Object.entries(row)
      .filter(([key, val]) => !key.toLowerCase().includes('id') && (typeof val === 'string' || typeof val === 'number'))
      .map(([_, val]) => val)
      .slice(0, 3)
      .join(' | ');
  }
}
