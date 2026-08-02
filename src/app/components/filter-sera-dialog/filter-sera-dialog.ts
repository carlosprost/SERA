import { Component, Inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from '../../shared/material.module';
import { CommonModule } from '@angular/common';

export interface FilterRule {
  field: string;
  operator: string;
  value: string;
}

@Component({
  selector: 'app-filter-sera-dialog',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule, CommonModule],
  templateUrl: './filter-sera-dialog.html',
  styleUrl: './filter-sera-dialog.scss'
})
export class FilterSeraDialog {
  filterForm: FormGroup;
  campos: string[] = [];

  operators = [
    { value: 'equals', viewValue: 'Es igual a' },
    { value: 'contains', viewValue: 'Contiene' },
    { value: 'not_contains', viewValue: 'No contiene' },
    { value: 'lt', viewValue: 'Menor que' },
    { value: 'gt', viewValue: 'Mayor que' },
    { value: 'is_empty', viewValue: 'Está vacío' },
    { value: 'is_not_empty', viewValue: 'No está vacío' }
  ];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<FilterSeraDialog>,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    // Filtrar los campos que no deben mostrarse
    this.campos = data.campos || [];
    
    this.filterForm = this.fb.group({
      rules: this.fb.array([])
    });

    if (data.currentFilters && data.currentFilters.length > 0) {
      data.currentFilters.forEach((r: FilterRule) => this.rules.push(this.createRuleGroup(r)));
    } else {
      this.addRule();
    }
  }

  get rules(): FormArray {
    return this.filterForm.get('rules') as FormArray;
  }

  createRuleGroup(rule?: FilterRule): FormGroup {
    return this.fb.group({
      field: [rule?.field || ''],
      operator: [rule?.operator || 'contains'],
      value: [rule?.value || '']
    });
  }

  addRule() {
    this.rules.push(this.createRuleGroup());
  }

  removeRule(index: number) {
    this.rules.removeAt(index);
  }

  clearFilters() {
    this.rules.clear();
    this.dialogRef.close({ action: 'clear' });
  }

  onSubmit() {
    const currentRules = this.filterForm.value.rules || [];

    if (currentRules.length === 0) {
      this.dialogRef.close({ action: 'apply', filters: [] });
      return;
    }

    const hasIncompleteRule = currentRules.some((r: any) => !r.field || !r.field.trim?.() && !r.field);
    if (hasIncompleteRule) {
      this.snackBar.open('Fallo al aplicar el filtro: falta seleccionar el campo requerido (Columna a filtrar).', 'Cerrar', {
        duration: 3500
      });
      return;
    }

    const rulesToApply = currentRules.filter((r: any) => r.field && r.operator);
    this.dialogRef.close({ action: 'apply', filters: rulesToApply });
  }

  dialogClose() {
    this.dialogRef.close();
  }
}
