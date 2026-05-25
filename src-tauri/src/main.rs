// Previene ventana de consola adicional en Windows en builds de producción.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod commands;
mod database;
mod models;
mod security;

use commands::{DbPath, ApiShutdownChannel};
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

            // MIGRACIÓN: De 'ar.com.wolftei.sera' o 'SERA' a 'WolfTeI.SERADesktop' (Store/v2)
            let old_data_dir_1 = data_dir.parent().unwrap().join("ar.com.wolftei.sera");
            let old_data_dir_2 = data_dir.parent().unwrap().join("SERA");
            
            let old_data_dir = if old_data_dir_1.exists() {
                old_data_dir_1
            } else {
                old_data_dir_2
            };

            let db_exists_and_not_empty = db_path.exists() && std::fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0) > 100;

            if old_data_dir.exists() && !db_exists_and_not_empty {
                println!("[SERA] Identificada migración pendiente desde la carpeta original...");
                let _ = std::fs::create_dir_all(&data_dir);
                let old_db = old_data_dir.join("sera.db");
                let mut migracion_exitosa = true;

                if old_db.exists() {
                    if std::fs::copy(&old_db, &db_path).is_err() {
                        migracion_exitosa = false;
                        println!("[SERA] Error al copiar sera.db");
                    }
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
                                if std::fs::copy(&path, &dest).is_err() {
                                    migracion_exitosa = false;
                                    println!("[SERA] Error al copiar adjunto: {:?}", path);
                                }
                            }
                        }
                    }
                }

                if migracion_exitosa {
                    println!("[SERA] Migración completada con éxito. Limpiando archivos viejos...");
                    let _ = std::fs::remove_dir_all(&old_data_dir);
                } else {
                    println!("[SERA] Advertencia: Hubo problemas durante la migración, no se borraron los archivos originales.");
                }
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

            // Inicializar el estado de apagado asíncrono de la API
            let shutdown_state = ApiShutdownChannel(std::sync::Mutex::new(None));

            // Iniciar servidor local si corresponde
            if let Ok(config) = database::get_config(&db_path) {
                if config.user.api_enabled == 1 {
                    let app_handle_clone = app.handle().clone();
                    let db_path_clone = db_path.clone();
                    let port = config.user.api_port as u16;

                    if let Ok(shutdown_tx) = api::iniciar_servidor_api(app_handle_clone, db_path_clone, port) {
                        *shutdown_state.0.lock().unwrap() = Some(shutdown_tx);
                    }
                }
            }

            // Registrar estados compartidos en Tauri (thread-safe)
            app.manage(DbPath(db_path));
            app.manage(shutdown_state);

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
            commands::abrir_url,
            commands::get_adjunto_base64,
            commands::get_global_stats,
            commands::open_attachments_folder,
            commands::search_global,
            commands::get_audit_logs,
            commands::optimizar_db,
            commands::limpiar_cache,
            commands::guardar_logo_membrete,
            commands::get_logo_membrete_base64,
            commands::detectar_logo_membrete,
            commands::toggle_api_servidor,
            commands::exponer_tabla_cmd,
            commands::actualizar_permiso_tabla_cmd,
            commands::revocar_tabla_cmd,
            commands::get_tablas_expuestas_cmd,
            commands::get_local_ip_cmd,
            commands::get_plugins,
            commands::toggle_plugin,
            commands::instalar_plugin_local,
            commands::eliminar_plugin,
            commands::leer_recurso_plugin,
        ])
        .run(tauri::generate_context!())
        .expect("[SERA] Error al inicializar la aplicación");
}
