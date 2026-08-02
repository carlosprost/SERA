import {
  Component,
  EventEmitter,
  forwardRef,
  Input,
  OnDestroy,
  OnInit,
  OnChanges,
  SimpleChanges,
  Output,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';

/**
 * SeraSelectComponent — Selector desplegable del Design System SERA.
 *
 * Implementa ControlValueAccessor para integrarse nativamente con Reactive Forms.
 * Soporta tanto arrays de primitivos (string, number) como de objetos con
 * claves configurables (optionLabel / optionValue).
 *
 * @example
 * <!-- Array simple de strings -->
 * <sera-select label="Campo" [options]="campos" formControlName="campo" />
 *
 * <!-- Array de objetos con clave personalizada -->
 * <sera-select
 *   label="Tabla Remota"
 *   [options]="tablas"
 *   optionLabel="nombre"
 *   optionValue="id"
 *   formControlName="tablaId"
 *   (change)="onTablaChange($event)" />
 */
@Component({
  selector: 'sera-select',
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule, MatIconModule, ReactiveFormsModule, CommonModule],
  templateUrl: './sera-select.component.html',
  styleUrl: './sera-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SeraSelectComponent),
      multi: true
    }
  ]
})
export class SeraSelectComponent implements ControlValueAccessor, OnInit, OnDestroy, OnChanges {
  /** Etiqueta flotante del campo */
  @Input() label: string = '';

  /** Array de opciones: puede ser primitivo (string/number) u objeto */
  @Input() options: any[] = [];

  /** Propiedad del objeto a usar como ETIQUETA visible. Default: 'label' */
  @Input() optionLabel: string = 'label';

  /** Propiedad del objeto a usar como VALOR del form control. Default: 'value' */
  @Input() optionValue: string = 'value';

  /** Ancho del campo. Default: '100%' */
  @Input() width: string = '100%';

  /** Texto de placeholder cuando no hay selección */
  @Input() placeholder: string = '';

  /** Permite selección múltiple */
  @Input() multiple: boolean = false;

  /** Marca el campo como requerido (solo visual) */
  @Input() required: boolean = false;

  /** Emite el valor seleccionado cada vez que cambia */
  @Output() change = new EventEmitter<any>();

  /** Control interno para bindear con mat-select */
  readonly internalControl = new FormControl<any>(null);

  /** Estado disabled sincronizado desde el FormGroup padre */
  isDisabled = false;

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};
  private sub?: Subscription;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // Propagar cambios del control interno hacia el FormControl padre
    this.sub = this.internalControl.valueChanges.subscribe(val => {
      this.onChange(val);
      this.change.emit(val);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['options'] || changes['label'] || changes['placeholder']) {
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ── ControlValueAccessor ──────────────────────────────────────────────────

  /** Recibe el valor desde el FormGroup padre */
  writeValue(value: any): void {
    this.internalControl.setValue(value, { emitEvent: false });
    this.cdr.markForCheck();
  }

  /** Registra la función de notificación de cambio */
  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  /** Registra la función de notificación de touch */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /** Sincroniza el estado disabled */
  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    isDisabled
      ? this.internalControl.disable({ emitEvent: false })
      : this.internalControl.enable({ emitEvent: false });
    this.cdr.markForCheck();
  }

  // ── Helpers de opciones ───────────────────────────────────────────────────

  /**
   * Extrae el valor de una opción (primitiva u objeto).
   * Si la opción es primitiva, la retorna tal cual.
   */
  getOptionValue(opt: any): any {
    if (opt === null || opt === undefined) return opt;
    if (typeof opt === 'string' || typeof opt === 'number' || typeof opt === 'boolean') return opt;
    return opt[this.optionValue] ?? opt;
  }

  /**
   * Extrae la etiqueta a mostrar de una opción (primitiva u objeto).
   * Si la opción es primitiva, retorna su representación como string.
   */
  getOptionLabel(opt: any): string {
    if (opt === null || opt === undefined) return '';
    if (typeof opt === 'string') return opt;
    if (typeof opt === 'number' || typeof opt === 'boolean') return String(opt);
    return String(opt[this.optionLabel] ?? opt);
  }

  /**
   * Formatea la visualización en el trigger cuando multiple está activado.
   * Muestra las opciones seleccionadas en el orden en que fueron elegidas unidas con ' + '.
   */
  getSelectedMultipleLabels(): string {
    const val = this.internalControl.value;
    if (!Array.isArray(val) || val.length === 0) return '';
    return val
      .map(v => {
        const found = this.options.find(opt => this.getOptionValue(opt) === v);
        return found ? this.getOptionLabel(found) : String(v);
      })
      .join(' + ');
  }

  /** Marca el control como tocado al cerrar el panel */
  onPanelClosed(): void {
    this.onTouched();
  }
}
