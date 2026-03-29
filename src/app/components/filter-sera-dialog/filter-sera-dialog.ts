import { Component, Inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
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
  styleUrl: './filter-sera-dialog.css'
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
      field: [rule?.field || '', Validators.required],
      operator: [rule?.operator || 'contains', Validators.required],
      value: [rule?.value || ''] // Opcional, dependiendo del operador
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
    if (this.filterForm.invalid) return;
    const rulesToApply = this.filterForm.value.rules.filter((r: any) => r.field && r.operator);
    this.dialogRef.close({ action: 'apply', filters: rulesToApply });
  }

  dialogClose() {
    this.dialogRef.close();
  }
}
