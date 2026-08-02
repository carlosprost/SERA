import { Component, Inject, inject, signal, computed } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { PdfService } from "../../services/pdf.service";
import { MatButtonModule } from "@angular/material/button";
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatTabsModule } from "@angular/material/tabs";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatIconModule } from "@angular/material/icon";
import { MatListModule } from "@angular/material/list";
import { MatSelectModule } from "@angular/material/select";
import { MatTooltipModule } from "@angular/material/tooltip";
import { CdkDragDrop, DragDropModule, moveItemInArray } from "@angular/cdk/drag-drop";
import { CommonModule } from "@angular/common";
import { Store } from "@ngrx/store";
import { selectConfigData } from "../../store/store.selectors";
import { take, filter } from "rxjs";
import { invoke } from "@tauri-apps/api/core";
import {
  AVAILABLE_PDF_FONTS,
  DEFAULT_PDF_TABLE_STYLE,
  PDF_TABLE_PRESETS,
  PdfTableBorder,
  PdfTableFontSize,
  PdfTablePreset,
  PdfTableStyle
} from "../../interfaces/pdf-styles.interfaces";

@Component({
  selector: "app-recibo",
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    ReactiveFormsModule,
    FormsModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatCheckboxModule,
    MatIconModule,
    MatListModule,
    MatSelectModule,
    MatTooltipModule,
    DragDropModule
  ],
  templateUrl: "./recibo.component.html",
  styleUrl: "./recibo.component.scss",
})
export class ReciboComponent {
  fb = inject(FormBuilder);
  pdfService = inject(PdfService);
  snackBar = inject(MatSnackBar);
  store = inject(Store);

  formularioRecibo!: FormGroup;
  
  /** Señal reactiva para indicar si se está generando el reporte. */
  generando = signal(false);

  /** Lista de configuración de columnas: nombre y si está seleccionada. */
  camposConfig: { nombre: string, seleccionado: boolean }[] = [];

  /** Colección de presets de estilo tipo Excel. */
  readonly presets: PdfTablePreset[] = PDF_TABLE_PRESETS;
  
  /** Fuentes disponibles para renderizar tablas en el PDF. */
  readonly fuentesDisponibles = AVAILABLE_PDF_FONTS;

  /** Filtro de categoría de presets seleccionado en la galería. */
  categoriaSeleccionada = signal<'todos' | 'medio' | 'claro' | 'oscuro' | 'minimal'>('todos');

  /** Configuración reactiva del estilo visual de la tabla. */
  estiloTabla = signal<PdfTableStyle>({ ...DEFAULT_PDF_TABLE_STYLE });

  /** Presets filtrados según la categoría seleccionada. */
  presetsFiltrados = computed(() => {
    const cat = this.categoriaSeleccionada();
    if (cat === 'todos') {
      return this.presets;
    }
    return this.presets.filter(p => p.categoria === cat);
  });

  constructor(
    public dialogRef: MatDialogRef<ReciboComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { message: string, campos: string[], datos: any[] }
  ) {
    // Pre-cargar el nombre del operador en el campo de firma para agilizar la generación.
    // Usamos filter para evitar capturar el estado inicial vacío antes de que el store se hidrate.
    this.store.select(selectConfigData)
      .pipe(
        filter(config => config !== null && config !== undefined),
        take(1)
      )
      .subscribe(config => {
        const nombreOperador = config?.user?.nombre || '';
        this.createForm(nombreOperador);
        this.initCampos();
      });
  }

  initCampos() {
    if (this.data.campos) {
      this.camposConfig = this.data.campos
        .filter(c => c !== 'sera_adjuntos_count')
        .map(c => ({ nombre: c, seleccionado: true }));
    }
  }

  /** @param nombreFirma - Se pre-carga con el nombre del operador configurado en el perfil. */
  createForm(nombreFirma: string = ''){
    this.formularioRecibo = this.fb.group({
      titulo: [''],
      descripcion: [''],
      descripcion_post: [''],
      incluir_membrete: [true],
      incluir_firma: [false],
      firma_texto: [nombreFirma]
    })
  }

  /** Maneja el reordenamiento de los campos mediante Drag & Drop. */
  drop(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.camposConfig, event.previousIndex, event.currentIndex);
  }

  /** Aplica un preset preconfigurado de la galería. */
  seleccionarPreset(preset: PdfTablePreset) {
    this.estiloTabla.set({ ...preset.style });
  }

  /** Actualiza un atributo específico del estilo de la tabla. */
  actualizarEstilo<K extends keyof PdfTableStyle>(campo: K, valor: PdfTableStyle[K]) {
    this.estiloTabla.update(prev => ({
      ...prev,
      [campo]: valor,
      presetId: 'custom'
    }));
  }

  /** Obtiene las columnas para la vista previa en vivo (máximo 4 columnas). */
  getLivePreviewHeaders(): string[] {
    const seleccionados = this.camposConfig.filter(c => c.seleccionado).map(c => c.nombre);
    if (seleccionados.length > 0) {
      return seleccionados.slice(0, 4);
    }
    return ['Item', 'Descripción', 'Categoría', 'Estado'];
  }

  /** Obtiene registros de muestra para la vista previa en vivo. */
  getLivePreviewRows(): any[] {
    const headers = this.getLivePreviewHeaders();
    if (this.data.datos && this.data.datos.length > 0) {
      return this.data.datos.slice(0, 3).map(row => {
        const item: any = {};
        headers.forEach(h => {
          item[h] = row[h] !== undefined && row[h] !== null ? String(row[h]) : '-';
        });
        return item;
      });
    }
    return [
      { 'Item': '001', 'Descripción': 'Expediente Principal', 'Categoría': 'Judicial', 'Estado': 'Activo' },
      { 'Item': '002', 'Descripción': 'Informe Pericial', 'Categoría': 'Técnico', 'Estado': 'Pendiente' },
      { 'Item': '003', 'Descripción': 'Oficio Notarial', 'Categoría': 'Administrativo', 'Estado': 'Finalizado' }
    ];
  }

  async save() {
    const result = {
      ...this.formularioRecibo.value,
      columnas: this.camposConfig
        .filter(c => c.seleccionado)
        .map(c => c.nombre),
      estilo_tabla: this.estiloTabla()
    };

    this.generando.set(true);

    try {
      // Leer nombre y ruta del logo del perfil del operador desde el store.
      // Filtramos el estado inicial vacío para asegurar leer el config real persistido.
      const config = await new Promise<any>(resolve => {
        this.store.select(selectConfigData)
          .pipe(
            filter(c => c !== null && c !== undefined),
            take(1)
          )
          .subscribe(resolve);
      });

      let logo_base64: string | undefined;
      let nombre_operador: string | undefined;

      // Solo cargar logo y nombre si el usuario optó por incluir el membrete
      if (result.incluir_membrete) {
        const membretePath = config?.user?.membrete;
        nombre_operador = config?.user?.nombre || undefined;

        if (membretePath) {
          try {
            logo_base64 = await invoke<string>('get_logo_membrete_base64', { rutaRelativa: membretePath });
          } catch {
            // Si falla la carga del logo, el reporte se genera igual sin imagen
          }
        } else {
          // Intentar auto-detectar logo existente en disco aunque BD esté vacía
          try {
            const rutaDetectada = await invoke<string>('detectar_logo_membrete');
            logo_base64 = await invoke<string>('get_logo_membrete_base64', { rutaRelativa: rutaDetectada });
          } catch {
            // No hay logo, continuar sin él
          }
        }
      }

      const success = await this.pdfService.generarPdf(
        null,
        { ...result, logo_base64, nombre_operador },
        this.data.datos
      );

      if (success) {
        this.snackBar.open("Documento PDF generado correctamente", "", { duration: 3000 });
        this.dialogRef.close(result);
      }
      // Si fue falso, el usuario canceló, por lo que no cerramos el diálogo y vuelve a mostrar el formulario
    } catch (error) {
      console.error("[SERA] Error generando reporte PDF:", error);
      this.snackBar.open("Error al generar el documento PDF", "Cerrar", { duration: 5000 });
    } finally {
      this.generando.set(false);
    }
  }
}

