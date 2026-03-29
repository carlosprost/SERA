import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, concatMap, switchMap } from 'rxjs/operators';
import { Observable, of, from } from 'rxjs';
import { invoke } from '@tauri-apps/api/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StoreActions } from './store.actions';
import { Campos } from '../interfaces/campos.interfaces';
import { ConfigData } from '../interfaces/configData.interfaces';
import { NewRecord, DeleteRecord } from '../interfaces/registros.interfaces';
import { Tablas, NuevaTabla, RestructureTable } from '../interfaces/tablas.interfaces';

/**
 * Effects de NgRx para SERA.
 * Utiliza Tauri IPC (invoke) en lugar de HTTP para comunicarse con el backend
 * Rust directamente, sin servidor intermedio.
 */
@Injectable()
export class StoreEffects {

  loadStores$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StoreActions.loadStores),
      concatMap(() =>
        this.getConfig().pipe(
          map(data => StoreActions.loadStoresSuccess({ data })),
          catchError(error => of(StoreActions.loadStoresFailure({ error }))))
      )
    );
  });

  loadUpdateConfig$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StoreActions.loadUpdateConfig),
      concatMap((props) =>
        this.updateConfig(props.data).pipe(
          map(data => StoreActions.loadUpdateConfigSuccess({ data })),
          catchError(error => of(StoreActions.loadUpdateConfigFailure({ error }))))
      )
    );
  });

  loadTablas$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StoreActions.loadListadoTablas),
      concatMap(() =>
        this.getTablas().pipe(
          map(tablas => StoreActions.loadListadoTablasSuccess({ tablas })),
          catchError(error => of(StoreActions.loadListadoTablasFailure({ error }))))
      )
    );
  });

  loadCampos$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StoreActions.loadCampos),
      concatMap((props) =>
        this.getCampos(props.tabla).pipe(
          map(campos => StoreActions.loadCamposSuccess({ campos })),
          catchError(error => of(StoreActions.loadCamposFailure({ error }))))
      )
    );
  });

  loadContenido$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StoreActions.loadContenido),
      concatMap((props) =>
        this.getContenido(props.tabla).pipe(
          map(contenido => StoreActions.loadContenidoSuccess({ contenido })),
          catchError(error => of(StoreActions.loadContenidoFailure({ error }))))
      )
    );
  });

  loadNewTable$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StoreActions.loadNewTable),
      concatMap((props) =>
        this.createTable(props.tabla).pipe(
          switchMap(message => {
            this.snackBar.open("Tabla creada con éxito", "Listo", { duration: 3000 });
            return from([
              StoreActions.loadNewTableSuccess({ message }),
              StoreActions.loadListadoTablas()
            ]);
          }),
          catchError(error => {
            this.snackBar.open("Error al crear la tabla. Verificá que el nombre sea único.", "Cerrar", { duration: 5000 });
            return of(StoreActions.loadNewTableFailure({ error }));
          }))
      )
    );
  });

  loadDeleteTable$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StoreActions.loadDeleteTable),
      concatMap((props) =>
        this.deleteTable(props.tabla).pipe(
          switchMap(message => {
            this.snackBar.open("Tabla eliminada correctamente", "Listo", { duration: 3000 });
            return from([
              StoreActions.loadDeleteTableSuccess({ message }),
              StoreActions.loadListadoTablas()
            ]);
          }),
          catchError(error => {
            this.snackBar.open("Error al eliminar la tabla.", "Cerrar", { duration: 5000 });
            return of(StoreActions.loadDeleteTableFailure({ error }));
          }))
      )
    );
  });

  loadNewRecord$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StoreActions.loadNewRecord),
      concatMap((props) =>
        this.newRecord(props.registro).pipe(
          switchMap(message => from([
            StoreActions.loadNewRecordSuccess({ message }),
            StoreActions.loadContenido({ tabla: props.registro.tabla })
          ])),
          catchError(error => of(StoreActions.loadNewRecordFailure({ error }))))
      )
    );
  });

  loadUpdateRecord$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StoreActions.loadUpdateRecord),
      concatMap((props) =>
        this.updateRecord(props.registro).pipe(
          switchMap(message => from([
            StoreActions.loadUpdateRecordSuccess({ message }),
            StoreActions.loadContenido({ tabla: props.registro.tabla })
          ])),
          catchError(error => of(StoreActions.loadUpdateRecordFailure({ error }))))
      )
    );
  });

  loadDeleteRecord$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StoreActions.loadDeleteRecord),
      concatMap((props) =>
        this.deleteRecord(props.deleteRecord).pipe(
          switchMap(message => from([
            StoreActions.loadDeleteRecordSuccess({ message }),
            StoreActions.loadContenido({ tabla: props.deleteRecord.tabla })
          ])),
          catchError(error => of(StoreActions.loadDeleteRecordFailure({ error }))))
      )
    );
  });

  loadRestructureTable$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StoreActions.loadRestructureTable),
      concatMap((props) =>
        this.restructureTable(props.info).pipe(
          switchMap(message => {
            this.snackBar.open("Estructura de tabla actualizada correctamente", "Listo", { duration: 3000 });
            return from([
              StoreActions.loadRestructureTableSuccess({ message }),
              StoreActions.loadListadoTablas(),
              StoreActions.loadCampos({ tabla: props.info.nombre_nuevo })
            ]);
          }),
          catchError(error => {
            this.snackBar.open("Error en la reestructuración. Verificá los nombres de columnas y tipos.", "Cerrar", { duration: 5000 });
            return of(StoreActions.loadRestructureTableFailure({ error }));
          }))
      )
    );
  });

  constructor(
    private actions$: Actions,
    private snackBar: MatSnackBar
  ) {}

  // ─── Métodos de acceso al backend vía Tauri IPC ───────────────────────────

  getConfig(): Observable<ConfigData> {
    return from(invoke<ConfigData>('get_config'));
  }

  updateConfig(config: ConfigData): Observable<ConfigData> {
    return from(invoke<ConfigData>('update_config', { config }));
  }

  getTablas(): Observable<Tablas[]> {
    return from(invoke<Tablas[]>('get_tablas'));
  }

  getCampos(tabla: string): Observable<Campos[]> {
    return from(invoke<Campos[]>('get_campos', { tabla }));
  }

  getContenido(tabla: string): Observable<any> {
    return from(invoke<any>('get_contenido', { tabla }));
  }

  createTable(tabla: NuevaTabla): Observable<string> {
    return from(invoke<string>('crear_tabla', { tabla }));
  }

  deleteTable(tabla: string): Observable<string> {
    return from(invoke<string>('eliminar_tabla', { nombreTabla: tabla }));
  }

  newRecord(registro: NewRecord): Observable<string> {
    return from(invoke<string>('nuevo_registro', { registro }));
  }

  updateRecord(registro: NewRecord): Observable<string> {
    return from(invoke<string>('actualizar_registro', { registro }));
  }

  deleteRecord(record: DeleteRecord): Observable<string> {
    return from(invoke<string>('eliminar_registro', { deleteRecord: record }));
  }

  restructureTable(info: RestructureTable): Observable<string> {
    return from(invoke<string>('reestructurar_tabla', { info }));
  }
}
