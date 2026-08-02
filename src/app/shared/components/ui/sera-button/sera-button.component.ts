import {
  Component,
  Input,
  HostBinding,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule, MatButtonAppearance } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * SeraButtonComponent — Botón parametrizable del Design System SERA.
 *
 * Usa la nueva API de Angular Material 21 (M3):
 *   - matButton="filled"   → botón relleno (ex mat-flat-button)
 *   - matButton="outlined" → botón contorneado (ex mat-stroked-button)
 *   - matButton="elevated" → botón elevado (ex mat-raised-button)
 *   - matButton="tonal"    → botón tonal (nuevo M3)
 *   - matButton            → botón de texto (ex mat-button)
 *   - matIconButton        → botón de solo ícono (ex mat-icon-button)
 *
 * @example (botón relleno primario con ícono)
 * <sera-button label="Guardar" icon="save" (click)="guardar()" />
 *
 * @example (botón solo ícono)
 * <sera-button variant="icon" icon="delete" (click)="eliminar()" />
 *
 * @example (botón contorneado)
 * <sera-button variant="outlined" label="Cancelar" (click)="cerrar()" />
 *
 * @example (botón de texto pequeño)
 * <sera-button variant="text" label="Ver más" size="sm" (click)="verMas()" />
 */
@Component({
  selector: 'sera-button',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, CommonModule],
  templateUrl: './sera-button.component.html',
  styleUrl: './sera-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SeraButtonComponent {
  /**
   * Variante visual del botón.
   * Mapea a la nueva API de Angular Material 21 M3.
   *
   * | Valor      | API M3 resultante       |
   * |------------|-------------------------|
   * | flat       | matButton="filled"      |
   * | outlined   | matButton="outlined"    |
   * | elevated   | matButton="elevated"    |
   * | tonal      | matButton="tonal"       |
   * | text       | matButton (sin valor)   |
   * | icon       | matIconButton           |
   */
  @Input() variant: 'flat' | 'outlined' | 'elevated' | 'tonal' | 'text' | 'icon' = 'flat';

  /** Nombre del ícono de Google Material Icons */
  @Input() icon: string = '';

  /** Posición del ícono respecto al texto */
  @Input() iconPosition: 'left' | 'right' = 'left';

  /** Texto del botón */
  @Input() label: string = '';

  /** Deshabilita el botón */
  @Input() disabled: boolean = false;

  /** Ancho del botón (ej: '100%', '200px'). Solo aplica para variantes no-icon. */
  @Input() width: string = '';

  /** Tamaño del botón */
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  /** Tipo HTML del botón nativo */
  @Input() type: 'button' | 'submit' | 'reset' = 'button';

  /** Expone la variante como atributo DOM para que el SCSS pueda usarla con :host([variant]) */
  @HostBinding('attr.variant') get hostVariant() { return this.variant; }

  /**
   * Retorna el valor que se pasa al binding [matButton].
   * Para variant='text' retorna string vacío (matButton sin valor = texto plano).
   */
  get buttonVariant(): '' | MatButtonAppearance {
    const map: Record<string, '' | MatButtonAppearance> = {
      flat:     'filled',
      outlined: 'outlined',
      elevated: 'elevated',
      tonal:    'tonal',
      text:     '',
    };
    return map[this.variant] ?? '';
  }
}
