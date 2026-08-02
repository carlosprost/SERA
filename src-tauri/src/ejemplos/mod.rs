use rusqlite::Connection;
use std::path::Path;

/// Carga un archivo SQL estático embebido en el binario y lo ejecuta.
pub fn cargar_ejemplo_sql(db_path: &Path, nombre_ejemplo: &str) -> Result<(), String> {
    let sql = match nombre_ejemplo {
        "inventario" => include_str!("../../ejemplos_sql/inventario.sql"),
        "personal" => include_str!("../../ejemplos_sql/personal.sql"),
        "proyectos" => include_str!("../../ejemplos_sql/proyectos.sql"),
        "crm" => include_str!("../../ejemplos_sql/crm.sql"),
        _ => return Err(format!("Ejemplo '{}' no encontrado.", nombre_ejemplo)),
    };

    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    
    // Ejecutar el script SQL completo
    conn.execute_batch(sql).map_err(|e| format!("Error ejecutando SQL: {}", e))?;

    // Registrar en auditoría
    crate::database::registrar_log(
        db_path,
        &format!("Ejemplo '{}' cargado exitosamente.", nombre_ejemplo),
        "SUCCESS"
    ).map_err(|e| e.to_string())?;

    Ok(())
}
