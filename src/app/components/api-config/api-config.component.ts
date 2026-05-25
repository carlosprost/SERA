import { Component, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from '../../shared/material.module';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { DialogExposeTableComponent } from './dialog-expose-table.component';

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
  selector: 'app-api-config',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule
  ],
  templateUrl: './api-config.component.html',
  styleUrl: './api-config.component.scss'
})
export class ApiConfigComponent implements OnInit, OnDestroy {
  // CONFIGURACIÓN DEL SERVIDOR HOST
  apiEnabled = signal<boolean>(false);
  apiPort = signal<number>(54321);
  localIp = signal<string>('Detectando...');
  cargandoServidor = signal<boolean>(false);

  // TABLAS
  tablasDisponibles: TablaDisponible[] = [];
  tablasExpuestas = new Map<string, TablaExpuesta>();
  cargandoTablas = signal<boolean>(false);

  // VISIBILIDAD DE TOKENS EN LA INTERFAZ
  tokensVisibles = new Set<string>();

  // Tauri Event Listener
  private unlistenErrorFn: UnlistenFn | null = null;

  constructor(
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  async ngOnInit() {
    await this.cargarConfiguracionGlobal();
    await this.cargarLocalIp();
    await this.cargarTablasCatalogo();
    await this.cargarTablasExpuestas();

    // Escuchar errores de binding de puerto ocupado desde el backend en caliente
    this.unlistenErrorFn = await listen<string>('api-server-error', (event) => {
      this.apiEnabled.set(false);
      this.snackBar.open(`Error de red: ${event.payload}`, 'Cerrar', {
        duration: 4000,
        panelClass: ['snackbar-error']
      });
    });
  }

  ngOnDestroy() {
    if (this.unlistenErrorFn) {
      this.unlistenErrorFn();
    }
  }

  // 1. Cargar Configuración General de la Base de Datos
  async cargarConfiguracionGlobal() {
    try {
      const config: any = await invoke('get_config');
      if (config && config.user) {
        this.apiEnabled.set(config.user.apiEnabled === 1);
        this.apiPort.set(config.user.apiPort || 54321);
      }
    } catch (err) {
      console.error('[SERA] Error al cargar configuración general:', err);
    }
  }

  // 2. Resolver la IP local activa
  async cargarLocalIp() {
    try {
      const ip = await invoke<string>('get_local_ip_cmd');
      this.localIp.set(ip);
    } catch (err) {
      this.localIp.set('127.0.0.1');
      console.warn('[SERA] No se pudo obtener la IP local de red:', err);
    }
  }

  // 3. Listar todas las tablas en el catálogo de SQLite
  async cargarTablasCatalogo() {
    try {
      this.tablasDisponibles = await invoke<TablaDisponible[]>('get_tablas');
    } catch (err) {
      console.error('[SERA] Error al cargar catálogo de tablas:', err);
    }
  }

  // 4. Listar las tablas que ya están expuestas en red
  async cargarTablasExpuestas() {
    this.cargandoTablas.set(true);
    try {
      const expuestas = await invoke<TablaExpuesta[]>('get_tablas_expuestas_cmd');
      this.tablasExpuestas.clear();
      expuestas.forEach(t => {
        this.tablasExpuestas.set(t.tabla, t);
      });
    } catch (err) {
      console.error('[SERA] Error al cargar tablas expuestas:', err);
    } finally {
      this.cargandoTablas.set(false);
    }
  }

  // 5. Encender / Apagar el servidor HTTP local
  async toggleServidor() {
    const nuevoEstado = this.apiEnabled();
    this.cargandoServidor.set(true);

    try {
      // A. Encender o apagar en caliente en el backend
      await invoke('toggle_api_servidor', {
        habilitar: nuevoEstado,
        puerto: this.apiPort()
      });

      // B. Persistir la configuración en sera_config para futuros arranques de la app
      const config: any = await invoke('get_config');
      if (config) {
        config.user.apiEnabled = nuevoEstado ? 1 : 0;
        config.user.apiPort = this.apiPort();
        await invoke('update_config', { config });
      }

      this.snackBar.open(
        nuevoEstado 
          ? `Servidor de Red Local activo en el puerto ${this.apiPort()}`
          : 'Servidor de Red Local apagado correctamente.',
        'OK',
        { duration: 3000 }
      );
    } catch (err: any) {
      console.error('[SERA] Error al conmutar estado del servidor API:', err);
      this.apiEnabled.set(!nuevoEstado); // Revertir switch
      this.snackBar.open(`Error al configurar el servidor: ${err}`, 'Cerrar', { duration: 3500 });
    } finally {
      this.cargandoServidor.set(false);
    }
  }

  // 6. Cambiar el puerto del servidor HTTP
  async aplicarPuerto() {
    if (this.apiPort() < 1024 || this.apiPort() > 65535) {
      this.snackBar.open('Puerto inválido. Ingresá un valor entre 1024 y 65535.', 'Cerrar', { duration: 2500 });
      return;
    }

    if (this.apiEnabled()) {
      // Si está encendido, lo reiniciamos en el nuevo puerto
      await this.toggleServidor(); // Apaga
      this.apiEnabled.set(true);
      await this.toggleServidor(); // Enciende en nuevo puerto
    } else {
      // Si está apagado, solo guardamos el puerto en BD
      try {
        const config: any = await invoke('get_config');
        if (config) {
          config.user.apiPort = this.apiPort();
          await invoke('update_config', { config });
          this.snackBar.open(`Puerto predeterminado actualizado a ${this.apiPort()}`, 'OK', { duration: 2500 });
        }
      } catch (err) {
        console.error('[SERA] Error al guardar puerto:', err);
      }
    }
  }

  // 7. Exponer o revocar exposición de una tabla específica
  async toggleExposicionTabla(tablaNombre: string) {
    const estaExpuesta = this.tablasExpuestas.has(tablaNombre);

    try {
      if (estaExpuesta) {
        // Revocar exposición
        await invoke('revocar_tabla_cmd', { tabla: tablaNombre });
        this.tablasExpuestas.delete(tablaNombre);
        this.snackBar.open(`Tabla '${tablaNombre}' removida de la red local.`, 'OK', { duration: 2000 });
      } else {
        // Exponer por primera vez (default Solo Lectura, Cifrado E2E activo)
        const credenciales: any = await invoke('exponer_tabla_cmd', {
          tabla: tablaNombre,
          permiso: 'READ',
          e2e: true
        });

        this.tablasExpuestas.set(tablaNombre, {
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
      this.snackBar.open('No se pudo modificar el estado de red de la tabla.', 'Cerrar', { duration: 3000 });
    }
  }

  // 8. Cambiar permisos de acceso (READ, READ_WRITE, FULL)
  async cambiarPermisos(tablaNombre: string, permiso: 'READ' | 'READ_WRITE' | 'FULL') {
    try {
      await invoke('actualizar_permiso_tabla_cmd', { tabla: tablaNombre, permiso });
      const expuesta = this.tablasExpuestas.get(tablaNombre);
      if (expuesta) {
        expuesta.permiso = permiso;
        this.tablasExpuestas.set(tablaNombre, expuesta);
        
        const descPermiso = permiso === 'READ' ? 'Solo Lectura' : permiso === 'READ_WRITE' ? 'Lectura y Escritura' : 'Control Total';
        this.snackBar.open(`Permiso de '${tablaNombre}' cambiado a ${descPermiso}`, 'OK', { duration: 2500 });
      }
    } catch (err) {
      console.error('[SERA] Error al actualizar permisos de tabla:', err);
      this.snackBar.open('Error al cambiar los permisos de red.', 'Cerrar', { duration: 3000 });
    }
  }

  // 9. Activar / Desactivar Cifrado E2E por tabla expuesta
  async toggleCifradoE2e(tablaNombre: string, cifradoActivo: boolean) {
    try {
      const expuesta = this.tablasExpuestas.get(tablaNombre);
      if (expuesta) {
        // Para aplicar el cambio simplemente volvemos a llamar a exponer_tabla_cmd con los mismos valores
        // SQLite hace INSERT OR REPLACE, por lo que actualiza la configuración sin cambiar las llaves
        await invoke('exponer_tabla_cmd', {
          tabla: tablaNombre,
          permiso: expuesta.permiso,
          e2e: cifradoActivo
        });

        expuesta.cifradoE2e = cifradoActivo;
        this.tablasExpuestas.set(tablaNombre, expuesta);
        
        this.snackBar.open(
          cifradoActivo 
            ? `Cifrado E2E (AES-GCM) activado para la tabla '${tablaNombre}'.`
            : `Cifrado E2E desactivado. Los datos viajan en texto claro para integraciones de terceros.`,
          'OK',
          { duration: 3500 }
        );
      }
    } catch (err) {
      console.error('[SERA] Error al cambiar cifrado de tabla:', err);
      this.snackBar.open('Error al configurar la seguridad de cifrado.', 'Cerrar', { duration: 3000 });
    }
  }

  // 10. Utilidad de Copiar al Portapapeles
  copiarTexto(texto: string, label: string) {
    navigator.clipboard.writeText(texto).then(() => {
      this.snackBar.open(`${label} copiado al portapapeles.`, 'OK', { duration: 2000 });
    }).catch(err => {
      console.error('Error al copiar al portapapeles:', err);
    });
  }

  // 11. Cambiar visibilidad de token
  toggleTokenVisibilidad(tabla: string) {
    if (this.tokensVisibles.has(tabla)) {
      this.tokensVisibles.delete(tabla);
    } else {
      this.tokensVisibles.add(tabla);
    }
  }

  isTokenVisible(tabla: string): boolean {
    return this.tokensVisibles.has(tabla);
  }

  getUrlBaseApi(): string {
    return `http://${this.localIp()}:${this.apiPort()}`;
  }

  get tablasExpuestasArray(): TablaExpuesta[] {
    return Array.from(this.tablasExpuestas.values());
  }

  abrirDialogoExposicion() {
    const dialogRef = this.dialog.open(DialogExposeTableComponent, {
      width: '560px',
      maxWidth: '90vw',
      maxHeight: '85vh',
      panelClass: 'expose-dialog-panel',
      data: {
        tablasDisponibles: this.tablasDisponibles,
        tablasExpuestas: this.tablasExpuestas
      }
    });

    dialogRef.afterClosed().subscribe((result) => {
      // Al cerrar el diálogo, refrescamos el listado de tablas expuestas
      this.cargarTablasExpuestas();
    });
  }
}
