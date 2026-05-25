import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, concatMap, switchMap } from 'rxjs/operators';
import { Observable, of, from, throwError } from 'rxjs';
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
          map(campos => StoreActions.loadCamposSuccess({ tabla: props.tabla, campos })),
          catchError(error => of(StoreActions.loadCamposFailure({ error }))))
      )
    );
  });

  loadContenido$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StoreActions.loadContenido),
      concatMap((props) =>
        this.getContenido(props.tabla).pipe(
          map(contenido => StoreActions.loadContenidoSuccess({ tabla: props.tabla, contenido })),
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
          switchMap(id => from([
            StoreActions.loadNewRecordSuccess({ id }),
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
              StoreActions.loadCampos({ tabla: props.info.nombre_nuevo }),
              StoreActions.loadContenido({ tabla: props.info.nombre_nuevo })
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
    const isRemoteTable = tabla.toLowerCase().startsWith('remoto_');
    let conn: any = null;
    const connStr = localStorage.getItem('remote_conn_' + tabla.toLowerCase());
    if (connStr) {
      try {
        conn = JSON.parse(connStr);
        if (!conn || !conn.host || !conn.token || !conn.remoteTableName) {
          localStorage.removeItem('remote_conn_' + tabla.toLowerCase());
          conn = null;
        }
      } catch (err) {
        localStorage.removeItem('remote_conn_' + tabla.toLowerCase());
        conn = null;
      }
    }

    if (conn) {
      return from(
        fetch(`${conn.host}/api/v1/tablas/${conn.remoteTableName}/campos`, {
          headers: { 'Authorization': `Bearer ${conn.token}` }
        }).then(r => {
          if (!r.ok) throw new Error('Error al obtener columnas de red local: ' + r.statusText);
          return r.json();
        }).then((campos: Campos[]) => {
          // Normalización dinámica de ID en campos para evitar retornos tempranos erróneos
          const expectedIdField = `id_${tabla.toLowerCase()}`;
          const alreadyHasExpected = campos.some(c => c.Field.toLowerCase() === expectedIdField);
          if (!alreadyHasExpected) {
            const originalIdField = campos.find(c => c.Field.toLowerCase().startsWith('id_'));
            if (originalIdField) {
              campos.push({
                ...originalIdField,
                Field: expectedIdField
              });
            }
          }
          return campos;
        }).catch(err => {
          this.snackBar.open("Error al sincronizar columnas remotas: " + (err.message || err), "Cerrar", { duration: 5000 });
          throw err;
        })
      );
    }

    // AUTO-DETECCION EN FRÍO: Si no está en localStorage pero es tabla remota virtual
    if (isRemoteTable) {
      return from(
        invoke<string>('get_tabla_config', { nombreTabla: tabla }).then(configJson => {
          if (configJson && configJson.trim() !== '' && configJson !== '{}') {
            try {
              const config = JSON.parse(configJson);
              if (config.isRemote) {
                const connInfo = {
                  host: config.remoteUrl,
                  token: config.remoteToken,
                  remoteTableName: config.remoteTableName
                };
                localStorage.setItem('remote_conn_' + tabla.toLowerCase(), JSON.stringify(connInfo));
                return fetch(`${connInfo.host}/api/v1/tablas/${connInfo.remoteTableName}/campos`, {
                  headers: { 'Authorization': `Bearer ${connInfo.token}` }
                }).then(r => {
                  if (!r.ok) throw new Error('Error al obtener columnas de red local: ' + r.statusText);
                  return r.json();
                }).then((campos: Campos[]) => {
                  const expectedIdField = `id_${tabla.toLowerCase()}`;
                  const alreadyHasExpected = campos.some(c => c.Field.toLowerCase() === expectedIdField);
                  if (!alreadyHasExpected) {
                    const originalIdField = campos.find(c => c.Field.toLowerCase().startsWith('id_'));
                    if (originalIdField) {
                      campos.push({
                        ...originalIdField,
                        Field: expectedIdField
                      });
                    }
                  }
                  return campos;
                });
              }
            } catch (e) {
              console.error('Error al auto-cargar config de red:', e);
              this.snackBar.open("Fallo de conexión LAN: Verificá que el Host esté encendido.", "Cerrar", { duration: 5000 });
              throw e;
            }
          }
          throw new Error('Configuración de tabla remota no encontrada.');
        }).catch(err => {
          this.snackBar.open("Error LAN en auto-detección: " + (err.message || err), "Cerrar", { duration: 5000 });
          throw err;
        })
      );
    }

    return from(invoke<Campos[]>('get_campos', { tabla }));
  }

  getContenido(tabla: string): Observable<any> {
    const isRemoteTable = tabla.toLowerCase().startsWith('remoto_');
    let conn: any = null;
    const connStr = localStorage.getItem('remote_conn_' + tabla.toLowerCase());
    if (connStr) {
      try {
        conn = JSON.parse(connStr);
        if (!conn || !conn.host || !conn.token || !conn.remoteTableName) {
          localStorage.removeItem('remote_conn_' + tabla.toLowerCase());
          conn = null;
        }
      } catch (err) {
        localStorage.removeItem('remote_conn_' + tabla.toLowerCase());
        conn = null;
      }
    }

    if (conn) {
      return from(
        fetch(`${conn.host}/api/v1/tablas/${conn.remoteTableName}/contenido`, {
          headers: { 'Authorization': `Bearer ${conn.token}` }
        }).then(r => {
          if (!r.ok) throw new Error('Error al obtener filas de red local: ' + r.statusText);
          return r.json();
        }).then(filas => {
          // Normalización dinámica de IDs de registros en lectura
          const expectedIdKey = `id_${tabla.toLowerCase()}`;
          return filas.map((row: any) => {
            const normalized = { ...row };
            const originalIdKey = Object.keys(row).find(k => k.toLowerCase().startsWith('id_') && k.toLowerCase() !== expectedIdKey);
            if (originalIdKey) {
              normalized[expectedIdKey] = row[originalIdKey];
            }
            return normalized;
          });
        }).catch(err => {
          this.snackBar.open("Fallo de sincronización LAN: El host remoto no responde.", "Cerrar", { duration: 5000 });
          throw err;
        })
      );
    }

    // AUTO-DETECCION EN FRÍO: Si no está en localStorage pero es tabla remota virtual
    if (isRemoteTable) {
      return from(
        invoke<string>('get_tabla_config', { nombreTabla: tabla }).then(configJson => {
          if (configJson && configJson.trim() !== '' && configJson !== '{}') {
            try {
              const config = JSON.parse(configJson);
              if (config.isRemote) {
                const connInfo = {
                  host: config.remoteUrl,
                  token: config.remoteToken,
                  remoteTableName: config.remoteTableName
                };
                localStorage.setItem('remote_conn_' + tabla.toLowerCase(), JSON.stringify(connInfo));
                return fetch(`${connInfo.host}/api/v1/tablas/${connInfo.remoteTableName}/contenido`, {
                  headers: { 'Authorization': `Bearer ${connInfo.token}` }
                }).then(r => {
                  if (!r.ok) throw new Error('Error al obtener filas de red local: ' + r.statusText);
                  return r.json();
                }).then(filas => {
                  const expectedIdKey = `id_${tabla.toLowerCase()}`;
                  return filas.map((row: any) => {
                    const normalized = { ...row };
                    const originalIdKey = Object.keys(row).find(k => k.toLowerCase().startsWith('id_') && k.toLowerCase() !== expectedIdKey);
                    if (originalIdKey) {
                      normalized[expectedIdKey] = row[originalIdKey];
                    }
                    return normalized;
                  });
                });
              }
            } catch (e) {
              console.error('Error al auto-cargar config de red:', e);
              this.snackBar.open("Fallo de sincronización LAN al auto-conectar.", "Cerrar", { duration: 5000 });
              throw e;
            }
          }
          throw new Error('Configuración de tabla remota no encontrada.');
        }).catch(err => {
          this.snackBar.open("Fallo de conexión LAN: " + (err.message || err), "Cerrar", { duration: 5000 });
          throw err;
        })
      );
    }

    return from(invoke<any>('get_contenido', { tabla }));
  }

  createTable(tabla: NuevaTabla): Observable<string> {
    return from(invoke<string>('crear_tabla', { tabla }));
  }

  deleteTable(tabla: string): Observable<string> {
    return from(invoke<string>('eliminar_tabla', { nombreTabla: tabla }));
  }

  newRecord(registro: NewRecord): Observable<number> {
    const connStr = localStorage.getItem('remote_conn_' + registro.tabla.toLowerCase());
    if (connStr) {
      try {
        const conn = JSON.parse(connStr);
        // Filtrar cualquier campo que empiece con id_ de la tabla local del cliente
        const cleanCampos: string[] = [];
        const cleanContenido: string[] = [];
        const localIdKey = `id_${registro.tabla.toLowerCase()}`;
        
        registro.campos.forEach((campo, idx) => {
          if (campo.toLowerCase() !== localIdKey) {
            cleanCampos.push(campo);
            cleanContenido.push(registro.contenido[idx]);
          }
        });

        const payload = {
          campos: cleanCampos,
          contenido: cleanContenido
        };
        return from(
          fetch(`${conn.host}/api/v1/tablas/${conn.remoteTableName}/registro`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${conn.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          }).then(async r => {
            if (!r.ok) {
              const err = await r.json().catch(() => ({ error: 'Error en la petición de red local' }));
              throw new Error(err.error || 'Error de red en inserción');
            }
            const res = await r.json();
            return res.insertedId as number;
          })
        );
      } catch (err: any) {
        console.error('Error al procesar registro remoto:', err);
        return throwError(() => err);
      }
    }
    return from(invoke<number>('nuevo_registro', { registro }));
  }

  updateRecord(registro: NewRecord): Observable<string> {
    const connStr = localStorage.getItem('remote_conn_' + registro.tabla.toLowerCase());
    if (connStr) {
      try {
        const conn = JSON.parse(connStr);
        // Filtrar cualquier campo que empiece con id_ de la tabla local del cliente
        const cleanCampos: string[] = [];
        const cleanContenido: string[] = [];
        const localIdKey = `id_${registro.tabla.toLowerCase()}`;
        
        registro.campos.forEach((campo, idx) => {
          if (campo.toLowerCase() !== localIdKey) {
            cleanCampos.push(campo);
            cleanContenido.push(registro.contenido[idx]);
          }
        });

        const payload = {
          id: registro.id,
          campos: cleanCampos,
          contenido: cleanContenido
        };
        return from(
          fetch(`${conn.host}/api/v1/tablas/${conn.remoteTableName}/registro`, {
            method: 'PUT',
            headers: { 
              'Authorization': `Bearer ${conn.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          }).then(async r => {
            if (!r.ok) {
              const err = await r.json().catch(() => ({ error: 'Error en la actualización remota' }));
              throw new Error(err.error || 'Error de red en actualización');
            }
            return 'exito';
          })
        );
      } catch (err: any) {
        console.error('Error al procesar actualización remota:', err);
        return throwError(() => err);
      }
    }
    return from(invoke<string>('actualizar_registro', { registro }));
  }

  deleteRecord(record: DeleteRecord): Observable<string> {
    const connStr = localStorage.getItem('remote_conn_' + record.tabla.toLowerCase());
    if (connStr) {
      try {
        const conn = JSON.parse(connStr);
        const payload = {
          id: record.ids
        };
        return from(
          fetch(`${conn.host}/api/v1/tablas/${conn.remoteTableName}/registro`, {
            method: 'DELETE',
            headers: { 
              'Authorization': `Bearer ${conn.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          }).then(async r => {
            if (!r.ok) {
              const err = await r.json().catch(() => ({ error: 'Error en la eliminación remota' }));
              throw new Error(err.error || 'Error de red en borrado');
            }
            return 'exito';
          })
        );
      } catch (err: any) {
        console.error('Error al procesar borrado remoto:', err);
        return throwError(() => err);
      }
    }
    return from(invoke<string>('eliminar_registro', { deleteRecord: record }));
  }

  restructureTable(info: RestructureTable): Observable<string> {
    return from(invoke<string>('reestructurar_tabla', { info }));
  }
}
