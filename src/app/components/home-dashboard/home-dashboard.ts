import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { Store } from '@ngrx/store';
import { selectConfigData, selectTablas } from '../../store/store.selectors';
import { invoke } from '@tauri-apps/api/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { UiService } from '../../services/ui.service';
import { ConfigData } from '../../interfaces/configData.interfaces';
import { AppInfoService } from '../../services/app-info.service';
import { SeraButtonComponent } from '../../shared/components/ui/sera-button/sera-button.component';

interface GlobalStats {
  total_tablas: number;
  total_registros: number;
}

@Component({
  selector: 'app-home-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    MatIconModule, 
    MatButtonModule, 
    MatCardModule, 
    MatDividerModule,
    SeraButtonComponent
  ],
  templateUrl: './home-dashboard.html',
  styleUrl: './home-dashboard.scss'
})
export class HomeDashboardComponent implements OnInit {
  
  // Obtenemos la configuración del usuario desde el store y forzamos el tipo
  config = toSignal<ConfigData>(this.store.select(selectConfigData) as any);
  
  // Estadísticas globales (Signal reactiva)
  stats = signal<GlobalStats>({ total_tablas: 0, total_registros: 0 });

  constructor(
    private store: Store,
    private uiService: UiService,
    public appInfo: AppInfoService
  ) {}

  ngOnInit() {
    this.loadStats();
    // Recargar estadísticas reactivamente cuando cambie la lista de tablas en el Store
    this.store.select(selectTablas).subscribe(() => {
      this.loadStats();
    });
  }

  async loadStats() {
    try {
      const data = await invoke<GlobalStats>('get_global_stats');
      this.stats.set(data);
    } catch (error) {
      console.error('[SERA] Error al cargar estadísticas:', error);
    }
  }

  createNewTable() {
    this.uiService.triggerNewTable();
  }

  importExcel() {
    this.uiService.triggerImportExcel();
  }

  openAttachments() {
    this.uiService.triggerOpenAttachments();
  }
}
