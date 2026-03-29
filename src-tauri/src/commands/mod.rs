/// Módulo de comandos Tauri de SERA.
/// Expone todas las operaciones de la base de datos como comandos invocables
/// desde el frontend Angular mediante `invoke()`.
///
/// Cada comando recibe la ruta de la DB desde el estado de Tauri (DbPath),
/// realizando la operación y devolviendo el resultado serializado.
///
/// OWASP A01 — Control de Acceso: Los comandos solo son accesibles desde
/// el frontend de la propia app (no expuestos en red), garantizado por Tauri IPC.

use std::path::PathBuf;
use tauri::State;
use crate::database;
use crate::models::{Campo, ConfigData, DeleteRecord, ExportedTable, NewRecord, NuevaTabla, RestructureTable, Tabla};
use crate::security::CryptoProvider;

/// Estado compartido: ruta al archivo SQLite.
pub struct DbPath(pub PathBuf);

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

/// Obtiene la configuración actual del usuario.
#[tauri::command]
pub fn get_config(db_path: State<DbPath>) -> Result<ConfigData, String> {
    database::get_config(&db_path.0)
        .map_err(|e| {
            eprintln!("[SERA] Error al obtener configuración: {e}");
            "Ocurrió un error al cargar la configuración".to_string()
        })
}

/// Actualiza la configuración del usuario.
#[tauri::command]
pub fn update_config(db_path: State<DbPath>, config: ConfigData) -> Result<String, String> {
    database::update_config(&db_path.0, &config)
        .map(|_| "exito".to_string())
        .map_err(|e| {
            eprintln!("[SERA] Error al actualizar configuración: {e}");
            "Ocurrió un error al guardar la configuración".to_string()
        })
}

// ─── TABLAS ───────────────────────────────────────────────────────────────────

/// Devuelve el listado completo de tablas registradas.
#[tauri::command]
pub fn get_tablas(db_path: State<DbPath>) -> Result<Vec<Tabla>, String> {
    database::get_tablas(&db_path.0)
        .map_err(|e| {
            eprintln!("[SERA] Error al obtener tablas: {e}");
            "Ocurrió un error al cargar las tablas".to_string()
        })
}

/// Crea una nueva tabla en la base de datos.
#[tauri::command]
pub fn crear_tabla(db_path: State<DbPath>, tabla: NuevaTabla) -> Result<String, String> {
    database::crear_tabla(&db_path.0, &tabla)
        .map(|_| "exito".to_string())
        .map_err(|e| {
            eprintln!("[SERA] Error al crear tabla '{}': {e}", tabla.nombre);
            "Ocurrió un error al crear la tabla".to_string()
        })
}

/// Obtiene la configuración visual (reglas JSON) de una tabla.
#[tauri::command]
pub fn get_tabla_config(db_path: State<DbPath>, nombre_tabla: String) -> Result<String, String> {
    database::get_tabla_config(&db_path.0, &nombre_tabla)
        .map_err(|e| {
            eprintln!("[SERA] Error al obtener config de tabla '{}': {}", nombre_tabla, e);
            "{}".to_string() // Si falla, de todas formas devolver un string de objeto JSON vacío
        })
}

/// Actualiza la configuración visual (reglas JSON) de una tabla.
#[tauri::command]
pub fn update_tabla_config(db_path: State<DbPath>, nombre_tabla: String, config_json: String) -> Result<String, String> {
    database::update_tabla_config(&db_path.0, &nombre_tabla, &config_json)
        .map(|_| "exito".to_string())
        .map_err(|e| {
            eprintln!("[SERA] Error al guardar config de tabla '{}': {}", nombre_tabla, e);
            "Error al guardar las reglas de la tabla".to_string()
        })
}

/// Elimina una tabla de la base de datos.
#[tauri::command]
pub fn eliminar_tabla(db_path: State<DbPath>, nombre_tabla: String) -> Result<String, String> {
    database::eliminar_tabla(&db_path.0, &nombre_tabla)
        .map(|_| "exito".to_string())
        .map_err(|e| {
            eprintln!("[SERA] Error al eliminar tabla '{nombre_tabla}': {e}");
            "Ocurrió un error al eliminar la tabla".to_string()
        })
}

/// Reestructura una tabla existente con migración de datos.
#[tauri::command]
pub fn reestructurar_tabla(db_path: State<DbPath>, info: RestructureTable) -> Result<String, String> {
    database::reestructurar_tabla(&db_path.0, &info)
        .map(|_| "exito".to_string())
        .map_err(|e| {
            eprintln!("[SERA] Error al reestructurar tabla '{}': {e}", info.nombre_viejo);
            "Ocurrió un error al reestructurar la tabla. Verifique los tipos de datos.".to_string()
        })
}

// ─── CAMPOS Y CONTENIDO ───────────────────────────────────────────────────────

/// Devuelve la estructura de campos de una tabla.
#[tauri::command]
pub fn get_campos(db_path: State<DbPath>, tabla: String) -> Result<Vec<Campo>, String> {
    database::get_campos(&db_path.0, &tabla)
        .map_err(|e| {
            eprintln!("[SERA] Error al obtener campos de '{tabla}': {e}");
            "Ocurrió un error al cargar los campos".to_string()
        })
}

/// Devuelve todos los registros de una tabla.
#[tauri::command]
pub fn get_contenido(db_path: State<DbPath>, tabla: String) -> Result<Vec<serde_json::Value>, String> {
    database::get_contenido(&db_path.0, &tabla)
        .map_err(|e| {
            eprintln!("[SERA] Error al obtener contenido de '{tabla}': {e}");
            "Ocurrió un error al cargar los registros".to_string()
        })
}

// ─── REGISTROS ────────────────────────────────────────────────────────────────

/// Crea un nuevo registro en la tabla indicada.
#[tauri::command]
pub fn nuevo_registro(db_path: State<DbPath>, registro: NewRecord) -> Result<String, String> {
    database::nuevo_registro(&db_path.0, &registro)
        .map(|_| "exito".to_string())
        .map_err(|e| {
            eprintln!("[SERA] Error al crear registro en '{}': {e}", registro.tabla);
            "Ocurrió un error al crear el registro".to_string()
        })
}

/// Actualiza un registro existente.
#[tauri::command]
pub fn actualizar_registro(db_path: State<DbPath>, registro: NewRecord) -> Result<String, String> {
    database::actualizar_registro(&db_path.0, &registro)
        .map(|_| "exito".to_string())
        .map_err(|e| {
            eprintln!("[SERA] Error al actualizar registro en '{}': {e}", registro.tabla);
            "Ocurrió un error al actualizar el registro".to_string()
        })
}

/// Elimina un registro de la tabla indicada.
#[tauri::command]
pub fn eliminar_registro(db_path: State<DbPath>, delete_record: DeleteRecord) -> Result<String, String> {
    database::eliminar_registro(&db_path.0, &delete_record)
        .map(|_| "exito".to_string())
        .map_err(|e| {
            eprintln!("[SERA] Error al eliminar registro en '{}': {e}", delete_record.tabla);
            "Ocurrió un error al eliminar el registro".to_string()
        })
}

// ─── EXPORTACIÓN E IMPORTACIÓN (.srx) ─────────────────────────────────────────

/// Exporta una tabla completa (schema + datos + config visual) a un archivo .srx cifrado.
#[tauri::command]
pub fn exportar_tabla(db_path: State<DbPath>, nombre_tabla: String, path: String) -> Result<String, String> {
    // 1. Obtener campos
    let campos = database::get_campos(&db_path.0, &nombre_tabla)
        .map_err(|e| format!("[SERA] Error al obtener campos: {}", e))?;
    
    // 2. Obtener contenido
    let contenido = database::get_contenido(&db_path.0, &nombre_tabla)
        .map_err(|e| format!("[SERA] Error al obtener contenido: {}", e))?;
    
    // 3. Obtener config visual
    let visual_config = database::get_tabla_config(&db_path.0, &nombre_tabla)
        .unwrap_or_else(|_| "[]".to_string()); // Default si no tiene config
    
    // 4. Empaquetar
    let package = ExportedTable {
        nombre: nombre_tabla,
        campos,
        contenido,
        visual_config,
    };
    
    // 5. Serializar a JSON
    let json_data = serde_json::to_vec(&package)
        .map_err(|e| format!("[SERA] Error de serialización: {}", e))?;
    
    // 6. Cifrar
    let encrypted_data = CryptoProvider::encrypt(&json_data)
        .map_err(|e| format!("[SERA] Error de cifrado: {}", e))?;
    
    // 7. Guardar en disco
    std::fs::write(path, encrypted_data)
        .map_err(|e| format!("[SERA] Error al escribir el archivo: {}", e))?;
    
    Ok("exito".to_string())
}

/// Importa una tabla desde un archivo .srx cifrado.
#[tauri::command]
pub fn importar_tabla(db_path: State<DbPath>, path: String, nuevo_nombre: Option<String>) -> Result<String, String> {
    // 1. Leer archivo
    let encrypted_data = std::fs::read(path)
        .map_err(|e| format!("[SERA] No se pudo leer el archivo: {}", e))?;
    
    // 2. Descifrar
    let decrypted_data = CryptoProvider::decrypt(&encrypted_data)
        .map_err(|e| format!("[SERA] {}", e))?;
    
    // 3. Deserializar
    let package: ExportedTable = serde_json::from_slice(&decrypted_data)
        .map_err(|e| format!("[SERA] Error de datos (el archivo podría estar corrupto): {}", e))?;
    
    // 4. Determinar nombre final
    let nombre_final = nuevo_nombre.unwrap_or(package.nombre);
    
    // 5. Crear tabla en la DB
    // Generar definición de campos SQL
    let mut sql_fields = String::new();
    for (i, campo) in package.campos.iter().enumerate() {
        if i > 0 { sql_fields.push_str(", "); }
        sql_fields.push_str(&format!("{} {}", campo.field, campo.tipo));
    }
    
    let nueva_tabla = NuevaTabla {
        nombre: nombre_final.clone(),
        campos: sql_fields,
    };
    
    database::crear_tabla(&db_path.0, &nueva_tabla)
        .map_err(|e| format!("[SERA] Error al crear la tabla importada: {}", e))?;
    
    // 6. Insertar registros
    for row in package.contenido {
        if let Some(obj) = row.as_object() {
            let mut fields = Vec::new();
            let mut values = Vec::new();
            
            for (k, v) in obj {
                // Ignorar el ID autogenerado para no entrar en conflicto con la nueva tabla
                if k.to_lowercase() == "id" || k.to_lowercase().contains("id_") {
                    continue;
                }
                fields.push(k.clone());
                // Convertir a string para el comando de insert
                let val_str = match v {
                    serde_json::Value::String(s) => s.clone(),
                    _ => v.to_string().replace("\"", ""), // Limpiar comillas si es num/bool
                };
                values.push(val_str);
            }
            
            let record = NewRecord {
                id: None,
                tabla: nombre_final.clone(),
                campos: fields,
                contenido: values,
            };
            
            database::nuevo_registro(&db_path.0, &record)
                .map_err(|e| format!("[SERA] Error al insertar registro importado: {}", e))?;
        }
    }
    
    // 7. Guardar configuración visual
    database::update_tabla_config(&db_path.0, &nombre_final, &package.visual_config)
        .map_err(|e| format!("[SERA] Error al restaurar config visual: {}", e))?;
    
    Ok(nombre_final)
}
