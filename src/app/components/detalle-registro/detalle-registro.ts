import { Component, Inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../shared/material.module';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

// Importación específica para evitar errores de compilador
import * as pdfjsLib from 'pdfjs-dist';

// Configurar el worker usando un CDN estable (v3)
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

@Component({
  selector: 'app-detalle-registro',
  standalone: true,
  imports: [CommonModule, MaterialModule, DatePipe],
  template: `
    <div class="detalle-container">
      <div class="header">
        <div class="title-group">
          <mat-icon color="primary">description</mat-icon>
          <h2>Detalle del Registro</h2>
        </div>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="content">
        <div class="data-grid-container">
          <div class="data-grid">
            @for (campo of campos; track campo.Field) {
              @if (campo.Field !== 'id_' + data.tabla && campo.Field !== 'sera_adjuntos_count') {
                <div class="data-item">
                  <span class="label">{{ campo.Field.split('_').join(' ') | uppercase }}</span>
                  <span class="value">{{ formatValue(campo.Field, data.row[campo.Field]) }}</span>
                </div>
              }
            }
          </div>

          <!-- SECCIÓN DE DETALLES DE VÍNCULOS EN OTRA LÍNEA -->
          @if (linkedDataDetails.length > 0) {
            <div class="linked-details-section">
              <h3 class="section-title">
                <mat-icon>hub</mat-icon> Información Vinculada
              </h3>
              <div class="linked-cards-container">
                @for (detail of linkedDataDetails; track detail.title) {
                  <div class="linked-detail-card">
                    <div class="card-header">
                      <span class="link-badge">VÍNCULO</span>
                      <h4>{{ detail.title }}</h4>
                    </div>
                    <div class="card-content-grid">
                      @for (f of detail.fields; track f.field) {
                        <div class="sub-data-item">
                          <span class="sub-label">{{ f.label }}</span>
                          <span class="sub-value">{{ f.value }}</span>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <mat-divider vertical></mat-divider>

        <div class="attachments-side">
          <h3>
            <mat-icon>attach_file</mat-icon>
            Archivos Adjuntos ({{ adjuntos.length }})
          </h3>

          <div class="attachments-gallery">
            @if (adjuntos.length === 0) {
              <div class="no-adj">No hay archivos vinculados</div>
            } @else {
              @for (adj of adjuntos; track adj.id) {
                <div class="adj-card">
                  <div class="preview-box" (click)="abrirAdjunto(adj.ruta)">
                      <img [src]="adj.base64 || ''" alt="preview" *ngIf="adj.base64">
                      <div class="loader-container" *ngIf="!adj.base64 && (esImagen(adj.nombre) || esPDF(adj.nombre))">
                        <mat-spinner diameter="20"></mat-spinner>
                        <span *ngIf="esPDF(adj.nombre)">Renderizando PDF...</span>
                      </div>
                      <div class="generic-icon" *ngIf="!adj.base64 && !esImagen(adj.nombre) && !esPDF(adj.nombre)">
                        <mat-icon>insert_drive_file</mat-icon>
                        <span>{{ adj.nombre.split('.').pop() | uppercase }}</span>
                      </div>
                    <div class="overlay">
                      <mat-icon>zoom_in</mat-icon>
                    </div>
                  </div>
                  <div class="adj-info">
                    <span class="adj-name" [matTooltip]="adj.nombre">{{ adj.nombre }}</span>
                    <span class="adj-date">{{ adj.fecha | date:'dd/MM/yy HH:mm' }}</span>
                  </div>
                </div>
              }
            }
          </div>
        </div>
      </div>

      <div class="footer">
        <button mat-button (click)="close()">Cerrar</button>
        <button mat-flat-button color="primary" (click)="editar()">
          <mat-icon>edit</mat-icon>
          Actualizar Registro
        </button>
      </div>
    </div>
  `,
  styles: [`
    .detalle-container {
      background: var(--sera-bg-color);
      color: var(--sera-text-color);
      padding: 0;
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .header {
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(var(--sera-text-rgb), 0.03);
      border-bottom: 1px solid rgba(var(--sera-text-rgb), 0.1);

      .title-group {
        display: flex;
        align-items: center;
        gap: 12px;
        h2 { margin: 0; font-size: 1.2rem; font-weight: 500; letter-spacing: 0.5px; }
      }
    }

    .content {
      display: flex;
      flex: 1;
      overflow: hidden;
      background: var(--sera-bg-color);
    }

    .data-grid-container {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding: 32px;
    }

    .data-grid {
      display: flex;
      flex-flow: row wrap;
      align-content: flex-start;
      gap: 16px;
    }

    .data-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 14px;
      background: rgba(255,255,255,0.03);
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.05);
      flex: 0 1 auto;
      min-width: 120px;

      .label {
        font-size: 11px;
        color: var(--sera-primary-color);
        font-weight: 700;
        letter-spacing: 1.2px;
      }

      .value {
        font-size: 15px;
        color: var(--sera-text-color);
      }
    }

    .linked-details-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 16px;
      animation: fadeIn 0.3s ease-out;

      .section-title {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--sera-primary-color);
        opacity: 0.9;
        
        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      .linked-cards-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .linked-detail-card {
        background: rgba(var(--sera-primary-rgb, 33, 150, 243), 0.02);
        border: 1px solid rgba(var(--sera-primary-rgb, 33, 150, 243), 0.1);
        border-radius: 12px;
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

        .card-header {
          display: flex;
          align-items: center;
          gap: 10px;

          .link-badge {
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.8px;
            background: var(--sera-primary-color);
            color: #fff;
            padding: 2px 6px;
            border-radius: 4px;
          }

          h4 {
            margin: 0;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.5px;
            color: var(--sera-text-color);
          }
        }

        .card-content-grid {
          display: flex;
          flex-flow: row wrap;
          gap: 14px;
          background: rgba(0, 0, 0, 0.15);
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.03);
        }

        .sub-data-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 110px;
          flex: 1 1 auto;

          .sub-label {
            font-size: 10px;
            color: var(--sera-text-color);
            opacity: 0.5;
            font-weight: 700;
            letter-spacing: 1px;
          }

          .sub-value {
            font-size: 13px;
            color: var(--sera-text-color);
            font-weight: 500;
          }
        }
      }
    }

    .attachments-side {
      width: 450px;
      padding: 32px;
      background: rgba(255,255,255,0.03);
      border-left: 1px solid rgba(255,255,255,0.1);
      display: flex;
      flex-direction: column;
      overflow: hidden;

      h3 {
        margin: 0 0 24px 0;
        font-size: 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--sera-text-color);
        mat-icon { color: var(--sera-primary-color); }
      }
    }

    .attachments-gallery {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .adj-card {
      background: rgba(255,255,255,0.02);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.08);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        border-color: #3498db;
        background: rgba(255,255,255,0.05);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
    }

    .preview-box {
      height: 140px;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      overflow: hidden;

      img { width: 100%; height: 100%; object-fit: cover; }

      .pdf-icon, .generic-icon, .loader-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: #7f8c8d;
        mat-icon { font-size: 40px; width: 40px; height: 40px; }
        span { font-size: 12px; font-weight: 600; }
      }

      .loader-container {
        color: #3498db;
        span { margin-top: 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
      }

      .overlay {
        position: absolute;
        inset: 0;
        background: rgba(52, 152, 219, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s;
        mat-icon { color: white; font-size: 32px; width: 32px; height: 32px; }
      }

      &:hover .overlay { opacity: 1; }
    }

    .adj-info {
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;

      .adj-name {
        font-size: 12px;
        color: #ecf0f1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .adj-date {
        font-size: 10px;
        color: #7f8c8d;
      }
    }

    .no-adj {
      color: #7f8c8d;
      font-style: italic;
      text-align: center;
      padding-top: 40px;
    }

    .footer {
      padding: 16px 24px;
      background: rgba(255,255,255,0.02);
      border-top: 1px solid rgba(255,255,255,0.1);
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DetalleRegistroComponent implements OnInit {
  campos: any[] = [];
  adjuntos: any[] = [];
  
  linkedFields: any[] = [];
  linkedDataDetails: any[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { tabla: string, row: any },
    private dialogRef: MatDialogRef<DetalleRegistroComponent>,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  async ngOnInit() {
    await this.cargarCampos();
    await this.cargarDatosVinculados();
    await this.cargarAdjuntos();
  }

  async cargarCampos() {
    try {
      this.campos = await invoke('get_campos', { tabla: this.data.tabla });
      this.cdr.detectChanges();
    } catch (e) {
      console.error(e);
    }
  }

  async cargarDatosVinculados() {
    try {
      const configJson: string = await invoke('get_tabla_config', { nombreTabla: this.data.tabla });
      if (configJson && configJson.trim() !== '' && configJson !== '{}') {
        const config = JSON.parse(configJson);
        this.linkedFields = config.linkedFields || [];
      } else {
        this.linkedFields = [];
      }

      this.linkedDataDetails = [];

      for (const link of this.linkedFields) {
        const localValue = this.data.row[link.localField];
        if (localValue === undefined || localValue === null || localValue === '') {
          continue;
        }

        try {
          // Obtener campos de la tabla remota
          const remoteFields: any[] = await invoke('get_campos', { tabla: link.remoteTable });
          // Obtener todos los registros de la tabla remota
          const remoteData: any[] = await invoke('get_contenido', { tabla: link.remoteTable });

          // Filtrar campos útiles (excluyendo IDs primarios/foráneos y campos del sistema)
          const validRemoteFields = remoteFields.filter((cf: any) => 
            cf.Key !== 'PRI' && 
            !cf.Field.toLowerCase().includes('id') && 
            !cf.Field.toLowerCase().startsWith('sera_')
          );

          // Buscar el registro coincidente en la tabla remota
          const matchedRow = remoteData.find(row => String(row[link.remoteField]) === String(localValue));
          if (!matchedRow) continue;

          // Valor a mostrar principal
          const mainDisplayVal = String(matchedRow[link.displayField] || matchedRow[validRemoteFields[0]?.Field] || localValue);

          // Actualizar el valor en la fila actual para que la grilla principal del detalle lo muestre traducido
          this.data.row = {
            ...this.data.row,
            [link.localField]: mainDisplayVal
          };

          // Si la tabla remota tiene más de 1 columna de contenido útil, mostramos sección dedicada
          if (validRemoteFields.length > 1) {
            const extraDataList = validRemoteFields.map(f => ({
              field: f.Field,
              label: f.Field.split('_').join(' ').toUpperCase(),
              value: matchedRow[f.Field] || '-'
            }));

            this.linkedDataDetails.push({
              title: link.localField.split('_').join(' ').toUpperCase(),
              mainValue: mainDisplayVal,
              fields: extraDataList
            });
          }
        } catch (err) {
          console.error(`Error procesando vínculo para campo ${link.localField}:`, err);
        }
      }

      this.cdr.detectChanges();
    } catch (e) {
      console.error("Error al cargar vínculos en detalle:", e);
    }
  }

  async cargarAdjuntos() {
    try {
      const idStr = this.data.row['id_' + this.data.tabla];
      const res: any[] = await invoke('get_adjuntos', { 
        tabla: this.data.tabla, 
        registroId: parseInt(idStr) 
      });
      
      this.adjuntos = res.map(a => ({ ...a, base64: null }));
      this.cdr.detectChanges();

      // Cargar Base64 para imágenes y miniaturas de PDF
      for (let adj of this.adjuntos) {
        if (this.esImagen(adj.nombre)) {
          try {
            const rawBase64: string = await invoke('get_adjunto_base64', { rutaRelativa: adj.ruta });
            // Rust ya devuelve el data:image/...;base64,... completo
            adj.base64 = this.sanitizer.bypassSecurityTrustResourceUrl(rawBase64);
            this.cdr.detectChanges();
          } catch (err) {
            console.error("Error cargando base64 para", adj.nombre, err);
          }
        } else if (this.esPDF(adj.nombre)) {
          try {
            const rawBase64: string = await invoke('get_adjunto_base64', { rutaRelativa: adj.ruta });
            // Generar miniatura pasándole el string base64 completo
            const thumb = await this.generarThumbnailPDF(rawBase64);
            adj.base64 = this.sanitizer.bypassSecurityTrustResourceUrl(thumb as string);
            this.cdr.detectChanges();
          } catch (err) {
            console.error("Error generando miniatura PDF para", adj.nombre, err);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  getAssetUrl(rutaAbsoluta: string): SafeUrl {
    if (!rutaAbsoluta) return '';
    
    // 1. Limpiar prefijo de ruta larga de Windows
    let cleanPath = rutaAbsoluta.replace(/^\\\\\?\\/, '');
    
    // 2. Normalizar barras para que parezca una URL
    cleanPath = cleanPath.replace(/\\/g, '/');

    // 3. Convertir a asset URL usando Tauri
    const url = convertFileSrc(cleanPath);
    
    console.log("[SERA] Path Final:", cleanPath);
    console.log("[SERA] Asset URL:", url);
    
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  async generarThumbnailPDF(base64: string): Promise<string> {
    try {
      const binaryString = atob(base64.split(',')[1]);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const loadingTask = pdfjsLib.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      
      const viewport = page.getViewport({ scale: 0.4 }); // Escala un poco más chica para la miniatura
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        const dataUrl = canvas.toDataURL();
        
        // Liberar memoria del PDF
        pdf.destroy();
        
        return dataUrl;
      }
    } catch (err) {
      console.error("Error crítico renderizando PDF:", err);
    }
    return '';
  }

  esImagen(nombre: string) {
    const ext = nombre.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '');
  }

  esPDF(nombre: string) {
    return nombre.toLowerCase().endsWith('.pdf');
  }

  async abrirAdjunto(ruta: string) {
    try {
      await invoke('abrir_adjunto', { rutaRelativa: ruta });
    } catch (e) {
      console.error(e);
    }
  }

  editar() {
    this.dialogRef.close({ action: 'edit' });
  }

  close() {
    this.dialogRef.close();
  }

  formatValue(field: string, value: any): string {
    if (value === undefined || value === null || value === '') return '-';
    
    // Auto-detección de fechas ISO (YYYY-MM-DD o YYYY-MM-DD HH:MM:SS) para formateo visual.
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const datePart = value.split(' ')[0];
      const parts = datePart.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    return value;
  }
}
