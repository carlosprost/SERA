import { Component, ElementRef, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterOutlet } from "@angular/router";
import { invoke } from "@tauri-apps/api/tauri";
import { SelectionModel } from "@angular/cdk/collections";
import { FormControl } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTabChangeEvent, MatTabsModule } from "@angular/material/tabs";
import { Store } from "@ngrx/store";
import { Observable } from "rxjs";
import { ConfigData } from "./interfaces/configData.interfaces";
import { Tablas } from "./interfaces/tablas.interfaces";
import { StoreActions } from "./store/store.actions";
import { selectConfigData, selectTablas } from "./store/store.selectors";
import { DialogDeleteComponent } from "./components/dialog-delete/dialog-delete.component";
import { FormNewTableComponent } from "./components/form-new-table/form-new-table.component";
import { FormularioRegistroComponent } from "./components/formulario-registro/formulario-registro.component";
import { TableComponent } from "./components/table/table.component";
import { ToolbarComponent } from "./components/toolbar/toolbar.component";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatMenuModule } from "@angular/material/menu";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { ReciboComponent } from "./components/recibo/recibo.component";
import { MatFormFieldModule } from "@angular/material/form-field";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatSidenavModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    MatTabsModule,
    MatFormFieldModule,
    TableComponent,
    ToolbarComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
})
export class AppComponent {
  configData: Observable<ConfigData>;
  tablas: Observable<Tablas[]>;

  tabs: string[] = [];
  selected = new FormControl(0);
  elementos: SelectionModel<any> = new SelectionModel<any>(true, []);

  @ViewChild("pdf") elementPDF!: ElementRef<HTMLDivElement>;

  constructor(
    private store: Store,
    public dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.store.dispatch(StoreActions.loadStores());
    this.store.dispatch(StoreActions.loadListadoTablas());
    this.configData = this.store.select(selectConfigData);
    this.tablas = this.store.select(selectTablas);
  }

  selectTab(event: MatTabChangeEvent) {
    this.store.dispatch(
      StoreActions.loadCampos({ tabla: this.tabs[event.index] })
    );
    this.store.dispatch(
      StoreActions.loadContenido({ tabla: this.tabs[event.index] })
    );
  }

  addTab(tabName: string) {
    if (!this.tabs.includes(tabName)) {
      this.tabs.push(tabName);
      this.selected.setValue(this.tabs.length - 1);
      this.store.dispatch(
        StoreActions.loadCampos({
          tabla: this.tabs[this.selected.value ? this.selected.value : 0],
        })
      );
      this.store.dispatch(
        StoreActions.loadContenido({
          tabla: this.tabs[this.selected.value ? this.selected.value : 0],
        })
      );
    }
  }

  removeTab(index: number) {
    this.tabs.splice(index, 1);
    this.selected.setValue(index);
    if (index >= 1) {
      this.store.dispatch(
        StoreActions.loadCampos({ tabla: this.tabs[index - 1] })
      );
      this.store.dispatch(
        StoreActions.loadContenido({ tabla: this.tabs[index - 1] })
      );
    } else if (index === 0 && this.tabs.length > 0) {
      this.store.dispatch(StoreActions.loadCampos({ tabla: this.tabs[index] }));
      this.store.dispatch(
        StoreActions.loadContenido({ tabla: this.tabs[index] })
      );
    }
  }

  elementosSeleccionados(elementos: SelectionModel<any>) {
    this.elementos = elementos;
  }

  mostrarElementosSeleccionados() {
    //this.elementos.clear();
    
    
  }

  openDialogRecibo(){
    const dialogRef = this.dialog.open(ReciboComponent, {
      width: "500px",
      data: { message: "Crear nuevo Recibo" },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        new PDF(this.elementPDF.nativeElement, result.titulo, result.descripcion, this.elementos.selected);
        this.snackBar.open("Recibo creado correctamente", "", {
          duration: 3000,
        });
      }
    });
  }

  openDialogNuevaTabla() {
    const dialogRef = this.dialog.open(FormNewTableComponent, {
      width: "500px",
      data: { message: "Crear nueva Tabla" },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.snackBar.open("Tabla creada correctamente", "", {
          duration: 3000,
        });
        this.store.dispatch(StoreActions.loadListadoTablas());
      }
    });
  }

  openDialogNuevoRegistro() {
    const dialogRef = this.dialog.open(FormularioRegistroComponent, {
      width: "500px",
      data: {
        message: "Crear nuevo Registro",
        tabla: this.tabs[this.selected.value ? this.selected.value : 0],
        upload: false,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.snackBar.open("Nuevo Registro Creado", "", { duration: 3000 });
        this.store.dispatch(
          StoreActions.loadContenido({
            tabla: this.tabs[this.selected.value ? this.selected.value : 0],
          })
        );
      }
    });
  }

  eliminarTabla(nombre_tabla: string) {
    const dialogRef = this.dialog.open(DialogDeleteComponent, {
      width: "250px",
      data: {
        title: "¿Seguro que desea eliminar la tabla?",
        message: "Perdera todos los datos de los registros.",
        tabla: nombre_tabla,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.store.dispatch(StoreActions.loadListadoTablas());
      }
    });
  }
}

class PDF {
  titulo: string;
  descripcion: string;
  contenido: any;
  contenedor: HTMLDivElement;

  constructor(contendedor: HTMLDivElement, titulo: string, descripcion:string, contenido: any) {
    this.contenedor = contendedor;
    this.titulo = titulo;
    this.descripcion = descripcion;
    this.contenido = contenido;

    this.crearTabla();
  }

  crearTabla() {
    this.contenedor.innerHTML = "";

    const titulo = this.crearElemento('h2', 'titulo', `${this.titulo}`);
    titulo.style.textAlign = 'center';
    titulo.style.fontSize = '24px';
    titulo.style.fontWeight = 'bold';
    titulo.style.color = 'black';
    this.contenedor.appendChild(titulo);

    const descripcion = this.crearElemento('p', 'descripcion', `${this.descripcion}`);
    descripcion.style.textAlign = 'justify';
    descripcion.style.fontSize = '12px';
    this.contenedor.appendChild(descripcion);

    const tabla = this.crearElemento('table');
    tabla.style.width = '100%';
    tabla.style.borderCollapse = 'collapse';
    tabla.style.color = 'black';
    const thead = this.crearElemento('thead');
    const tbody = this.crearElemento('tbody');
    const trHead = this.crearElemento('tr');
    
    const encabezado = this.camposTabla();

    thead.appendChild(trHead);
    encabezado.forEach((campo) => {
      const th = this.crearElemento('th', '', campo);
      th.style.fontSize = '12px';
      trHead.appendChild(th);
    });

    this.contenido.forEach((elemento: any) => {
      const tr = this.crearElemento('tr');
      Object.keys(elemento).forEach((key: any) => {
        if (!key.includes('id')) {
          const td = this.crearElemento('td', '', elemento[key]);
          td.style.fontSize = '12px';
          tr.appendChild(td);
        }
      });
      tbody.appendChild(tr);
    });

    tabla.appendChild(thead);
    tabla.appendChild(tbody);
    this.contenedor.appendChild(tabla);

    

    this.crearPDF();
  }

  camposTabla(): string[] {
    return Object.keys(this.contenido[0]).filter(key => !key.includes('id'));
  }

  crearElemento(tag: string, clase: string = '', contenido: string = ''): HTMLElement {
    const elemento = document.createElement(tag);
    if(tag === 'th' || tag === 'td') {
      elemento.style.border = '1px solid black';
      elemento.style.padding = '8px';
    }
    if (tag === 'th') {
      elemento.style.fontWeight = 'bold';
      elemento.style.textAlign = 'left';
    }
    if (clase) elemento.classList.add(clase);
    if (contenido) elemento.innerHTML = contenido;
    return elemento;
  }

  crearPDF() {
    html2canvas(this.contenedor, {
      scale: 2,
    })
      .then((canvas: HTMLCanvasElement) => {
        const imgWidth = 210; // Ancho del PDF en mm
        const pageHeight = 297; // Altura del PDF en mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        const pdf = new jsPDF("p", "mm", "a4");
        let position = 0;

        pdf.addImage(canvas, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(canvas, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        pdf.save("documento.pdf");
      })
      .catch((error) => {
        console.error("Error generando el canvas:", error);
      });
    
  }
}
