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

  analysisMode: 'frequency' | 'aggregation' = 'frequency';

  selectedField: string = '';
  availableFields = signal<any[]>([]);
  categoricalFields = signal<any[]>([]);
  numericFields = signal<any[]>([]);
  cachedData: any[] = [];

  // Configuración de Agregaciones
  selectedCategoryField: string = '';
  selectedMetricField: string = '';
  selectedOperation: 'sum' | 'avg' = 'sum';

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
      legend: { display: true, position: 'top' }
    }
  };
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ data: [], label: 'Registros', backgroundColor: '#2196f3' }]
  };
  public barChartType: ChartType = 'bar';

  showCharts = signal(false);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tabla'] && this.tabla) {
      this.loadAndAnalyze();
    }
  }

  setAnalysisMode(mode: 'frequency' | 'aggregation') {
    this.analysisMode = mode;
    this.updateAnalysis();
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
      // Filtrar campos útiles para análisis (no IDs ni campos del sistema)
      const validFields = campos.filter((c: any) => 
        c.Key !== 'PRI' && 
        !c.Field.toLowerCase().includes('id') && 
        !c.Field.toLowerCase().startsWith('sera_')
      );
      this.availableFields.set(validFields);
      this.cachedData = contenido;

      // Detectar campos numéricos
      const nums = validFields.filter((c: any) => {
        const typeLower = (c.Type || '').toLowerCase();
        if (typeLower.includes('int') || typeLower.includes('real') || typeLower.includes('num') || typeLower.includes('double') || typeLower.includes('float')) {
          return true;
        }
        // Fallback: verificar si los primeros registros válidos contienen números
        const sampleRow = contenido.find((row: any) => row[c.Field] !== undefined && row[c.Field] !== null && row[c.Field] !== '');
        if (sampleRow) {
          const val = sampleRow[c.Field];
          return !isNaN(Number(val));
        }
        return false;
      });
      this.numericFields.set(nums);

      // Los campos categóricos serán los que no son numéricos, o todos si no hay numéricos
      const cats = validFields.filter((c: any) => !nums.some((nf: any) => nf.Field === c.Field));
      this.categoricalFields.set(cats.length > 0 ? cats : validFields);

      // Valores por defecto inteligentes
      if (!this.selectedField || !validFields.some((f: any) => f.Field === this.selectedField)) {
        this.selectedField = this.categoricalFields()[0]?.Field || validFields[0]?.Field || '';
      }

      if (!this.selectedCategoryField || !this.categoricalFields().some(f => f.Field === this.selectedCategoryField)) {
        this.selectedCategoryField = this.categoricalFields()[0]?.Field || validFields[0]?.Field || '';
      }

      if (!this.selectedMetricField || !this.numericFields().some(f => f.Field === this.selectedMetricField)) {
        this.selectedMetricField = this.numericFields()[0]?.Field || '';
      }

      // Si no hay campos numéricos, forzar modo frecuencia
      if (nums.length === 0) {
        this.analysisMode = 'frequency';
      }

      this.updateAnalysis();
    });
  }

  updateAnalysis() {
    if (!this.cachedData.length) return;

    if (this.analysisMode === 'frequency') {
      if (!this.selectedField) return;

      const counts: { [key: string]: number } = {};
      this.cachedData.forEach((row: any) => {
        const val = row[this.selectedField] || 'Vacío';
        counts[val] = (counts[val] || 0) + 1;
      });

      const sortedKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 10);
      const chartValues = sortedKeys.map(k => counts[k]);

      this.pieChartData = {
        labels: sortedKeys,
        datasets: [{
          data: chartValues,
          backgroundColor: [
            '#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', 
            '#00bcd4', '#ffeb3b', '#795548', '#607d8b', '#e91e63'
          ]
        }]
      };

      this.barChartData = {
        labels: sortedKeys,
        datasets: [{
          data: chartValues,
          label: `Cantidad de Expedientes por ${this.selectedField}`,
          backgroundColor: '#2196f3'
        }]
      };
    } 
    else if (this.analysisMode === 'aggregation') {
      if (!this.selectedCategoryField || !this.selectedMetricField) return;

      const groupData: { [key: string]: { sum: number; count: number } } = {};
      this.cachedData.forEach((row: any) => {
        const catVal = row[this.selectedCategoryField] || 'Vacío';
        const metricVal = Number(row[this.selectedMetricField]);
        const numVal = isNaN(metricVal) ? 0 : metricVal;

        if (!groupData[catVal]) {
          groupData[catVal] = { sum: 0, count: 0 };
        }
        groupData[catVal].sum += numVal;
        groupData[catVal].count += 1;
      });

      const sortedKeys = Object.keys(groupData).sort((a, b) => groupData[b].sum - groupData[a].sum).slice(0, 10);
      const chartValues = sortedKeys.map(k => {
        if (this.selectedOperation === 'avg') {
          const count = groupData[k].count;
          return count > 0 ? parseFloat((groupData[k].sum / count).toFixed(2)) : 0;
        }
        return groupData[k].sum;
      });

      const opLabel = this.selectedOperation === 'sum' ? 'Suma Total' : 'Promedio';

      this.pieChartData = {
        labels: sortedKeys,
        datasets: [{
          data: chartValues,
          backgroundColor: [
            '#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', 
            '#00bcd4', '#ffeb3b', '#795548', '#607d8b', '#e91e63'
          ]
        }]
      };

      this.barChartData = {
        labels: sortedKeys,
        datasets: [{
          data: chartValues,
          label: `${opLabel} de ${this.selectedMetricField} por ${this.selectedCategoryField}`,
          backgroundColor: '#00bcd4'
        }]
      };
    }

    this.showCharts.set(true);
  }
}
