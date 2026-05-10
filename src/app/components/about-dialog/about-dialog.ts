import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-about-dialog',
  standalone: true,
  imports: [
    CommonModule, 
    MatDialogModule, 
    MatButtonModule, 
    MatIconModule
  ],
  template: `
    <div class="about-container">
      <div class="about-header text-center">
        <img src="assets/icon.png" alt="SERA Logo" class="about-logo">
        <h1 class="about-title">SERA</h1>
        <p class="about-version">Versión 3.0.3 "Orion"</p>
      </div>
      
      <div class="about-content">
        <p class="description">
          <strong>Sistema de Expedientes de Registro Avanzado.</strong><br>
          Diseñado para la gestión eficiente, segura y profesional de registros digitales.
        </p>
        
        <div class="info-card">
          <div class="info-item">
            <mat-icon>code</mat-icon>
            <div class="info-text">
              <span class="label">Arquitectura</span>
              <span class="val">Desktop Nativa (Tauri v2 + Angular 21)</span>
            </div>
          </div>
          <div class="info-item">
            <mat-icon>verified</mat-icon>
            <div class="info-text">
              <span class="label">Criptografía</span>
              <span class="val">AES-256-GCM (Grado Militar)</span>
            </div>
          </div>
        </div>

        <div class="author-banner">
          <img src="assets/WolfTeI_Logo.png" alt="WolfTeI Logo" class="author-logo-img">
          <span>Desarrollado integralmente por <strong>WolfTeI</strong></span>
        </div>
      </div>

      <mat-dialog-actions align="center" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px;">
        <button mat-button mat-dialog-close style="color: #666;">CERRAR</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .about-container {
      padding: 32px 24px;
      background: linear-gradient(145deg, #1e1e1e, #2b3035);
      color: #e0e0e0;
      border-radius: 12px;
      max-width: 450px;
    }
    .about-logo {
      width: 96px;
      height: 96px;
      margin-bottom: 12px;
      filter: drop-shadow(0 8px 16px rgba(0,0,0,0.4));
    }
    .about-title {
      font-size: 36px;
      margin: 0;
      font-weight: 800;
      letter-spacing: 4px;
      color: #fff;
      text-shadow: 0 0 20px rgba(255,255,255,0.1);
    }
    .about-version {
      font-size: 13px;
      color: #ffc107;
      margin-top: 4px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .about-content {
      margin: 28px 0;
    }
    .description {
      font-size: 15px;
      line-height: 1.6;
      color: #b0b0b0;
      text-align: center;
      margin-bottom: 24px;
    }
    .info-card {
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .info-item {
      display: flex;
      align-items: center;
      gap: 12px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: #4caf50; }
    }
    .info-text {
      display: flex;
      flex-direction: column;
      .label { font-size: 10px; color: #666; text-transform: uppercase; line-height: 1; }
      .val { font-size: 13px; color: #bbb; }
    }
    .author-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 10px 20px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 50px;
      font-size: 14px;
      color: #888;
      .author-logo-img {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid rgba(76, 175, 80, 0.3);
      }
      strong { color: #4caf50; }
    }
    .text-center { text-align: center; }
  `]
})
export class AboutDialogComponent {}
