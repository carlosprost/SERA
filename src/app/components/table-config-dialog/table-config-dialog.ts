import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../shared/material.module';
import { CommonModule } from '@angular/common';
import { TableRule } from '../../interfaces/tablas.interfaces';
import { invoke } from '@tauri-apps/api/core';

@Component({
  selector: 'app-table-config-dialog',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule, CommonModule],
  templateUrl: './table-config-dialog.html',
  styleUrl: './table-config-dialog.css'
})
export class TableConfigDialog implements OnInit {
  configForm: FormGroup;
  tabla: string;
  campos: string[] = [];
  activeTab = 0;
  showRecipes: boolean = false;

  operators = [
    { value: 'equals', viewValue: 'Es igual a' },
    { value: 'contains', viewValue: 'Contiene' },
    { value: 'lt', viewValue: 'Menor que' },
    { value: 'gt', viewValue: 'Mayor que' },
    { value: 'is_past', viewValue: 'Fecha pasada' },
    { value: 'is_future', viewValue: 'Fecha futura' }
  ];

  styleRecipes = [
    { title: 'Fecha Vencida', formula: 'DIF_DIAS([<campo_fecha>]; HOY()) > 5' },
    { title: 'Igual a Texto', formula: '[<campo_texto>] == "VALOR"' },
    { title: 'Filtro por Número', formula: '[<campo_numero>] > 100' },
    { title: 'Detectar Vacío', formula: 'ESTA_VACIO([<campo>])' }
  ];

  formulaRecipes = [
    { title: 'Estado por Fecha', formula: 'SI(DIF_DIAS([<campo_fecha>]; HOY()) > 5; "VENCIDO"; "AL DÍA")' },
    { title: 'Unir Textos', formula: 'CONCAT("Ref: "; [<campo_a>]; " - "; [<campo_b>])' },
    { title: 'Valor por Defecto', formula: 'SI(ESTA_VACIO([<campo>]); "N/A"; [<campo>])' },
    { title: 'Texto en Mayúsculas', formula: 'MAYUS([<campo_texto>])' }
  ];

  colors = [
    { value: 'transparent', viewValue: 'Ninguno' },
    { value: 'rgba(255, 0, 0, 0.15)', viewValue: 'Fondo Rojo (Alerta)' },
    { value: 'rgba(0, 255, 0, 0.15)', viewValue: 'Fondo Verde (Éxito)' },
    { value: 'rgba(255, 255, 0, 0.15)', viewValue: 'Fondo Amarillo (Aviso)' },
    { value: 'rgba(0, 150, 255, 0.15)', viewValue: 'Fondo Azul (Info)' }
  ];

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    public dialogRef: MatDialogRef<TableConfigDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.tabla = data.tabla;
    // Los campos vienen como array de strings, filtramos los que son IDs internos
    this.campos = data.campos.filter((f: string) => !f.toLowerCase().includes('id_'));
    
    this.configForm = this.fb.group({
      rules: this.fb.array([]),
      calculatedFields: this.fb.array([])
    });
  }

  ngOnInit() {
    this.loadConfig();
  }

  get rules(): FormArray {
    return this.configForm.get('rules') as FormArray;
  }

  get calculatedFields(): FormArray {
    return this.configForm.get('calculatedFields') as FormArray;
  }

  createRuleGroup(rule?: any): FormGroup {
    return this.fb.group({
      type: [rule?.type || 'simple'],
      field: [rule?.field || ''],
      operator: [rule?.operator || 'equals'],
      value: [rule?.value || ''],
      formula: [rule?.formula || ''],
      backgroundColor: [rule?.backgroundColor || 'transparent'],
      textColor: [rule?.textColor || ''],
      applyTo: [rule?.applyTo || 'row'],
      targetColumn: [rule?.targetColumn || '']
    });
  }

  createCalculatedFieldGroup(cf?: any): FormGroup {
    return this.fb.group({
      targetField: [cf?.targetField || '', Validators.required],
      formula: [cf?.formula || '', Validators.required],
      isActive: [cf?.isActive !== false]
    });
  }

  addCalculatedField() {
    this.calculatedFields.push(this.createCalculatedFieldGroup());
  }

  removeCalculatedField(index: number) {
    this.calculatedFields.removeAt(index);
  }

  addRule() {
    this.rules.push(this.createRuleGroup());
  }

  removeRule(index: number) {
    this.rules.removeAt(index);
  }

  toggleRecipes() {
    this.showRecipes = !this.showRecipes;
    this.cdr.detectChanges();
  }

  async loadConfig() {
    try {
      const configJson: string = await invoke('get_tabla_config', { nombreTabla: this.tabla });
      if (configJson && configJson.trim() !== '' && configJson !== '{}') {
        const config = JSON.parse(configJson);
        
        if (config.rules && Array.isArray(config.rules)) {
          config.rules.forEach((r: any) => this.rules.push(this.createRuleGroup(r)));
        }
        
        if (config.calculatedFields && Array.isArray(config.calculatedFields)) {
          config.calculatedFields.forEach((cf: any) => this.calculatedFields.push(this.createCalculatedFieldGroup(cf)));
        }

        this.cdr.detectChanges();
      }
    } catch (e) {
      console.error("Error loading table config", e);
    }
    
    if (this.rules.length === 0) {
      this.addRule();
    }
    this.cdr.detectChanges();
  }

  onTabChange(event: any) {
    this.activeTab = event.index;
    this.cdr.detectChanges();
  }

  applyRecipe(recipe: any) {
    if (this.activeTab === 0) {
      // Aplicar a la última regla de estilo
      const lastRule = this.rules.at(this.rules.length - 1);
      if (lastRule) {
        lastRule.patchValue({
          type: 'formula',
          formula: recipe.formula
        });
      }
    } else {
      // Aplicar a la última transformación virtual
      const lastField = this.calculatedFields.at(this.calculatedFields.length - 1);
      if (lastField) {
        lastField.patchValue({
          formula: recipe.formula,
          isActive: true
        });
      }
    }
  }

  isFormulaValid(formula: string): boolean {
    if (!formula) return true;
    try {
      // Solo intentamos ver si el motor puede "procesarla" sin arrojar error crítico de sintaxis
      // @ts-ignore
      FormulaEngine.evaluate(formula, {});
      return true;
    } catch (e) {
      return false;
    }
  }

  async onSubmit() {
    if (this.configForm.invalid) return;
    
    const config = { 
      rules: this.configForm.value.rules,
      calculatedFields: this.configForm.value.calculatedFields
    };
    const configJson = JSON.stringify(config);
    
    try {
      await invoke('update_tabla_config', { nombreTabla: this.tabla, configJson });
      this.dialogRef.close({ reload: true, config });
    } catch (e) {
      console.error("Error saving rule", e);
    }
  }

  dialogClose() {
    this.dialogRef.close();
  }
}
