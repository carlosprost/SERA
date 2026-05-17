import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { Store } from '@ngrx/store';
import { selectCampos, selectContenido } from '../../store/store.selectors';
import { combineLatest, filter, take, map } from 'rxjs';

@Component({
  selector: 'app-table-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    MatIconModule, 
    MatButtonModule, 
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    BaseChartDirective
  ],
  templateUrl: './table-dashboard.html',
  styleUrl: './table-dashboard.scss'
})
export class TableDashboardComponent implements OnChanges {
  @Input() tabla: string = '';

  selectedField: string = '';
  availableFields = signal<any[]>([]);
  cachedData: any[] = [];

  constructor(private store: Store) {}

  // Configuración de Gráfico de Torta
  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'right' },
    }
  };
  public pieChartData: ChartData<'pie', number[], string | string[]> = {
    labels: [],
    datasets: [{ data: [] }]
  };
  public pieChartType: ChartType = 'pie';

  // Configuración de Gráfico de Barras
  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { x: {}, y: { min: 0 } },
    plugins: {
      legend: { display: false }
    }
  };
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ data: [], label: 'Frecuencia', backgroundColor: '#2196f3' }]
  };
  public barChartType: ChartType = 'bar';

  showCharts = signal(false);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tabla'] && this.tabla) {
      this.loadAndAnalyze();
    }
  }

  loadAndAnalyze() {
    const tableLower = this.tabla.toLowerCase();
    combineLatest([
      this.store.select(selectCampos).pipe(map(m => m[tableLower] || [])),
      this.store.select(selectContenido).pipe(map(m => m[tableLower] || []))
    ]).pipe(
      filter(([campos, contenido]) => campos.length > 0 && contenido.length > 0),
      take(1)
    ).subscribe(([campos, contenido]) => {
      // Filtrar campos útiles para análisis (no IDs)
      const validFields = campos.filter((c: any) => c.Key !== 'PRI' && !c.Field.toLowerCase().includes('id'));
      this.availableFields.set(validFields);
      this.cachedData = contenido;

      // Si no hay campo seleccionado, tomamos el primero sugerido (ej: CATEGORIA o ESTADO)
      if (!this.selectedField || !validFields.find((f: any) => f.Field === this.selectedField)) {
        this.selectedField = validFields[0]?.Field || '';
      }

      this.updateAnalysis();
    });
  }

  updateAnalysis() {
    if (!this.selectedField || !this.cachedData.length) return;

    const counts: { [key: string]: number } = {};
    this.cachedData.forEach((row: any) => {
      const val = row[this.selectedField] || 'Vacío';
      counts[val] = (counts[val] || 0) + 1;
    });

    const sortedKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 10);
    
    this.pieChartData = {
      labels: sortedKeys,
      datasets: [{
        data: sortedKeys.map(k => counts[k]),
        backgroundColor: [
          '#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', 
          '#00bcd4', '#ffeb3b', '#795548', '#607d8b', '#e91e63'
        ]
      }]
    };

    this.barChartData = {
      labels: sortedKeys,
      datasets: [{
        data: sortedKeys.map(k => counts[k]),
        label: `Frecuencia: ${this.selectedField}`,
        backgroundColor: '#2196f3'
      }]
    };

    this.showCharts.set(true);
  }
}
