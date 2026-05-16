/// Módulo de comandos Tauri de SERA.
/// Expone las operaciones de la base de datos como comandos invocables desde el frontend.

use std::fs;
use std::path::PathBuf;
use tauri::{State, AppHandle, Manager};
use crate::database;
use crate::models::{Campo, ConfigData, DeleteRecord, ExportedTable, NewRecord, NuevaTabla, RestructureTable, Tabla, BulkRecord, GlobalStats};
use crate::security::CryptoProvider;
use serde_json::Value;

/// Estado compartido: ruta al archivo SQLite.
pub struct DbPath(pub PathBuf);

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_config(db_path: State<DbPath>) -> Result<ConfigData, String> {
    database::get_config(&db_path.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_config(db_path: State<DbPath>, config: ConfigData) -> Result<String, String> {
    database::update_config(&db_path.0, &config).map(|_| "exito".to_string()).map_err(|e| e.to_string())
}

// ─── TABLAS ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_tablas(db_path: State<DbPath>) -> Result<Vec<Tabla>, String> {
    database::get_tablas(&db_path.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn crear_tabla(db_path: State<DbPath>, tabla: NuevaTabla) -> Result<String, String> {
    database::crear_tabla(&db_path.0, &tabla).map(|_| "exito".to_string()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_tabla_config(db_path: State<DbPath>, nombre_tabla: String) -> Result<String, String> {
    database::get_tabla_config(&db_path.0, &nombre_tabla).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_tabla_config(db_path: State<DbPath>, nombre_tabla: String, config_json: String) -> Result<String, String> {
    database::update_tabla_config(&db_path.0, &nombre_tabla, &config_json).map(|_| "exito".to_string()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn eliminar_tabla(db_path: State<DbPath>, nombre_tabla: String) -> Result<String, String> {
    database::eliminar_tabla(&db_path.0, &nombre_tabla).map(|_| "exito".to_string()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reestructurar_tabla(db_path: State<DbPath>, info: RestructureTable) -> Result<String, String> {
    database::reestructurar_tabla(&db_path.0, &info).map(|_| "exito".to_string()).map_err(|e| e.to_string())
}

// ─── CAMPOS Y CONTENIDO ───────────────────────────────────────────────────────

#[tauri::command]
pub fn get_campos(db_path: State<DbPath>, tabla: String) -> Result<Vec<Campo>, String> {
    database::get_campos(&db_path.0, &tabla).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_contenido(db_path: State<DbPath>, tabla: String) -> Result<Vec<Value>, String> {
    database::get_contenido(&db_path.0, &tabla).map_err(|e| e.to_string())
}

// ─── REGISTROS ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn nuevo_registro(db_path: State<DbPath>, registro: NewRecord) -> Result<i64, String> {
    database::nuevo_registro(&db_path.0, &registro).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn actualizar_registro(db_path: State<DbPath>, registro: NewRecord) -> Result<String, String> {
    database::actualizar_registro(&db_path.0, &registro).map(|_| "exito".to_string()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn eliminar_registro(db_path: State<DbPath>, delete_record: DeleteRecord) -> Result<String, String> {
    database::eliminar_registro(&db_path.0, &delete_record).map(|_| "exito".to_string()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn importar_bulk(db_path: State<DbPath>, bulk: BulkRecord) -> Result<String, String> {
    database::importar_bulk(&db_path.0, &bulk).map(|_| "exito".to_string()).map_err(|e| e.to_string())
}

// ─── EXPORTACIÓN / IMPORTACIÓN SRX ───────────────────────────────────────────

#[tauri::command]
pub fn exportar_tabla(db_path: State<DbPath>, nombre_tabla: String, path: String, password: Option<String>, _incluir_adjuntos: bool) -> Result<String, String> {
    let campos = database::get_campos(&db_path.0, &nombre_tabla).map_err(|e| e.to_string())?;
    let contenido = database::get_contenido(&db_path.0, &nombre_tabla).map_err(|e| e.to_string())?;
    let visual_config = database::get_tabla_config(&db_path.0, &nombre_tabla).unwrap_or_default();
    
    let package = ExportedTable {
        nombre: nombre_tabla,
        campos,
        contenido,
        visual_config,
        adjuntos: None, // Por ahora no exportamos adjuntos físicos en el SRX simple
    };
    
    let json_data = serde_json::to_vec(&package).map_err(|e| e.to_string())?;
    let encrypted_data = CryptoProvider::encrypt(&json_data, password).map_err(|e| e.to_string())?;
    fs::write(path, encrypted_data).map_err(|e| e.to_string())?;
    
    Ok("exito".to_string())
}

#[tauri::command]
pub fn importar_tabla(app_handle: tauri::AppHandle, db_path: State<DbPath>, path: String, nuevo_nombre: Option<String>, password: Option<String>) -> Result<String, String> {
    let raw_data = fs::read(&path).map_err(|e| e.to_string())?;
    
    // DETECCIÓN: ¿Es un ZIP (PK\x03\x04) o un SRX Cifrado?
    let decrypted_data = if raw_data.len() >= 4 && &raw_data[0..4] == b"PK\x03\x04" {
        println!("[SERA] Detectado formato ZIP. Contenido del archivo:");
        let reader = std::io::Cursor::new(raw_data);
        let mut archive = zip::ZipArchive::new(reader).map_err(|e| e.to_string())?;
        
        let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
        let attachments_dir = app_dir.join("attachments");
        let _ = fs::create_dir_all(&attachments_dir);

        let mut json_content = Vec::new();

        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let file_name = file.name().to_string();
            println!("  - Procesando: {}", file_name);
            
            // Si es un archivo de adjuntos (carpeta files/ o attachments/)
            if file_name.starts_with("files/") || file_name.starts_with("attachments/") {
                use std::path::Path;
                let base_name = Path::new(&file_name).file_name().and_then(|n| n.to_str()).unwrap_or(&file_name);
                let target_path = attachments_dir.join(base_name);
                
                println!("[SERA] Extrayendo adjunto físico: {} -> {:?}", file_name, target_path);
                let mut out_file = fs::File::create(&target_path).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut out_file).map_err(|e| e.to_string())?;
                continue;
            }

            if file_name.to_lowercase().ends_with(".json") || file_name.to_lowercase().ends_with(".sera") || file_name.ends_with(".enc") {
                use std::io::Read;
                let mut content = Vec::new();
                file.read_to_end(&mut content).map_err(|e| e.to_string())?;
                
                // Si parece ser el archivo de datos principal
                if content.len() > 10 && (json_content.is_empty() || file_name.contains("data")) {
                    json_content = content;
                    println!("[SERA] Usando archivo de datos: {}", file_name);
                }
            }
        }

        if json_content.is_empty() {
            return Err("[SERA] El archivo ZIP parece estar vacío o no contiene datos válidos".to_string());
        }

        // RECURSIVIDAD: ¿El archivo dentro del ZIP está cifrado?
        if json_content.len() >= 12 && (&json_content[0..12] == b"SERA_V1_PACK" || &json_content[0..8] == b"SERA_SRX") {
            println!("[SERA] El archivo dentro del ZIP está cifrado. Descifrando...");
            json_content = CryptoProvider::decrypt(&json_content, password.clone()).map_err(|e| e.to_string())?;
        }

        // DEPURACIÓN: Ver el inicio del contenido
        let snippet = String::from_utf8_lossy(&json_content[..std::cmp::min(json_content.len(), 50)]);
        println!("[SERA] Inicio del contenido final: {}", snippet);

        json_content
    } else {
        // Es un SRX cifrado directo
        CryptoProvider::decrypt(&raw_data, password).map_err(|e| e.to_string())?
    };

    // INTENTO DE PARSEO FLEXIBLE
    let package: ExportedTable = match serde_json::from_slice::<ExportedTable>(&decrypted_data) {
        Ok(p) => p,
        Err(e) => {
            println!("[SERA] Error en parseo estricto: {}. Intentando modo legacy/flexible...", e);
            let v: Value = serde_json::from_slice(&decrypted_data).map_err(|_| "[SERA] El archivo no es un JSON válido".to_string())?;
            
            // Si es un array directo, son los registros
            if v.is_array() {
                ExportedTable {
                    nombre: "tabla_importada".to_string(),
                    campos: Vec::new(),
                    contenido: v.as_array().unwrap().clone(),
                    visual_config: "".to_string(),
                    adjuntos: None,
                }
            } else if v.is_object() {
                let obj = v.as_object().unwrap();
                let contenido = obj.get("contenido").or(obj.get("data")).or(obj.get("rows"))
                    .and_then(|c| c.as_array())
                    .cloned()
                    .unwrap_or_default();
                
                let nombre = obj.get("nombre").and_then(|n| n.as_str()).unwrap_or("tabla_importada").to_string();
                
                // BUSCAR CONFIGURACIÓN VISUAL LEGACY
                let config_legacy = obj.get("visual_config")
                    .or(obj.get("config"))
                    .or(obj.get("visual"))
                    .or(obj.get("settings"))
                    .map(|v| if v.is_string() { v.as_str().unwrap().to_string() } else { v.to_string() })
                    .unwrap_or_else(|| "{}".to_string());

                // BUSCAR DEFINICIÓN DE CAMPOS LEGACY
                let campos_legacy = if let Some(c_val) = obj.get("campos").or(obj.get("columns")) {
                    serde_json::from_value::<Vec<crate::models::Campo>>(c_val.clone()).unwrap_or_default()
                } else {
                    Vec::new()
                };

                // BUSCAR ADJUNTOS LEGACY (_sera_adjuntos)
                let adjuntos_raw = obj.get("_sera_adjuntos").or(obj.get("adjuntos")).or(obj.get("attachments"));
                let mut adjuntos_final = None;

                if let Some(a_val) = adjuntos_raw {
                    if let Ok(a_list) = serde_json::from_value::<Vec<crate::models::ExportedAdjunto>>(a_val.clone()) {
                        adjuntos_final = Some(a_list);
                        println!("[SERA] Se encontraron {} adjuntos en el paquete legacy.", adjuntos_final.as_ref().unwrap().len());
                    }
                }

                ExportedTable {
                    nombre,
                    campos: campos_legacy,
                    contenido,
                    visual_config: config_legacy,
                    adjuntos: adjuntos_final,
                }
            } else {
                return Err("[SERA] No se pudo determinar la estructura de los datos".to_string());
            }
        }
    };
    
    let nombre_final = nuevo_nombre.unwrap_or(package.nombre.clone());
    
    // Ejecutar la importación real en la base de datos
    database::importar_tabla(&db_path.0, nombre_final.clone(), package).map_err(|e| e.to_string())?;
    
    Ok(nombre_final)
}

// ─── ADJUNTOS ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_adjuntos(db_path: State<DbPath>, tabla: String, registro_id: i64) -> Result<Vec<Value>, String> {
    database::get_adjuntos(&db_path.0, &tabla, registro_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn guardar_adjunto(app_handle: AppHandle, db_path: State<DbPath>, tabla: String, registro_id: i64, nombre: String, path_origen: String) -> Result<i64, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let attachments_dir = app_dir.join("attachments");
    fs::create_dir_all(&attachments_dir).map_err(|e| e.to_string())?;

    let file_ext = PathBuf::from(&path_origen).extension().and_then(|e| e.to_str()).unwrap_or("bin").to_string();
    let unique_name = format!("{}_{}_{}.{}", tabla, registro_id, uuid::Uuid::new_v4(), file_ext);
    let target_path = attachments_dir.join(&unique_name);

    fs::copy(&path_origen, &target_path).map_err(|e| e.to_string())?;
    
    let ruta_relativa = format!("attachments/{}", unique_name);
    database::insertar_adjunto(&db_path.0, &tabla, registro_id, &nombre, &ruta_relativa).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn eliminar_adjunto(app_handle: AppHandle, db_path: State<DbPath>, id: i64) -> Result<String, String> {
    let ruta_relativa = database::eliminar_adjunto(&db_path.0, id).map_err(|e| e.to_string())?;
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let full_path = app_dir.join(ruta_relativa);
    
    if full_path.exists() {
        let _ = fs::remove_file(full_path);
    }
    
    Ok("exito".to_string())
}

#[tauri::command]
pub fn abrir_adjunto(app_handle: AppHandle, ruta_relativa: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let full_path = app_dir.join(ruta_relativa);
    
    if !full_path.exists() {
        return Err("El archivo no existe".to_string());
    }

    let path_str = full_path.to_string_lossy().to_string();
    app_handle.opener().open_path(path_str, None::<&str>).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn get_adjunto_base64(app_handle: AppHandle, ruta_relativa: String) -> Result<String, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let full_path = app_dir.join(&ruta_relativa);
    
    if !full_path.exists() {
        println!("[SERA] ERROR: El archivo adjunto no existe en: {:?}", full_path);
        return Err(format!("El archivo no existe: {}", ruta_relativa));
    }

    let bytes = fs::read(&full_path).map_err(|e| {
        println!("[SERA] ERROR: No se pudo leer el archivo {:?}: {}", full_path, e);
        e.to_string()
    })?;

    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes);
    
    let path_str = full_path.to_string_lossy().to_lowercase();
    let mime = if path_str.contains(".png") {
        "image/png"
    } else if path_str.contains(".jpg") || path_str.contains(".jpeg") {
        "image/jpeg"
    } else if path_str.contains(".pdf") {
        "application/pdf"
    } else {
        "application/octet-stream"
    };

    println!("[SERA] Sirviendo adjunto: {} (MIME: {})", ruta_relativa, mime);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
pub fn open_attachments_folder(app_handle: AppHandle) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = app_dir.join("attachments");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("explorer").arg(path).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ─── ANALÍTICA Y BÚSQUEDA ─────────────────────────────────────────────────────

#[tauri::command]
pub fn get_global_stats(db_path: State<DbPath>) -> Result<GlobalStats, String> {
    database::get_global_stats(&db_path.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_global(db_path: State<DbPath>, term: String) -> Result<Value, String> {
    database::search_global(&db_path.0, &term).map_err(|e| e.to_string())
}
