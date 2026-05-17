import { Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormBuilder, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { ConfigData, UserConfig } from '../../interfaces/configData.interfaces';
import { StoreActions } from '../../store/store.actions';
import { selectConfigData } from '../../store/store.selectors';
import { MaterialModule } from '../../shared/material.module';
import { ThemeService } from '../../services/theme';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

@Component({
  selector: 'app-config-data-dialog',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule, 
    MaterialModule
  ],
  templateUrl: './config-data-dialog.component.html',
  styleUrl: './config-data-dialog.component.scss'
})
export class ConfigDataDialogComponent {
  formConfigurations!: FormGroup;
  configData: Observable<ConfigData>;

  nombreApp!: string;
  user!: UserConfig;

  /** Ruta relativa guardada en el campo membrete de la DB */
  membretePath = signal<string>('');
  /** Data URL base64 para preview del logo */
  logoPreview = signal<string>('');
  /** Indica si se está copiando el logo al directorio de SERA */
  cargandoLogo = signal<boolean>(false);

  // PESTAÑAS Y ESTADOS
  activeTab: string = 'general';
  animationsEnabled: boolean = true;
  srxPassword: string = '••••••••••••••••••••';
  
  loadingDb = signal<boolean>(false);
  loadingCache = signal<boolean>(false);
  auditLogs: any[] = [];

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    public themeService: ThemeService,
    public dialogRef: MatDialogRef<ConfigDataDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.configData = this.store.select(selectConfigData);

    this.configData.subscribe((data) => {
      if (data) {
        this.nombreApp = data.nombreApp || '';
        this.user = data.user || { nombre: '', grado: '', institucion: '', dependencia: '', oficina: '', membrete: '' };
      } else {
        this.nombreApp = '';
        this.user = { nombre: '', grado: '', institucion: '', dependencia: '', oficina: '', membrete: '' };
      }
      this.createForm();
      // Cargar preview del logo si ya hay uno registrado en BD
      if (this.user.membrete) {
        this.membretePath.set(this.user.membrete);
        this.cargarLogoPreview(this.user.membrete);
      } else {
        // Si la BD no tiene el path (ej.: por el bug anterior), intentar
        // detectar automáticamente si existe un logo en la carpeta de SERA
        this.detectarLogoExistente();
      }
    });
  }

  createForm() {
    this.formConfigurations = this.fb.group({
      nombre: [this.user?.nombre || ''],
      // Los campos heredados se mantienen en el FormGroup para preservar datos existentes,
      // pero no se muestran en la UI simplificada
      grado: [this.user?.grado || ''],
      institucion: [this.user?.institucion || ''],
      dependencia: [this.user?.dependencia || ''],
      oficina: [this.user?.oficina || ''],
    });
  }

  /** Carga el preview del logo actual desde el backend en base64. */
  async cargarLogoPreview(ruta: string) {
    try {
      const base64 = await invoke<string>('get_logo_membrete_base64', { rutaRelativa: ruta });
      this.logoPreview.set(base64);
    } catch {
      this.logoPreview.set('');
    }
  }

  /**
   * Auto-detecta si existe un logo guardado en la carpeta de membrete de SERA,
   * aunque el campo en la BD esté vacío (migración desde bug anterior).
   */
  async detectarLogoExistente() {
    try {
      const ruta = await invoke<string>('detectar_logo_membrete');
      this.membretePath.set(ruta);
      await this.cargarLogoPreview(ruta);
    } catch {
      // No hay logo guardado, el estado vacío es el correcto
    }
  }

  /** Abre el diálogo nativo del sistema para seleccionar una imagen y la guarda en SERA. */
  async seleccionarLogo() {
    try {
      const rutaSeleccionada = await open({
        multiple: false,
        filters: [{ name: 'Imagen', extensions: ['png', 'jpg', 'jpeg'] }],
        title: 'Seleccioná el logotipo para los reportes'
      });

      if (!rutaSeleccionada || typeof rutaSeleccionada !== 'string') return;

      this.cargandoLogo.set(true);

      const rutaRelativa = await invoke<string>('guardar_logo_membrete', { rutaOrigen: rutaSeleccionada });
      this.membretePath.set(rutaRelativa);
      await this.cargarLogoPreview(rutaRelativa);

      this.snackBar.open('Logotipo guardado correctamente en SERA', 'OK', { duration: 2500 });
    } catch (err) {
      console.error('[SERA] Error al guardar el logotipo:', err);
      this.snackBar.open('No se pudo guardar el logotipo', 'Cerrar', { duration: 3000 });
    } finally {
      this.cargandoLogo.set(false);
    }
  }

  /** Elimina el logotipo actual del perfil (no borra el archivo físico). */
  quitarLogo() {
    this.membretePath.set('');
    this.logoPreview.set('');
    this.snackBar.open('Logotipo removido del perfil', 'OK', { duration: 2000 });
  }

  async cargarLogs() {
    try {
      this.auditLogs = await invoke<any[]>('get_audit_logs');
    } catch (err) {
      console.error('Error al cargar logs de auditoría:', err);
    }
  }

  setTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'security') {
      this.cargarLogs();
    }
  }

  selectTheme(themeId: string) {
    this.themeService.setTheme(themeId);
    this.snackBar.open(`Tema visual cambiado a ${themeId.toUpperCase()}`, 'OK', { duration: 2500 });
  }

  updateCustomColor(key: 'primary' | 'bg' | 'card' | 'text', event: any) {
    const color = event.target.value;
    const current = { ...this.themeService.customColors() };
    current[key] = color;
    this.themeService.setCustomColors(current);
  }

  toggleAnimations() {
    this.animationsEnabled = !this.animationsEnabled;
    this.snackBar.open(
      this.animationsEnabled ? 'Animaciones de interfaz activadas' : 'Modo compacto de bajo rendimiento activado',
      'OK',
      { duration: 2500 }
    );
  }

  async optimizarDB() {
    this.loadingDb.set(true);
    try {
      await invoke('optimizar_db');
      this.snackBar.open('Mantenimiento SQLite completo: Índices y grillas compactadas (VACUUM)', 'ÉXITO', {
        duration: 3500,
        panelClass: ['snackbar-exito']
      });
      await this.cargarLogs();
    } catch (err) {
      console.error('Error al optimizar base de datos:', err);
      this.snackBar.open('Error al realizar el mantenimiento SQLite', 'ERROR', { duration: 3000 });
    } finally {
      this.loadingDb.set(false);
    }
  }

  async limpiarCache() {
    this.loadingCache.set(true);
    try {
      await invoke('limpiar_cache');
      this.snackBar.open('Archivos temporales purgados y caché del visor liberado.', 'ÉXITO', {
        duration: 3000
      });
      await this.cargarLogs();
    } catch (err) {
      console.error('Error al limpiar caché:', err);
      this.snackBar.open('Error al limpiar archivos temporales', 'ERROR', { duration: 3000 });
    } finally {
      this.loadingCache.set(false);
    }
  }

  dialogClose() {
    this.dialogRef.close();
  }

  onSubmit() {
    const obj: ConfigData = {
      nombreApp: this.nombreApp,
      user: {
        nombre: this.formConfigurations.value.nombre,
        // Campos heredados preservados para compatibilidad con la BD existente
        grado: this.formConfigurations.value.grado,
        institucion: this.formConfigurations.value.institucion,
        dependencia: this.formConfigurations.value.dependencia,
        oficina: this.formConfigurations.value.oficina,
        // El membrete ahora se gestiona fuera del form (file picker)
        membrete: this.membretePath(),
      },
    };

    // Despachar la acción correctamente con el objeto de configuración
    this.store.dispatch(StoreActions.loadUpdateConfig({ data: obj }));
    
    this.snackBar.open('Perfil guardado correctamente', 'ÉXITO', { duration: 3000 });
    this.dialogRef.close({ reload: true });
  }
}
