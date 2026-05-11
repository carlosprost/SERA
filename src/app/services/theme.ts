import { Injectable, signal, effect } from '@angular/core';

export interface ThemeDefinition {
  id: string;
  name: string;
  primary: string;
  background: string;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'sera_user_theme';
  
  public themes: ThemeDefinition[] = [
    { id: 'theme-dark', name: 'Deep Dark', primary: '#00bcd4', background: '#1e1e1e', description: 'El estilo clásico industrial de SERA.' },
    { id: 'theme-midnight', name: 'Midnight Blue', primary: '#38bdf8', background: '#0f172a', description: 'Azules profundos ideales para la noche.' },
    { id: 'theme-emerald', name: 'Emerald Forest', primary: '#2ecc71', background: '#1b262c', description: 'Verdes orgánicos con alto contraste.' },
    { id: 'theme-light', name: 'Sophisticated Light', primary: '#2563eb', background: '#f8fafc', description: 'Limpio y claro para entornos iluminados.' }
  ];

  public currentTheme = signal<string>(this.getStoredTheme());

  constructor() {
    effect(() => {
      const themeId = this.currentTheme();
      this.applyTheme(themeId);
      localStorage.setItem(this.STORAGE_KEY, themeId);
    });
  }

  private getStoredTheme(): string {
    return localStorage.getItem(this.STORAGE_KEY) || 'theme-dark';
  }

  public setTheme(themeId: string) {
    this.currentTheme.set(themeId);
  }

  private applyTheme(themeId: string) {
    const body = document.body;
    this.themes.forEach(t => body.classList.remove(t.id));
    body.classList.add(themeId);
  }
}
