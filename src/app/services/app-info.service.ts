import { Injectable, signal, computed } from '@angular/core';
import { getVersion } from '@tauri-apps/api/app';
import { APP_VERSION, APP_CODENAME, APP_PATCH_CODE } from '../config/app-version.config';

/**
 * Servicio centralizado de información de la aplicación.
 * Lee la versión real desde tauri.conf.json mediante la API de Tauri,
 * y combina con el codename y patch code del archivo de configuración.
 * Al hacer un release, solo hay que:
 *   1. Cambiar la versión en tauri.conf.json / package.json / Cargo.toml
 *   2. Actualizar APP_CODENAME y APP_PATCH_CODE en app-version.config.ts
 */
@Injectable({ providedIn: 'root' })
export class AppInfoService {
  /** Número de versión — valor inicial desde config, confirmado en runtime por Tauri */
  readonly version = signal<string>(APP_VERSION);

  /** Nombre en código de la versión mayor (ej: "Poseidón") */
  readonly codename = signal<string>(APP_CODENAME);

  /** Código de parche con constelación (ej: "Orion-400") */
  readonly patchCode = signal<string>(APP_PATCH_CODE);

  /** Etiqueta corta para usar en la UI (ej: "v4.0.0 Poseidón") */
  readonly etiquetaCorta = computed(
    () => `v${this.version()} ${this.codename()}`
  );

  /** Etiqueta completa para el diálogo Acerca de */
  readonly etiquetaCompleta = computed(
    () => `Versión ${this.version()} "${this.codename()}"`
  );

  constructor() {
    this.cargarVersion();
  }

  /**
   * Carga la versión real de la app desde el runtime de Tauri.
   * De esta forma la fuente de verdad es tauri.conf.json, no el código TypeScript.
   */
  private async cargarVersion(): Promise<void> {
    try {
      const v = await getVersion();
      this.version.set(v);
    } catch {
      // Fallback si el runtime de Tauri no está disponible (tests, SSR, etc.)
      this.version.set('?.?.?');
    }
  }
}
