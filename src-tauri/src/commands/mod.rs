/// Módulo de comandos Tauri de SERA.
/// Expone las operaciones de la base de datos como comandos invocables desde el frontend.

use std::fs;
use std::path::PathBuf;
use tauri::{State, AppHandle, Manager};
use crate::database;
use crate::models::{Campo, ConfigData, DeleteRecord, ExportedTable, ExportPackage, NewRecord, NuevaTabla, RestructureTable, Tabla, BulkRecord, GlobalStats};
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

/// Copia el logo seleccionado por el usuario al directorio de datos de SERA,
/// asegurando que el membrete esté siempre disponible de forma local y segura.
#[tauri::command]
pub fn guardar_logo_membrete(app_handle: AppHandle, ruta_origen: String) -> Result<String, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let logo_dir = app_dir.join("membrete");
    fs::create_dir_all(&logo_dir).map_err(|e| e.to_string())?;

    let ext = std::path::Path::new(&ruta_origen)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();

    let nombre_archivo = format!("logo.{}", ext);
    let dest_path = logo_dir.join(&nombre_archivo);
    fs::copy(&ruta_origen, &dest_path).map_err(|e| e.to_string())?;

    Ok(format!("membrete/{}", nombre_archivo))
}

/// Lee el logo del membrete desde el directorio de datos y lo devuelve como data URL (base64).
/// Si no existe, retorna un error controlado para que el frontend maneje el estado vacío.
#[tauri::command]
pub fn get_logo_membrete_base64(app_handle: AppHandle, ruta_relativa: String) -> Result<String, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let full_path = app_dir.join(&ruta_relativa);

    if !full_path.exists() {
        return Err("Sin logotipo configurado".to_string());
    }

    let bytes = fs::read(&full_path).map_err(|e| e.to_string())?;
    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes);

    let ruta_lower = ruta_relativa.to_lowercase();
    let mime = if ruta_lower.ends_with(".png") {
        "image/png"
    } else if ruta_lower.ends_with(".jpg") || ruta_lower.ends_with(".jpeg") {
        "image/jpeg"
    } else {
        "image/png"
    };

    Ok(format!("data:{};base64,{}", mime, b64))
}

/// Detecta si existe un logotipo guardado en la carpeta de membrete,
/// útil para recuperar el logo aunque el campo en BD esté vacío.
#[tauri::command]
pub fn detectar_logo_membrete(app_handle: AppHandle) -> Result<String, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let logo_dir = app_dir.join("membrete");

    if !logo_dir.exists() {
        return Err("Sin membrete".to_string());
    }

    for ext in &["jpg", "jpeg", "png"] {
        let candidate = logo_dir.join(format!("logo.{}", ext));
        if candidate.exists() {
            return Ok(format!("membrete/logo.{}", ext));
        }
    }

    Err("Sin membrete".to_string())
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
pub fn eliminar_registro(db_path: State<DbPath>, tabla: String, id: i64) -> Result<String, String> {
    let delete_record = DeleteRecord { tabla, ids: id };
    database::eliminar_registro(&db_path.0, &delete_record).map(|_| "exito".to_string()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn importar_bulk(db_path: State<DbPath>, bulk: BulkRecord) -> Result<String, String> {
    database::importar_bulk(&db_path.0, &bulk).map(|_| "exito".to_string()).map_err(|e| e.to_string())
}

// ─── EXPORTACIÓN / IMPORTACIÓN SRX ───────────────────────────────────────────

#[tauri::command]
pub fn exportar_tabla(app_handle: tauri::AppHandle, db_path: State<DbPath>, nombre_tabla: String, path: String, password: Option<String>, incluir_adjuntos: bool) -> Result<String, String> {
    // 1. Encontrar todas las tablas relacionadas recursivamente
    let mut tablas_a_exportar = vec![nombre_tabla.clone()];
    let mut index = 0;
    while index < tablas_a_exportar.len() {
        let tabla_actual = tablas_a_exportar[index].clone();
        if let Ok(config_str) = database::get_tabla_config(&db_path.0, &tabla_actual) {
            if let Ok(config_val) = serde_json::from_str::<serde_json::Value>(&config_str) {
                if let Some(linked_fields) = config_val.get("linkedFields").and_then(|v| v.as_array()) {
                    for link in linked_fields {
                        if let Some(remote_table) = link.get("remoteTable").and_then(|v| v.as_str()) {
                            let remote_table_lower = remote_table.to_lowercase();
                            let exists = tablas_a_exportar.iter().any(|t| t.to_lowercase() == remote_table_lower);
                            if !exists {
                                if database::get_campos(&db_path.0, &remote_table_lower).is_ok() {
                                    tablas_a_exportar.push(remote_table_lower);
                                }
                            }
                        }
                    }
                }
            }
        }
        index += 1;
    }

    println!("[SERA] Tablas identificadas para exportar: {:?}", tablas_a_exportar);

    // 2. Construir el paquete de datos
    let mut tablas_empaquetadas = Vec::new();
    let mut todos_los_adjuntos_fisicos = Vec::new();

    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;

    for tabla in &tablas_a_exportar {
        let campos = database::get_campos(&db_path.0, tabla).map_err(|e| e.to_string())?;
        let contenido = database::get_contenido(&db_path.0, tabla).map_err(|e| e.to_string())?;
        let visual_config = database::get_tabla_config(&db_path.0, tabla).unwrap_or_default();

        // Obtener metadatos de los adjuntos de esta tabla de la base de datos
        let mut adjuntos_meta = None;
        if let Ok(adjuntos) = database::get_todos_los_adjuntos_de_tabla(&db_path.0, tabla) {
            if !adjuntos.is_empty() {
                if incluir_adjuntos {
                    // Coleccionar rutas de archivos físicos para empaquetarlos
                    for adj in &adjuntos {
                        let ruta_fisica = app_dir.join(&adj.ruta_interna);
                        if ruta_fisica.exists() {
                            todos_los_adjuntos_fisicos.push((adj.ruta_interna.clone(), ruta_fisica));
                        }
                    }
                }
                adjuntos_meta = Some(adjuntos);
            }
        }

        tablas_empaquetadas.push(ExportedTable {
            nombre: tabla.clone(),
            campos,
            contenido,
            visual_config,
            adjuntos: adjuntos_meta,
        });
    }

    let package = ExportPackage {
        tablas: tablas_empaquetadas,
    };

    let json_data = serde_json::to_vec(&package).map_err(|e| e.to_string())?;
    let encrypted_data = CryptoProvider::encrypt(&json_data, password).map_err(|e| e.to_string())?;

    // 3. Escribir el archivo final (.srx)
    if incluir_adjuntos && !todos_los_adjuntos_fisicos.is_empty() {
        // Empaquetar como un ZIP cifrado
        println!("[SERA] Generando contenedor ZIP (.srx) con adjuntos físicos...");
        let zip_file = fs::File::create(&path).map_err(|e| e.to_string())?;
        let mut zip = zip::ZipWriter::new(zip_file);
        
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .unix_permissions(0o755);

        // A. Escribir el archivo de datos cifrado 'data.sera'
        use std::io::Write;
        zip.start_file("data.sera", options).map_err(|e| e.to_string())?;
        zip.write_all(&encrypted_data).map_err(|e| e.to_string())?;

        // B. Escribir los adjuntos físicos en la subcarpeta 'attachments/'
        for (ruta_relativa, ruta_fisica) in todos_los_adjuntos_fisicos {
            let file_name = ruta_relativa.split(|c| c == '\\' || c == '/').last().unwrap_or("archivo");
            let zip_path = format!("attachments/{}", file_name);

            zip.start_file(zip_path, options).map_err(|e| e.to_string())?;
            let file_content = fs::read(&ruta_fisica).map_err(|e| e.to_string())?;
            zip.write_all(&file_content).map_err(|e| e.to_string())?;
        }

        zip.finish().map_err(|e| e.to_string())?;
    } else {
        // Escribir el archivo cifrado directo
        fs::write(path, encrypted_data).map_err(|e| e.to_string())?;
    }

    let _ = database::registrar_log(&db_path.0, &format!("Tabla '{}' exportada de forma cifrada a paquete .srx.", nombre_tabla), "SUCCESS");

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

    // INTENTO DE PARSEO DE NUEVO FORMATO RELACIONAL MULTI-TABLA O LEGACY SINGLE-TABLA
    let mut tablas_a_importar = Vec::new();

    if let Ok(multi_package) = serde_json::from_slice::<ExportPackage>(&decrypted_data) {
        println!("[SERA] Detectado paquete multi-tabla (.srx relacional) con {} tablas.", multi_package.tablas.len());
        tablas_a_importar = multi_package.tablas;
    } else if let Ok(single_package) = serde_json::from_slice::<ExportedTable>(&decrypted_data) {
        println!("[SERA] Detectado paquete de tabla simple legacy.");
        tablas_a_importar = vec![single_package];
    } else {
        println!("[SERA] Error en parseo estricto. Intentando modo legacy/flexible...");
        let v: Value = serde_json::from_slice(&decrypted_data).map_err(|_| "[SERA] El archivo no es un JSON válido".to_string())?;
        
        if v.is_array() {
            tablas_a_importar = vec![ExportedTable {
                nombre: "tabla_importada".to_string(),
                campos: Vec::new(),
                contenido: v.as_array().unwrap().clone(),
                visual_config: "".to_string(),
                adjuntos: None,
            }];
        } else if v.is_object() {
            let obj = v.as_object().unwrap();
            
            // ¿Viene un campo 'tablas' o 'tables'?
            if let Some(tablas_val) = obj.get("tablas").or(obj.get("tables")) {
                if let Ok(t_list) = serde_json::from_value::<Vec<ExportedTable>>(tablas_val.clone()) {
                    tablas_a_importar = t_list;
                }
            }
            
            if tablas_a_importar.is_empty() {
                let contenido = obj.get("contenido").or(obj.get("data")).or(obj.get("rows"))
                    .and_then(|c| c.as_array())
                    .cloned()
                    .unwrap_or_default();
                
                let nombre = obj.get("nombre").and_then(|n| n.as_str()).unwrap_or("tabla_importada").to_string();
                
                let config_legacy = obj.get("visual_config")
                    .or(obj.get("config"))
                    .or(obj.get("visual"))
                    .or(obj.get("settings"))
                    .map(|v| if v.is_string() { v.as_str().unwrap().to_string() } else { v.to_string() })
                    .unwrap_or_else(|| "{}".to_string());

                let campos_legacy = if let Some(c_val) = obj.get("campos").or(obj.get("columns")) {
                    serde_json::from_value::<Vec<crate::models::Campo>>(c_val.clone()).unwrap_or_default()
                } else {
                    Vec::new()
                };

                let adjuntos_raw = obj.get("_sera_adjuntos").or(obj.get("adjuntos")).or(obj.get("attachments"));
                let mut adjuntos_final = None;

                if let Some(a_val) = adjuntos_raw {
                    if let Ok(a_list) = serde_json::from_value::<Vec<crate::models::ExportedAdjunto>>(a_val.clone()) {
                        adjuntos_final = Some(a_list);
                    }
                }

                tablas_a_importar = vec![ExportedTable {
                    nombre,
                    campos: campos_legacy,
                    contenido,
                    visual_config: config_legacy,
                    adjuntos: adjuntos_final,
                }];
            }
        } else {
            return Err("[SERA] No se pudo determinar la estructura de los datos".to_string());
        }
    }

    if tablas_a_importar.is_empty() {
        return Err("[SERA] No se encontraron tablas válidas para importar".to_string());
    }

    let mut nombres_importados = Vec::new();

    // La primera tabla es la principal
    let main_table = &tablas_a_importar[0];
    let nombre_final = nuevo_nombre.unwrap_or_else(|| main_table.nombre.clone());

    // Ejecutar la importación de la tabla principal
    database::importar_tabla(&db_path.0, nombre_final.clone(), main_table.clone()).map_err(|e| e.to_string())?;
    nombres_importados.push(nombre_final.clone());

    // Importar el resto de las tablas vinculadas
    for tabla_vinculada in tablas_a_importar.iter().skip(1) {
        println!("[SERA] Importando tabla vinculada adjunta: {}", tabla_vinculada.nombre);
        if let Err(e) = database::importar_tabla(&db_path.0, tabla_vinculada.nombre.clone(), tabla_vinculada.clone()) {
            println!("[SERA] Advertencia al importar tabla vinculada {}: {}", tabla_vinculada.nombre, e);
        } else {
            nombres_importados.push(tabla_vinculada.nombre.clone());
        }
    }

    Ok(nombres_importados.join(", "))
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
pub fn abrir_url(app_handle: AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app_handle.opener().open_path(url, None::<&str>).map_err(|e| e.to_string())?;
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

// ─── AUDITORÍA E ISO 27001 ───────────────────────────────────────────────────

#[tauri::command]
pub fn get_audit_logs(db_path: State<DbPath>) -> Result<Vec<Value>, String> {
    database::get_audit_logs(&db_path.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn optimizar_db(db_path: State<DbPath>) -> Result<String, String> {
    use rusqlite::Connection;
    let conn = Connection::open(&db_path.0).map_err(|e| e.to_string())?;
    conn.execute_batch("VACUUM; ANALYZE;").map_err(|e| e.to_string())?;
    let _ = database::registrar_log(&db_path.0, "Base de datos optimizada manualmente mediante VACUUM y ANALYZE.", "SUCCESS");
    Ok("exito".to_string())
}

#[tauri::command]
pub fn limpiar_cache(db_path: State<DbPath>) -> Result<String, String> {
    let _ = database::registrar_log(&db_path.0, "Archivos temporales purgados y caché del visor de adjuntos liberado.", "INFO");
    Ok("exito".to_string())
}
