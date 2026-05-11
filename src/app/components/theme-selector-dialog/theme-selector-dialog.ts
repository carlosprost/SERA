import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ThemeService, ThemeDefinition } from '../../services/theme';

@Component({
  selector: 'app-theme-selector-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="theme-dialog-container">
      <h2 mat-dialog-title>
        <mat-icon>palette</mat-icon> Personalizar Apariencia
      </h2>
      
      <mat-dialog-content>
        <p class="subtitle">Elegí el ambiente que mejor se adapte a tu jornada de trabajo.</p>
        
        <div class="themes-grid">
          @for (theme of themeService.themes; track theme.id) {
            <div 
              class="theme-card" 
              [class.active]="themeService.currentTheme() === theme.id"
              (click)="selectTheme(theme.id)"
            >
              <div class="theme-preview" [style.backgroundColor]="theme.background">
                <div class="color-dot" [style.backgroundColor]="theme.primary"></div>
                @if (themeService.currentTheme() === theme.id) {
                  <div class="active-badge">
                    <mat-icon>check_circle</mat-icon>
                  </div>
                }
              </div>
              <div class="theme-info">
                <span class="theme-name">{{ theme.name }}</span>
                <span class="theme-desc">{{ theme.description }}</span>
              </div>
            </div>
          }
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="close()">CERRAR</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .theme-dialog-container {
      padding: 10px;
    }
    
    h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 5px;
      font-weight: 600;
      color: var(--sera-primary-color);
    }

    .subtitle {
      color: var(--sera-text-color);
      opacity: 0.7;
      margin-bottom: 25px;
      font-size: 0.95rem;
    }

    .themes-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 10px;
    }

    .theme-card {
      background: var(--sera-card-bg, #2d2d2d);
      border: 2px solid transparent;
      border-radius: 12px;
      padding: 12px;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);

      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 15px rgba(0,0,0,0.2);
        border-color: var(--sera-primary-color);
        opacity: 0.9;
      }

      &.active {
        border-color: var(--sera-primary-color);
        background: rgba(var(--sera-primary-color-rgb, 0, 188, 212), 0.05);
        box-shadow: 0 0 15px rgba(0, 188, 212, 0.2);
      }
    }

    .theme-preview {
      height: 80px;
      border-radius: 8px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.1);

      .color-dot {
        width: 35px;
        height: 35px;
        border-radius: 50%;
        box-shadow: 0 0 20px rgba(0,0,0,0.3);
      }

      .active-badge {
        position: absolute;
        top: 5px;
        right: 5px;
        color: #fff;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }
    }

    .theme-info {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .theme-name {
        font-weight: 600;
        font-size: 1rem;
        color: var(--sera-text-color);
      }

      .theme-desc {
        font-size: 0.8rem;
        color: var(--sera-text-color);
        opacity: 0.6;
        line-height: 1.2;
      }
    }
  `]
})
export class ThemeSelectorDialogComponent {
  public themeService = inject(ThemeService);
  private dialogRef = inject(MatDialogRef<ThemeSelectorDialogComponent>);

  selectTheme(themeId: string) {
    this.themeService.setTheme(themeId);
    // Pequeña pausa para que se vea el feedback visual antes de cerrar
    setTimeout(() => this.dialogRef.close(), 200);
  }

  close() {
    this.dialogRef.close();
  }
}
