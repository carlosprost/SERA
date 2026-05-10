// Previene ventana de consola adicional en Windows en builds de producción.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod database;
mod models;
mod security;

use commands::DbPath;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Obtener el directorio de datos de la app (ej: %APPDATA%\sera en Windows)
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("[SERA] No se pudo obtener el directorio de datos de la aplicación");

            // Crear el directorio si no existe
            std::fs::create_dir_all(&data_dir)
                .expect("[SERA] No se pudo crear el directorio de datos");

            let db_path = data_dir.join("sera.db");

            // Inicializar el esquema de la base de datos
            database::inicializar_db(db_path.as_path())
                .expect("[SERA] No se pudo inicializar la base de datos SQLite");

            // Registrar la ruta de la DB como estado compartido (thread-safe)
            app.manage(DbPath(db_path));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::update_config,
            commands::get_tablas,
            commands::crear_tabla,
            commands::get_tabla_config,
            commands::update_tabla_config,
            commands::eliminar_tabla,
            commands::get_campos,
            commands::get_contenido,
            commands::nuevo_registro,
            commands::actualizar_registro,
            commands::eliminar_registro,
            commands::reestructurar_tabla,
            commands::exportar_tabla,
            commands::importar_tabla,
        ])
        .run(tauri::generate_context!())
        .expect("[SERA] Error al inicializar la aplicación");
}
