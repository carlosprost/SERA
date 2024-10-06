import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, concatMap } from 'rxjs/operators';
import { Observable, EMPTY, of } from 'rxjs';
import { StoreActions } from './store.actions';
import { HttpClient } from '@angular/common/http';
import { Campos } from '../interfaces/campos.interfaces';
import { ConfigData } from '../interfaces/configData.interfaces';
import { NewRecord, DeleteRecord } from '../interfaces/registros.interfaces';
import { Tablas, NuevaTabla } from '../interfaces/tablas.interfaces';


@Injectable()
export class StoreEffects {

  loadStores$ = createEffect(() => {
    return this.actions$.pipe(

      ofType(StoreActions.loadStores),
      concatMap(() =>
        /** An EMPTY observable only emits completion. Replace with your own observable API request */
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
        /** An EMPTY observable only emits completion. Replace with your own observable API request */
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
        /** An EMPTY observable only emits completion. Replace with your own observable API request */
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
        /** An EMPTY observable only emits completion. Replace with your own observable API request */
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
        /** An EMPTY observable only emits completion. Replace with your own observable API request */
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
        /** An EMPTY observable only emits completion. Replace with your own observable API request */
        this.createTable(props.tabla).pipe(
          map(message => StoreActions.loadNewTableSuccess({ message })),
          catchError(error => of(StoreActions.loadNewTableFailure({ error }))))
      )
    );
  });

  loadDeleteTable$ = createEffect(() => {
    return this.actions$.pipe(

      ofType(StoreActions.loadDeleteTable),
      concatMap((props) =>
        /** An EMPTY observable only emits completion. Replace with your own observable API request */
        this.deleteTable(props.tabla).pipe(
          map(message => StoreActions.loadDeleteTableSuccess({ message })),
          catchError(error => of(StoreActions.loadDeleteTableFailure({ error }))))
      )
    );
  });

  loadNewRecord$ = createEffect(() => {
    return this.actions$.pipe(

      ofType(StoreActions.loadNewRecord),
      concatMap((props) =>
        /** An EMPTY observable only emits completion. Replace with your own observable API request */
        this.newRecord(props.registro).pipe(
          map(message => StoreActions.loadNewRecordSuccess({ message })),
          catchError(error => of(StoreActions.loadNewRecordFailure({ error }))))
      )
    );
  });

  loadUpdateRecord$ = createEffect(() => {
    return this.actions$.pipe(

      ofType(StoreActions.loadUpdateRecord),
      concatMap((props) =>
        /** An EMPTY observable only emits completion. Replace with your own observable API request */
        this.updateRecord(props.registro).pipe(
          map(message => StoreActions.loadUpdateRecordSuccess({ message })),
          catchError(error => of(StoreActions.loadUpdateRecordFailure({ error }))))
      )
    );
  });

  loadDeleteRecord$ = createEffect(() => {
    return this.actions$.pipe(

      ofType(StoreActions.loadDeleteRecord),
      concatMap((props) =>
        /** An EMPTY observable only emits completion. Replace with your own observable API request */
        this.deleteRecord(props.deleteRecord).pipe(
          map(message => StoreActions.loadDeleteRecordSuccess({ message })),
          catchError(error => of(StoreActions.loadDeleteRecordFailure({ error }))))
      )
    );
  });


  constructor(private actions$: Actions, private http: HttpClient) {}

  getConfig(): Observable<ConfigData> {
    return this.http.get<ConfigData>('http://localhost:3000/config');
  }

  updateConfig(config: ConfigData): Observable<ConfigData> {
    return this.http.put<ConfigData>('http://localhost:3000/config', config);
  }

  getTablas(): Observable<Tablas[]> {
    return this.http.get<Tablas[]>('http://localhost:3000/tablas');
  }

  getCampos(tabla: string): Observable<Campos[]> {
    return this.http.get<Campos[]>(`http://localhost:3000/campos/${tabla}`);
  }

  getContenido(tabla: string): Observable<any> {
    return this.http.get<any>(`http://localhost:3000/contenido/${tabla}`);
  }

  createTable(nuevaTabla: NuevaTabla): Observable<string> {
    return this.http.post<string>(`http://localhost:3000/crearTabla`, nuevaTabla);
  }

  deleteTable(tabla: string): Observable<string> {
    return this.http.delete<string>(`http://localhost:3000/eliminarTabla/${tabla}`);
  }

  newRecord(record: NewRecord): Observable<string> {
    return this.http.post<string>(`http://localhost:3000/registro`, record);
  }

  updateRecord(record: NewRecord): Observable<string> {
    return this.http.put<string>(`http://localhost:3000/registro`, record);
  }

  deleteRecord(record: DeleteRecord): Observable<string> {
    return this.http.delete<string>(`http://localhost:3000/registro/${record.tabla}/${record.ids}`);
  }
}
