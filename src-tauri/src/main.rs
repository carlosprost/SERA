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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir().expect("[SERA] No se pudo obtener el directorio de datos");
            let db_path = data_dir.join("sera.db");

            // MIGRACIÓN: De 'SERA' (v1/Legacy) a 'WolfTeI.SERADesktop' (Store/v2)
            let old_data_dir = data_dir.parent().unwrap().join("SERA");
            let db_exists_and_not_empty = db_path.exists() && std::fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0) > 100;

            if old_data_dir.exists() && !db_exists_and_not_empty {
                println!("[SERA] Identificada migración pendiente desde la carpeta original...");
                let _ = std::fs::create_dir_all(&data_dir);
                let old_db = old_data_dir.join("sera.db");
                if old_db.exists() {
                    let _ = std::fs::copy(&old_db, &db_path);
                }
                
                let old_attachments = old_data_dir.join("attachments");
                let new_attachments = data_dir.join("attachments");
                if old_attachments.exists() {
                    let _ = std::fs::create_dir_all(&new_attachments);
                    if let Ok(entries) = std::fs::read_dir(old_attachments) {
                        for entry in entries.flatten() {
                            let path = entry.path();
                            if path.is_file() {
                                let dest = new_attachments.join(path.file_name().unwrap());
                                let _ = std::fs::copy(path, dest);
                            }
                        }
                    }
                }
                println!("[SERA] Migración para Windows Store completada con éxito.");
            }

            // Crear el directorio si no existe
            std::fs::create_dir_all(&data_dir)
                .expect("[SERA] No se pudo crear el directorio de datos");

            // Crear carpeta de adjuntos
            let attachments_dir = data_dir.join("attachments");
            std::fs::create_dir_all(&attachments_dir)
                .expect("[SERA] No se pudo crear el directorio de adjuntos");

            let db_path = data_dir.join("sera.db");
            println!("[SERA] Data Directory: {:?}", data_dir);
            println!("[SERA] Database Path: {:?}", db_path);

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
            commands::importar_bulk,
            commands::get_adjuntos,
            commands::guardar_adjunto,
            commands::eliminar_adjunto,
            commands::abrir_adjunto,
            commands::get_adjunto_base64,
            commands::get_global_stats,
            commands::open_attachments_folder,
            commands::search_global,
        ])
        .run(tauri::generate_context!())
        .expect("[SERA] Error al inicializar la aplicación");
}
