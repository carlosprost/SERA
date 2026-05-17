import { createFeature, createReducer, on } from '@ngrx/store';
import { StoreActions } from './store.actions';
import { Campos } from '../interfaces/campos.interfaces';
import { ConfigData } from '../interfaces/configData.interfaces';
import { Tablas } from '../interfaces/tablas.interfaces';

export const storeFeatureKey = 'store';

export interface State {
  data: ConfigData;
  tablas: Tablas[];
  campos: { [tabla: string]: Campos[] };
  contenido: { [tabla: string]: any[] };
  message: string;
  error: unknown;
}

export const initialState: State = {
  data: {
    nombreApp: '',
    user: {
      nombre: '',
      grado: '',
      institucion: '',
      dependencia: '',
      oficina: '',
      membrete: '',
    },
  },
  tablas: [],
  campos: {},
  contenido: {},
  message: '',
  error: null,
};

export const reducer = createReducer(
  initialState,
  on(StoreActions.loadStores, (state) => state),
  on(StoreActions.loadStoresSuccess, (state, { data }) => ({
    ...state,
    data: data,
  })),
  on(StoreActions.loadStoresFailure, (state, { error }) => ({
    ...state,
    error: error,
  })),
  on(StoreActions.loadUpdateConfig, (state) => state),
  on(StoreActions.loadUpdateConfigSuccess, (state, { data }) => ({
    ...state,
    data: data,
  })),
  on(StoreActions.loadUpdateConfigFailure, (state, { error }) => ({
    ...state,
    error: error,
  })),
  on(StoreActions.loadListadoTablas, (state) => state),
  on(StoreActions.loadListadoTablasSuccess, (state, { tablas }) => ({
    ...state,
    tablas: tablas,
  })),
  on(StoreActions.loadListadoTablasFailure, (state, { error }) => ({
    ...state,
    error: error,
  })),
  on(StoreActions.loadCampos, (state) => state),
  on(StoreActions.loadCamposSuccess, (state, { tabla, campos }) => ({
    ...state,
    campos: {
      ...state.campos,
      [tabla.toLowerCase()]: campos
    },
  })),
  on(StoreActions.loadCamposFailure, (state, { error }) => ({
    ...state,
    error: error,
  })),
  on(StoreActions.loadContenido, (state) => state),
  on(StoreActions.loadContenidoSuccess, (state, { tabla, contenido }) => ({
    ...state,
    contenido: {
      ...state.contenido,
      [tabla.toLowerCase()]: contenido
    },
  })),
  on(StoreActions.loadContenidoFailure, (state, { error }) => ({
    ...state,
    error: error,
  })),
  on(StoreActions.loadNewTable, (state) => state),
  on(StoreActions.loadNewTableSuccess, (state, { message }) => ({
    ...state,
    message: message,
  })),
  on(StoreActions.loadNewTableFailure, (state, { error }) => ({
    ...state,
    error: error,
  })),
  on(StoreActions.loadDeleteTable, (state) => state),
  on(StoreActions.loadDeleteTableSuccess, (state, { message }) => ({
    ...state,
    message: message,
  })),
  on(StoreActions.loadDeleteTableFailure, (state, { error }) => ({
    ...state,
    error: error,
  })),
  on(StoreActions.loadNewRecord, (state) => state),
  on(StoreActions.loadNewRecordSuccess, (state, { id }) => ({
    ...state,
    message: id.toString(),
  })),
  on(StoreActions.loadNewRecordFailure, (state, { error }) => ({
    ...state,
    error: error,
  })),
  on(StoreActions.loadUpdateRecord, (state) => state),
  on(StoreActions.loadUpdateRecordSuccess, (state, { message }) => ({
    ...state,
    message: message,
  })),
  on(StoreActions.loadUpdateRecordFailure, (state, { error }) => ({
    ...state,
    error: error,
  })),
  on(StoreActions.loadDeleteRecord, (state) => state),
  on(StoreActions.loadDeleteRecordSuccess, (state, { message }) => ({
    ...state,
    message: message,
  })),
  on(StoreActions.loadDeleteRecordFailure, (state, { error }) => ({
    ...state,
    error: error,
  }))

);

export const storeFeature = createFeature({
  name: storeFeatureKey,
  reducer,
});

