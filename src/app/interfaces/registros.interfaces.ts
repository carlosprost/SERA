export interface NewRecord {
    id?: number | null;
    tabla: string;
    campos: string[];
    contenido: string[];
}

export interface DeleteRecord {
    tabla: string;
    ids: number;
}