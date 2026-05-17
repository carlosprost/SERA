/**
 * Configuración central de identidad de versión de SERA.
 * Al hacer un release, solo se actualizan estos valores
 * y automáticamente se propagan a toda la app.
 */

/** Número de versión — debe coincidir con package.json, Cargo.toml y tauri.conf.json */
export const APP_VERSION = '4.0.0';

/** Nombre en código según VERSIONS_CODENAMES.md */
export const APP_CODENAME = 'Poseidón';

/** Código de parche (Constelación + número de versión) */
export const APP_PATCH_CODE = 'Orion-400';
