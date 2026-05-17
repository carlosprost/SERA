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

  // NUEVAS PESTAÑAS Y ESTADOS
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
    });
  }

  createForm() {
    this.formConfigurations = this.fb.group({
      nombre: [this.user?.nombre || ''],
      grado: [this.user?.grado || ''],
      institucion: [this.user?.institucion || ''],
      dependencia: [this.user?.dependencia || ''],
      oficina: [this.user?.oficina || ''],
      membrete: [this.user?.membrete || ''],
    });
  }

  async cargarLogs() {
    try {
      this.auditLogs = await invoke<any[]>('get_audit_logs');
    } catch (err) {
      console.error("Error al cargar logs de auditoría:", err);
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
    this.snackBar.open(`Tema visual cambiado a ${themeId.toUpperCase()}`, "OK", { duration: 2500 });
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
      this.animationsEnabled ? "Animaciones de interfaz activadas" : "Modo compacto de bajo rendimiento activado",
      "OK",
      { duration: 2500 }
    );
  }

  async optimizarDB() {
    this.loadingDb.set(true);
    try {
      await invoke('optimizar_db');
      this.snackBar.open("Mantenimiento SQLite completo: Índices y grillas compactadas (VACUUM)", "ÉXITO", {
        duration: 3500,
        panelClass: ['snackbar-exito']
      });
      await this.cargarLogs();
    } catch (err) {
      console.error("Error al optimizar base de datos:", err);
      this.snackBar.open("Error al realizar el mantenimiento SQLite", "ERROR", { duration: 3000 });
    } finally {
      this.loadingDb.set(false);
    }
  }

  async limpiarCache() {
    this.loadingCache.set(true);
    try {
      await invoke('limpiar_cache');
      this.snackBar.open("Archivos temporales purgados y caché del visor liberado.", "ÉXITO", {
        duration: 3000
      });
      await this.cargarLogs();
    } catch (err) {
      console.error("Error al limpiar caché:", err);
      this.snackBar.open("Error al limpiar archivos temporales", "ERROR", { duration: 3000 });
    } finally {
      this.loadingCache.set(false);
    }
  }

  dialogClose() {
    this.dialogRef.close();
  }

  onSubmit() {
    let obj: ConfigData = {
      nombreApp: this.nombreApp,
      user: {
        nombre: this.formConfigurations.value.nombre,
        grado: this.formConfigurations.value.grado,
        institucion: this.formConfigurations.value.institucion,
        dependencia: this.formConfigurations.value.dependencia,
        oficina: this.formConfigurations.value.oficina,
        membrete: this.formConfigurations.value.membrete,
      },
    };

    this.store.dispatch(
      StoreActions.loadUpdateConfig(
        StoreActions.loadUpdateConfig({ data: obj })
      )
    );
    
    this.snackBar.open("Configuraciones del operador guardadas correctamente", "ÉXITO", { duration: 3000 });
    this.dialogRef.close({ reload: true });
  }
}
