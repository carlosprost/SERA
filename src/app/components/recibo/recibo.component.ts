import { Component, Inject, inject, signal } from "@angular/core";
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
import { CdkDragDrop, DragDropModule, moveItemInArray } from "@angular/cdk/drag-drop";
import { CommonModule } from "@angular/common";
import { Store } from "@ngrx/store";
import { selectConfigData } from "../../store/store.selectors";
import { take, filter } from "rxjs";
import { invoke } from "@tauri-apps/api/core";

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
      this.camposConfig = this.data.campos.map(c => ({ nombre: c, seleccionado: true }));
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

  async save() {
    const result = {
      ...this.formularioRecibo.value,
      columnas: this.camposConfig
        .filter(c => c.seleccionado)
        .map(c => c.nombre)
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

      await this.pdfService.generarPdf(
        null,
        { ...result, logo_base64, nombre_operador },
        this.data.datos
      );

      this.snackBar.open("Documento PDF generado correctamente", "", { duration: 3000 });
      this.dialogRef.close(result);
    } catch (error) {
      console.error("[SERA] Error generando reporte PDF:", error);
      this.snackBar.open("Error al generar el documento PDF", "Cerrar", { duration: 5000 });
    } finally {
      this.generando.set(false);
    }
  }
}
