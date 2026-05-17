import { Injectable, signal, effect } from '@angular/core';

export interface ThemeDefinition {
  id: string;
  name: string;
  primary: string;
  background: string;
  description: string;
}

export interface CustomColors {
  primary: string;
  bg: string;
  card: string;
  text: string;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'sera_user_theme';
  private readonly CUSTOM_COLORS_KEY = 'sera_custom_colors';
  
  public themes: ThemeDefinition[] = [
    { id: 'theme-dark', name: 'Deep Dark', primary: '#00bcd4', background: '#05080c', description: 'El estilo industrial puro con bases negro carbón y cian eléctrico.' },
    { id: 'theme-midnight', name: 'Midnight Blue', primary: '#38bdf8', background: '#0f172a', description: 'Azules profundos ideales para la noche.' },
    { id: 'theme-emerald', name: 'Emerald Forest', primary: '#2ecc71', background: '#1b262c', description: 'Verdes orgánicos con alto contraste.' },
    { id: 'theme-light', name: 'Sophisticated Light', primary: '#2563eb', background: '#f8fafc', description: 'Limpio y claro para entornos iluminados.' },
    { id: 'theme-custom', name: 'Estilo Propio', primary: '#ff4081', background: 'linear-gradient(135deg, #ff4081, #9c27b0, #3f51b5)', description: 'Diseñá tu propia combinación de colores interactivos.' }
  ];

  public currentTheme = signal<string>(this.getStoredTheme());
  public customColors = signal<CustomColors>(this.getStoredCustomColors());

  constructor() {
    effect(() => {
      const themeId = this.currentTheme();
      const colors = this.customColors();
      
      this.applyTheme(themeId);
      localStorage.setItem(this.STORAGE_KEY, themeId);
      
      if (themeId === 'theme-custom') {
        localStorage.setItem(this.CUSTOM_COLORS_KEY, JSON.stringify(colors));
      }
    });
  }

  private getStoredTheme(): string {
    return localStorage.getItem(this.STORAGE_KEY) || 'theme-dark';
  }

  private getStoredCustomColors(): CustomColors {
    const stored = localStorage.getItem(this.CUSTOM_COLORS_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error(e);
      }
    }
    return {
      primary: '#ff4081',
      bg: '#0a050f',
      card: '#140c1f',
      text: '#f3e8ff'
    };
  }

  public setTheme(themeId: string) {
    this.currentTheme.set(themeId);
  }

  public setCustomColors(colors: CustomColors) {
    this.customColors.set(colors);
  }

  public hexToRgb(hex: string): string {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result 
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '0, 0, 0';
  }

  private applyTheme(themeId: string) {
    const body = document.body;
    this.themes.forEach(t => body.classList.remove(t.id));
    
    if (themeId === 'theme-custom') {
      body.classList.add('theme-custom');
      this.updateCustomThemeVariables(this.customColors());
    } else {
      body.classList.add(themeId);
      this.clearCustomThemeVariables();
    }
  }

  public updateCustomThemeVariables(colors: CustomColors) {
    const root = document.documentElement;
    const rgbPrimary = this.hexToRgb(colors.primary);
    const rgbBg = this.hexToRgb(colors.bg);
    const rgbText = this.hexToRgb(colors.text);
    
    root.style.setProperty('--sera-primary-color', colors.primary);
    root.style.setProperty('--sera-primary-rgb', rgbPrimary);
    
    root.style.setProperty('--sera-bg-color', colors.bg);
    root.style.setProperty('--sera-bg-rgb', rgbBg);
    
    root.style.setProperty('--sera-card-bg', colors.card);
    root.style.setProperty('--sera-surface-color', `rgba(${this.hexToRgb(colors.card)}, 0.85)`);
    
    root.style.setProperty('--sera-text-color', colors.text);
    root.style.setProperty('--sera-text-rgb', rgbText);
  }

  private clearCustomThemeVariables() {
    const root = document.documentElement;
    root.style.removeProperty('--sera-primary-color');
    root.style.removeProperty('--sera-primary-rgb');
    root.style.removeProperty('--sera-bg-color');
    root.style.removeProperty('--sera-bg-rgb');
    root.style.removeProperty('--sera-card-bg');
    root.style.removeProperty('--sera-surface-color');
    root.style.removeProperty('--sera-text-color');
    root.style.removeProperty('--sera-text-rgb');
  }
}
