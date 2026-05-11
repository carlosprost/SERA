export interface Tablas {
    id_tablas: number;
    nombre_tabla: string;
}

export interface NuevaTabla {
    nombre: string;
    campos: string;
    config?: string; // JSON string de TableConfig
}

export interface TableRule {
    type: 'simple' | 'formula';
    field: string;
    operator: string;
    value: string;
    formula?: string;
    backgroundColor: string;
    textColor: string;
    applyTo: 'row' | 'cell';
    targetColumn?: string;
}

export interface CalculatedField {
    targetField: string;
    formula: string;
    isActive: boolean;
}

export interface LinkedField {
    localField: string;
    remoteTable: string;
    remoteField: string;
    displayField: string;
}

export interface TableConfig {
    rules: TableRule[];
    calculatedFields?: CalculatedField[];
    linkedFields?: LinkedField[];
    allowAttachments?: boolean; // Nuevo campo opcional
}

export interface FieldMapping {
    old_name: string;
    new_name: string;
}

export interface RestructureTable {
    nombre_viejo: string;
    nombre_nuevo: string;
    campos_schema: string;
    mapeo: FieldMapping[];
    config?: string; // JSON string de TableConfig
}