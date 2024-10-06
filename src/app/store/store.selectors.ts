import { createFeatureSelector, createSelector } from '@ngrx/store';
import * as fromStore from './store.reducer';

export const selectStoreState = createFeatureSelector<fromStore.State>(
  fromStore.storeFeatureKey
);

export const selectConfigData = createSelector(
  selectStoreState,
  (state: fromStore.State) => state.data
);

export const selectTablas = createSelector(
  selectStoreState,
  (state: fromStore.State) => state.tablas
);

export const selectCampos = createSelector(
  selectStoreState,
  (state: fromStore.State) => state.campos
);

export const selectContenido = createSelector(
  selectStoreState,
  (state: fromStore.State) => state.contenido
);

export const selectError = createSelector(
  selectStoreState,
  (state: fromStore.State) => state.error
);

export const selectSuccess = createSelector(
  selectStoreState,
  (state: fromStore.State) => state.message
);

