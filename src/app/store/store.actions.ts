import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { ConfigData } from '../interfaces/configData.interfaces';
import { NewRecord, DeleteRecord } from '../interfaces/registros.interfaces';
import { Tablas, NuevaTabla, RestructureTable } from '../interfaces/tablas.interfaces';

export const StoreActions = createActionGroup({
  source: 'Store',
  events: {
    'Load Stores': emptyProps(),
    'Load Stores Success': props<{ data: ConfigData }>(),
    'Load Stores Failure': props<{ error: unknown }>(),
    'Load Update Config': props<{ data: ConfigData }>(),
    'Load Update Config Success': props<{ data: ConfigData }>(),
    'Load Update Config Failure': props<{ error: unknown }>(),
    'Load Listado Tablas': emptyProps(),
    'Load Listado Tablas Success': props<{ tablas: Tablas[] }>(),
    'Load Listado Tablas Failure': props<{ error: unknown }>(),
    'Load Campos': props<{ tabla: string }>(),
    'Load Campos Success': props<{ campos: any }>(),
    'Load Campos Failure': props<{ error: unknown }>(),
    'Load Contenido': props<{ tabla: string }>(),
    'Load Contenido Success': props<{ contenido: any }>(),
    'Load Contenido Failure': props<{ error: unknown }>(),
    'Load New Table': props<{ tabla: NuevaTabla }>(),
    'Load New Table Success': props<{ message: string }>(),
    'Load New Table Failure': props<{ error: unknown }>(),
    'Load Delete Table': props<{ tabla: string }>(),
    'Load Delete Table Success': props<{ message: string }>(),
    'Load Delete Table Failure': props<{ error: unknown }>(),
    'Load New Record': props<{ registro: NewRecord }>(),
    'Load New Record Success': props<{ id: number }>(),
    'Load New Record Failure': props<{ error: unknown }>(),
    'Load Update Record': props<{ registro: NewRecord }>(),
    'Load Update Record Success': props<{ message: string }>(),
    'Load Update Record Failure': props<{ error: unknown }>(),
    'Load Delete Record': props<{ deleteRecord: DeleteRecord }>(),
    'Load Delete Record Success': props<{ message: string }>(),
    'Load Delete Record Failure': props<{ error: unknown }>(),
    'Load Restructure Table': props<{ info: RestructureTable }>(),
    'Load Restructure Table Success': props<{ message: string }>(),
    'Load Restructure Table Failure': props<{ error: unknown }>(),
  }
});
