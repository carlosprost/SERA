import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../shared/material.module';
import { CommonModule } from '@angular/common';
import { TableRule } from '../../interfaces/tablas.interfaces';
import { invoke } from '@tauri-apps/api/core';
import { MatDialog } from '@angular/material/dialog';
import { RecetarioComponent } from '../recetario/recetario';
import { FormatNamePipe } from '../../shared/pipes/format-name.pipe';

@Component({
  selector: 'app-table-config-dialog',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule, CommonModule, FormatNamePipe],
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
    let displayVal: string[] = [];
    if (Array.isArray(lf?.displayFields) && lf.displayFields.length > 0) {
      displayVal = lf.displayFields;
    } else if (Array.isArray(lf?.displayField)) {
      displayVal = lf.displayField;
    } else if (typeof lf?.displayField === 'string' && lf.displayField.trim() !== '') {
      displayVal = lf.displayField.includes(' - ')
        ? lf.displayField.split(' - ').map((s: string) => s.trim()).filter(Boolean)
        : (lf.displayField.includes(',')
            ? lf.displayField.split(',').map((s: string) => s.trim()).filter(Boolean)
            : [lf.displayField.trim()]);
    }

    const group = this.fb.group({
      localField: [lf?.localField || '', Validators.required],
      remoteTable: [lf?.remoteTable || '', Validators.required],
      remoteField: [lf?.remoteField || '', Validators.required],
      displayField: [displayVal, (control: any) => {
        const v = control.value;
        return (!v || (Array.isArray(v) && v.length === 0)) ? { required: true } : null;
      }]
    });

    group.get('remoteTable')?.valueChanges.subscribe(tbl => {
      if (tbl) {
        this.onRemoteTableChange(tbl);
      }
    });

    // Cargar campos remotos si ya tiene tabla inicial
    if (lf?.remoteTable) {
      this.onRemoteTableChange(lf.remoteTable);
    }

    return group;
  }

  /**
   * Obtiene el array de campos seleccionados para mostrar en el vínculo.
   */
  getDisplayFieldsArray(lf: any): string[] {
    const val = lf?.get ? lf.get('displayField')?.value : lf?.value?.displayField;
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.trim() !== '') {
      return val.includes(' - ')
        ? val.split(' - ').map(s => s.trim()).filter(Boolean)
        : (val.includes(',') ? val.split(',').map(s => s.trim()).filter(Boolean) : [val.trim()]);
    }
    return [];
  }

  /**
   * Agrega un campo a la lista de visualización en el orden en que se selecciona.
   */
  addDisplayField(lf: any, fieldName: string) {
    if (!fieldName) return;
    const current = this.getDisplayFieldsArray(lf);
    if (!current.includes(fieldName)) {
      const updated = [...current, fieldName];
      lf.get('displayField')?.setValue(updated);
      this.cdr.detectChanges();
    }
  }

  /**
   * Mueve un campo a la izquierda (-1) o a la derecha (+1) para cambiar el orden de aparición.
   */
  moveDisplayField(lf: any, index: number, delta: number) {
    const current = [...this.getDisplayFieldsArray(lf)];
    const target = index + delta;
    if (target < 0 || target >= current.length) return;
    const temp = current[index];
    current[index] = current[target];
    current[target] = temp;
    lf.get('displayField')?.setValue(current);
    this.cdr.detectChanges();
  }

  /**
   * Elimina un campo de la lista de visualización.
   */
  removeDisplayField(lf: any, index: number) {
    const current = [...this.getDisplayFieldsArray(lf)];
    current.splice(index, 1);
    lf.get('displayField')?.setValue(current);
    this.cdr.detectChanges();
  }

  /**
   * Genera el texto de vista previa en tiempo real del vínculo.
   */
  getPreviewDisplay(lf: any): string {
    const fields = this.getDisplayFieldsArray(lf);
    if (fields.length === 0) return '(Ningún campo seleccionado)';
    return fields.map(f => `[${f.toUpperCase()}]`).join(' - ');
  }

  /**
   * Retorna los campos de la tabla remota que aún no fueron agregados a la lista de visualización.
   */
  getAvailableFieldsToAdd(lf: any): string[] {
    const all = this.getCamposFor(lf);
    const selected = this.getDisplayFieldsArray(lf);
    return all.filter(f => !selected.includes(f));
  }

  addLinkedField() {
    this.linkedFields.push(this.createLinkedFieldGroup());
    this.cdr.detectChanges();
  }

  removeLinkedField(index: number) {
    this.linkedFields.removeAt(index);
    this.cdr.detectChanges();
  }

  addCalculatedField() {
    this.calculatedFields.push(this.createCalculatedFieldGroup());
    this.cdr.detectChanges();
  }

  removeCalculatedField(index: number) {
    this.calculatedFields.removeAt(index);
    this.cdr.detectChanges();
  }

  addRule() {
    this.rules.push(this.createRuleGroup());
    this.cdr.detectChanges();
  }

  removeRule(index: number) {
    this.rules.removeAt(index);
    this.cdr.detectChanges();
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
      console.error("Error al cargar la configuración de la tabla:", e);
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
    
    const rawLinkedFields = this.configForm.value.linkedFields || [];
    const normalizedLinkedFields = rawLinkedFields.map((lf: any) => {
      const displayFieldsArr: string[] = Array.isArray(lf.displayField)
        ? lf.displayField
        : (typeof lf.displayField === 'string' && lf.displayField.trim() !== '' ? [lf.displayField.trim()] : []);

      return {
        localField: lf.localField,
        remoteTable: lf.remoteTable,
        remoteField: lf.remoteField,
        displayField: displayFieldsArr.join(' - '),
        displayFields: displayFieldsArr
      };
    });

    const config = { 
      rules: this.configForm.value.rules,
      calculatedFields: this.configForm.value.calculatedFields,
      linkedFields: normalizedLinkedFields
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

  /**
   * Carga los campos de la tabla remota seleccionada invocando Tauri con { tabla: nombreTabla }.
   */
  async onRemoteTableChange(nombreTabla: string) {
    if (!nombreTabla) return;
    if (this.camposRemotos[nombreTabla] && this.camposRemotos[nombreTabla].length > 0) {
      this.cdr.detectChanges();
      return;
    }
    try {
      const camposRes: any[] = await invoke('get_campos', { tabla: nombreTabla });
      const listaCampos: string[] = (camposRes || [])
        .map((c: any) => c.Field ?? c.column_name ?? c.name ?? (typeof c === 'string' ? c : ''))
        .filter((c: string) => Boolean(c) && !c.toLowerCase().startsWith('sera_'));

      this.camposRemotos = {
        ...this.camposRemotos,
        [nombreTabla]: listaCampos,
        [nombreTabla.toLowerCase()]: listaCampos,
        [nombreTabla.toUpperCase()]: listaCampos
      };
      this.cdr.detectChanges();
    } catch (e) {
      console.error('Error al cargar campos de tabla remota', e);
      this.camposRemotos[nombreTabla] = [];
    }
  }

  /**
   * Retorna los campos remotos cargados para el FormGroup de vínculos indicado de forma pura.
   * Se usa en el template para los selects de remoteField y displayField.
   */
  getCamposFor(lf: any): string[] {
    const remoteTable = lf?.get ? lf.get('remoteTable')?.value : lf?.value?.remoteTable;
    if (!remoteTable) return [];
    return this.camposRemotos[remoteTable]
      || this.camposRemotos[remoteTable.toLowerCase()]
      || this.camposRemotos[remoteTable.toUpperCase()]
      || [];
  }

  /**
   * Lista de tablas disponibles formateadas para SeraSelectComponent.
   * Usa FormatName (reemplaza guiones bajos) + uppercase para la etiqueta.
   */
  get tablasFormateadas(): { value: string; label: string }[] {
    return this.tablasDisponibles.map(t => ({
      value: t.nombre_tabla,
      label: t.nombre_tabla.replace(/_/g, ' ').toUpperCase()
    }));
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
