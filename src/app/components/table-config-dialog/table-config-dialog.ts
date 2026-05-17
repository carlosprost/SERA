import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../shared/material.module';
import { CommonModule } from '@angular/common';
import { TableRule } from '../../interfaces/tablas.interfaces';
import { invoke } from '@tauri-apps/api/core';
import { MatDialog } from '@angular/material/dialog';
import { RecetarioComponent } from '../recetario/recetario';

@Component({
  selector: 'app-table-config-dialog',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule, CommonModule],
  templateUrl: './table-config-dialog.html',
  styleUrl: './table-config-dialog.scss'
})
export class TableConfigDialog implements OnInit {
  configForm: FormGroup;
  tabla: string;
  campos: string[] = [];
  activeTab = 0;
  showRecipes: boolean = false;
  tablasDisponibles: any[] = [];
  camposRemotos: { [key: string]: string[] } = {};

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

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    public dialogRef: MatDialogRef<TableConfigDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.tabla = data.tabla;
    // Los campos vienen como array de strings, filtramos los que son IDs internos
    this.campos = data.campos.filter((f: string) => !f.toLowerCase().includes('id_'));
    
    this.configForm = this.fb.group({
      rules: this.fb.array([]),
      calculatedFields: this.fb.array([]),
      linkedFields: this.fb.array([])
    });
    this.cargarTablasDisponibles();
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

  get linkedFields(): FormArray {
    return this.configForm.get('linkedFields') as FormArray;
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

  createLinkedFieldGroup(lf?: any): FormGroup {
    const group = this.fb.group({
      localField: [lf?.localField || '', Validators.required],
      remoteTable: [lf?.remoteTable || '', Validators.required],
      remoteField: [lf?.remoteField || '', Validators.required],
      displayField: [lf?.displayField || '', Validators.required]
    });

    // Cargar campos remotos si ya tiene tabla
    if (lf?.remoteTable) {
      this.onRemoteTableChange(lf.remoteTable);
    }

    return group;
  }

  addLinkedField() {
    this.linkedFields.push(this.createLinkedFieldGroup());
  }

  removeLinkedField(index: number) {
    this.linkedFields.removeAt(index);
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

        if (config.linkedFields && Array.isArray(config.linkedFields)) {
          config.linkedFields.forEach((lf: any) => this.linkedFields.push(this.createLinkedFieldGroup(lf)));
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
      calculatedFields: this.configForm.value.calculatedFields,
      linkedFields: this.configForm.value.linkedFields
    };
    const configJson = JSON.stringify(config);
    
    try {
      await invoke('update_tabla_config', { nombreTabla: this.tabla, configJson });
      this.dialogRef.close({ reload: true, config });
    } catch (e) {
      console.error("Error saving rule", e);
    }
  }

  async cargarTablasDisponibles() {
    try {
      this.tablasDisponibles = await invoke('get_tablas');
      this.cdr.detectChanges();
    } catch (e) {
      console.error("Error al cargar tablas para vínculos", e);
    }
  }

  async onRemoteTableChange(nombreTabla: string) {
    if (!nombreTabla || this.camposRemotos[nombreTabla]) return;
    
    try {
      const camposRes: any[] = await invoke('get_campos', { nombreTabla });
      this.camposRemotos[nombreTabla] = camposRes.map(c => c.Field);
      this.cdr.detectChanges();
    } catch (e) {
      console.error("Error al cargar campos de tabla remota", e);
    }
  }

  verRecetario() {
    this.dialog.open(RecetarioComponent, {
      width: '700px',
      maxWidth: '90vw'
    });
  }

  toggleBackground(rule: any, event: any) {
    const isChecked = event.target.checked;
    rule.patchValue({
      backgroundColor: isChecked ? '#38bdf8' : 'transparent'
    });
  }

  toggleTextColor(rule: any, event: any) {
    const isChecked = event.target.checked;
    rule.patchValue({
      textColor: isChecked ? '#ffffff' : ''
    });
  }

  updateColor(rule: any, controlName: string, event: any) {
    rule.patchValue({
      [controlName]: event.target.value
    });
  }

  getValidColor(val: string, fallback: string): string {
    if (!val || val === 'transparent') {
      return fallback;
    }
    if (val.startsWith('rgba')) {
      if (val.includes('255, 0, 0')) return '#ff0000';
      if (val.includes('0, 255, 0')) return '#00ff00';
      if (val.includes('255, 255, 0')) return '#ffff00';
      if (val.includes('0, 150, 255')) return '#0096ff';
      
      const matches = val.match(/\d+/g);
      if (matches && matches.length >= 3) {
        const r = parseInt(matches[0], 10);
        const g = parseInt(matches[1], 10);
        const b = parseInt(matches[2], 10);
        return '#' + [r, g, b].map(x => {
          const hex = x.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        }).join('');
      }
      return fallback;
    }
    return val;
  }

  dialogClose() {
    this.dialogRef.close();
  }
}
