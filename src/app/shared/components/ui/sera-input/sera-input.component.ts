import {
  Component,
  EventEmitter,
  forwardRef,
  Input,
  OnDestroy,
  OnInit,
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
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';

/**
 * SeraInputComponent — Componente de entrada de texto parametrizable del Design System SERA.
 *
 * Implementa ControlValueAccessor para integrarse con Reactive Forms.
 *
 * @example
 * <sera-input
 *   label="Razón Social"
 *   formControlName="razon_social"
 *   prefixIcon="business"
 * />
 *
 * @example (campo de fecha)
 * <sera-input
 *   label="Fecha de Nacimiento"
 *   formControlName="fecha"
 *   type="date"
 * />
 */
@Component({
  selector: 'sera-input',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatIconModule, ReactiveFormsModule, CommonModule],
  templateUrl: './sera-input.component.html',
  styleUrl: './sera-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SeraInputComponent),
      multi: true
    }
  ]
})
export class SeraInputComponent implements ControlValueAccessor, OnInit, OnDestroy {
  /** Etiqueta flotante del campo */
  @Input() label: string = '';

  /** Tipo HTML del input */
  @Input() type: 'text' | 'number' | 'password' | 'email' | 'time' | 'date' = 'text';

  /** Ancho del campo. Default: '100%' */
  @Input() width: string = '100%';

  /** Placeholder del input */
  @Input() placeholder: string = '';

  /** Ícono Material a la izquierda (matPrefix) */
  @Input() prefixIcon: string = '';

  /** Ícono Material a la derecha (matSuffix) */
  @Input() suffixIcon: string = '';

  /** Texto de ayuda debajo del campo */
  @Input() hint: string = '';

  /** Campo de solo lectura */
  @Input() readonly: boolean = false;

  /** Emite el valor cuando cambia */
  @Output() change = new EventEmitter<any>();

  /** Control interno para bindear con el input nativo */
  readonly internalControl = new FormControl<any>(null);

  isDisabled = false;

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};
  private sub?: Subscription;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.sub = this.internalControl.valueChanges.subscribe(val => {
      this.onChange(val);
      this.change.emit(val);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ── ControlValueAccessor ──────────────────────────────────────────────────

  writeValue(value: any): void {
    this.internalControl.setValue(value, { emitEvent: false });
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    isDisabled
      ? this.internalControl.disable({ emitEvent: false })
      : this.internalControl.enable({ emitEvent: false });
    this.cdr.markForCheck();
  }

  onBlur(): void {
    this.onTouched();
  }
}
