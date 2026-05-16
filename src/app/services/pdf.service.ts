import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

/**
 * Servicio de generación de PDF para SERA.
 * Encapsula la lógica de creación del documento PDF a partir
 * de los registros seleccionados en una tabla.
 *
 * Extraído de AppComponent siguiendo el principio de
 * Separación de Intereses (SoC) y el patrón Controller-Service.
 */
@Injectable({
  providedIn: 'root'
})
export class PdfService {

  /**
   * Genera y descarga un PDF con los registros seleccionados.
   *
   * @param contenedor - Elemento HTML div donde se renderiza la tabla temporal.
   * @param titulo - Título del documento PDF.
   * @param descripcion - Descripción o cuerpo introductorio del documento.
   * @param contenido - Array de registros seleccionados de la tabla.
   */
  async generarPdf(
    contenedor: HTMLDivElement | null,
    config: {
      titulo: string,
      descripcion: string,
      descripcion_post?: string,
      incluir_firma?: boolean,
      firma_texto?: string
    },
    contenido: any[]
  ): Promise<void> {
    let tempContainer = contenedor;
    let appended = false;
    if (!tempContainer) {
      tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      document.body.appendChild(tempContainer);
      appended = true;
    }
    this.construirContenidoHtml(tempContainer, config, contenido);
    await this.exportarComoPDF(tempContainer, config.titulo);
    if (appended && tempContainer) {
      document.body.removeChild(tempContainer);
    }
  }

  /**
   * Construye la estructura HTML de la tabla en el contenedor invisible.
   * Se aplican márgenes y estilos tipográficos según requerimientos:
   * Márgenes: Arriba 4cm, Izquierda 4cm, Abajo 2.5cm, Derecha 1.5cm.
   * Fuente: Arial, 12pt, Interlineado 1.5, Justificado.
   */
  private construirContenidoHtml(
    contenedor: HTMLDivElement,
    config: any,
    contenido: any[]
  ): void {
    contenedor.innerHTML = '';
    
    // Configuración del contenedor principal (Simula página A4 con sus márgenes)
    contenedor.style.width = '210mm';
    contenedor.style.minHeight = '297mm';
    contenedor.style.backgroundColor = 'white';
    contenedor.style.color = 'black';
    contenedor.style.boxSizing = 'border-box';
    contenedor.style.fontFamily = 'Arial, sans-serif';
    contenedor.style.fontSize = '12pt';
    contenedor.style.lineHeight = '1.5';
    // padding: arriba derecha abajo izquierda
    contenedor.style.padding = '4cm 1.5cm 2.5cm 4cm';

    // Título
    const tituloEl = this.crearElemento('h2', 'titulo', config.titulo || 'Reporte de SERA');
    tituloEl.style.textAlign = 'center';
    tituloEl.style.fontSize = '16pt'; // Un poco más grande que el cuerpo
    tituloEl.style.fontWeight = 'bold';
    tituloEl.style.marginBottom = '30px';
    contenedor.appendChild(tituloEl);

    // Descripción de Apertura
    if (config.descripcion) {
      const descripcionEl = this.crearElemento('p', 'descripcion', config.descripcion);
      descripcionEl.style.width = '100%';
      descripcionEl.style.textAlign = 'justify';
      descripcionEl.style.textIndent = '6cm'; // Sangría de párrafo solicitada
      descripcionEl.style.marginBottom = '20px';
      contenedor.appendChild(descripcionEl);
    }

    // Tabla
    const tabla = this.construirTablaHtml(contenido, config);
    tabla.style.marginBottom = '20px';
    tabla.style.fontSize = '10pt'; // Las tablas suelen usar fuente más pequeña para que quepan
    contenedor.appendChild(tabla);

    // Descripción Post-Tabla
    if (config.descripcion_post) {
      const descPostEl = this.crearElemento('p', 'descripcion-post', config.descripcion_post);
      descPostEl.style.width = '100%';
      descPostEl.style.textAlign = 'justify';
      descPostEl.style.textIndent = '6cm'; // Sangría de párrafo solicitada
      descPostEl.style.marginTop = '20px';
      contenedor.appendChild(descPostEl);
    }

    // Bloque de Firma
    if (config.incluir_firma) {
      const firmaContenedor = this.crearElemento('div');
      firmaContenedor.style.marginTop = '60px';
      firmaContenedor.style.width = '100%';
      firmaContenedor.style.display = 'flex';
      firmaContenedor.style.flexDirection = 'column';
      firmaContenedor.style.alignItems = 'center';

      const lineaFirma = this.crearElemento('div');
      lineaFirma.style.width = '250px';
      lineaFirma.style.borderTop = '1px solid black';
      lineaFirma.style.marginBottom = '10px';
      firmaContenedor.appendChild(lineaFirma);

      const textoFirma = this.crearElemento('span', '', config.firma_texto || 'Firma');
      textoFirma.style.fontSize = '12pt';
      textoFirma.style.fontWeight = 'bold';
      firmaContenedor.appendChild(textoFirma);

      contenedor.appendChild(firmaContenedor);
    }
  }

  /**
   * Construye la tabla HTML basada en el contenido y la configuración de columnas.
   */
  private construirTablaHtml(contenido: any[], config: any): HTMLTableElement {
    const tabla = this.crearElemento('table') as HTMLTableElement;
    tabla.style.width = '100%';
    tabla.style.borderCollapse = 'collapse';
    tabla.style.fontSize = '10px';
    tabla.style.color = 'black';

    // Definir las columnas a mostrar y su orden
    const headers = config.columnas && config.columnas.length > 0 
      ? config.columnas 
      : Object.keys(contenido[0]).filter(key => !key.toLowerCase().includes('id'));

    // Encabezado
    const thead = this.crearElemento('thead');
    const trHead = this.crearElemento('tr');
    headers.forEach((header: string) => {
      const displayHeader = header.replace(/_/g, ' '); // Reemplazar guiones por espacios
      const th = this.crearElemento('th', '', displayHeader);
      th.style.border = '1px solid #ddd';
      th.style.padding = '8px';
      th.style.backgroundColor = '#f2f2f2';
      th.style.textAlign = 'left';
      th.style.textTransform = 'capitalize';
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    tabla.appendChild(thead);

    // Cuerpo
    const tbody = this.crearElemento('tbody');
    contenido.forEach((row) => {
      const tr = this.crearElemento('tr');
      headers.forEach((header: string) => {
        const td = this.crearElemento('td', '', row[header]?.toString() || '');
        td.style.border = '1px solid #ddd';
        td.style.padding = '8px';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);

    return tabla;
  }

  /**
   * Crea un elemento HTML con estilos opcionales de tabla.
   *
   * @param tag - Tag HTML a crear.
   * @param clase - Clase CSS opcional.
   * @param contenido - Contenido de texto opcional.
   */
  private crearElemento(tag: string, clase: string = '', contenido: string = ''): HTMLElement {
    const el = document.createElement(tag);
    if (tag === 'th' || tag === 'td') {
      el.style.border = '1px solid black';
      el.style.padding = '8px';
    }
    if (tag === 'th') {
      el.style.fontWeight = 'bold';
      el.style.textAlign = 'left';
    }
    if (clase) el.classList.add(clase);
    if (contenido) el.textContent = contenido;
    return el;
  }

  /**
   * Captura el contenedor HTML como canvas y lo exporta como PDF A4.
   * Utiliza las APIs nativas de Tauri v2 para el guardado.
   */
  private async exportarComoPDF(contenedor: HTMLDivElement, titulo: string): Promise<void> {
    try {
      const canvas = await html2canvas(contenedor, { scale: 2 });
      const imgWidth = 210;   // Ancho A4 en mm
      const pageHeight = 297; // Alto A4 en mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      const pdf = new jsPDF('p', 'mm', 'a4');
      let position = 0;

      pdf.addImage(canvas, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // 1. Obtener los bytes del PDF
      const pdfArrayBuffer = pdf.output('arraybuffer');
      const pdfUint8Array = new Uint8Array(pdfArrayBuffer);

      // 2. Limpiar el nombre del archivo basado en el título
      const nombreSugerido = titulo 
        ? `${titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`
        : 'Reporte_SERA.pdf';

      // 3. Abrir diálogo nativo de guardado
      const rutaSeleccionada = await save({
        filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
        defaultPath: nombreSugerido
      });

      // 4. Si el usuario seleccionó una ruta, guardar el archivo
      if (rutaSeleccionada) {
        await writeFile(rutaSeleccionada, pdfUint8Array);
        console.log(`[SERA] Reporte guardado exitosamente en: ${rutaSeleccionada}`);
      } else {
        console.log('[SERA] El usuario canceló la operación de guardado.');
      }
    } catch (error: any) {
      console.error('[SERA] Error al generar o guardar el PDF:', error.message);
    }
  }
}
