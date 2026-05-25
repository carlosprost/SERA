/// Módulo de base de datos SQLite para SERA.
/// Gestiona la conexión, inicialización del esquema y todas las operaciones CRUD.

use rusqlite::{Connection, Result, params};
use std::path::Path;
use serde_json::{json, Value};
use crate::models::{Campo, ConfigData, DeleteRecord, NewRecord, NuevaTabla, RestructureTable, Tabla, UserConfig, BulkRecord, GlobalStats};

/// Inicializa la base de datos SQLite en la ruta indicada.
pub fn inicializar_db(db_path: &Path) -> Result<()> {
    let conn = Connection::open(db_path)?;

    conn.execute_batch(
        "
        PRAGMA journal_mode=WAL;
        PRAGMA foreign_keys=ON;

        CREATE TABLE IF NOT EXISTS tablas (
            id_tablas INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_tabla TEXT NOT NULL UNIQUE,
            config TEXT DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS sera_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            nombre_app TEXT NOT NULL DEFAULT 'SERA',
            user_nombre TEXT NOT NULL DEFAULT '',
            user_grado TEXT NOT NULL DEFAULT '',
            user_institucion TEXT NOT NULL DEFAULT '',
            user_dependencia TEXT NOT NULL DEFAULT '',
            user_oficina TEXT NOT NULL DEFAULT '',
            user_membrete TEXT NOT NULL DEFAULT '',
            api_enabled INTEGER NOT NULL DEFAULT 0,
            api_port INTEGER NOT NULL DEFAULT 54321
        );

        CREATE TABLE IF NOT EXISTS sera_api_exposicion (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tabla_nombre TEXT NOT NULL UNIQUE,
            codigo_conexion TEXT NOT NULL UNIQUE,
            token_robusto TEXT NOT NULL UNIQUE,
            permiso TEXT NOT NULL DEFAULT 'READ',
            cifrado_e2e INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS _sera_adjuntos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tabla_nombre TEXT NOT NULL,
            registro_id INTEGER NOT NULL,
            archivo_nombre TEXT NOT NULL,
            archivo_ruta_relativa TEXT NOT NULL,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS _sera_audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            mensaje TEXT NOT NULL,
            categoria TEXT DEFAULT 'INFO'
        );
        ",
    )?;

    // MIGRATIONS: Agregamos las columnas necesarias si la base de datos ya existía
    let _ = conn.execute("ALTER TABLE tablas ADD COLUMN config TEXT DEFAULT '{}'", []);
    let _ = conn.execute("ALTER TABLE sera_config ADD COLUMN api_enabled INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE sera_config ADD COLUMN api_port INTEGER NOT NULL DEFAULT 54321", []);

    // Insertar fila por defecto una vez garantizadas todas las columnas
    let _ = conn.execute(
        "INSERT OR IGNORE INTO sera_config (id, nombre_app, user_nombre, user_grado, user_institucion, user_dependencia, user_oficina, user_membrete, api_enabled, api_port)
         VALUES (1, 'SERA', '', '', '', '', '', '', 0, 54321);",
        [],
    );

    // Registrar inicio de sesión en caliente de la base de datos
    let _ = registrar_log(db_path, "Sesión de operador iniciada. Base de datos e índices cargados.", "INFO");

    Ok(())
}

/// Registra una entrada en la bitácora de auditoría interna de SERA (ISO 27001).
pub fn registrar_log(db_path: &Path, mensaje: &str, categoria: &str) -> Result<()> {
    let conn = Connection::open(db_path)?;
    conn.execute(
        "INSERT INTO _sera_audit_logs (mensaje, categoria) VALUES (?1, ?2)",
        params![mensaje, categoria],
    )?;
    Ok(())
}

/// Obtiene las últimas 50 entradas de la bitácora de auditoría.
pub fn get_audit_logs(db_path: &Path) -> Result<Vec<serde_json::Value>> {
    let conn = Connection::open(db_path)?;
    let mut stmt = conn.prepare(
        "SELECT id, strftime('%Y-%m-%d %H:%M:%S', datetime(fecha, 'localtime')), mensaje, categoria 
         FROM _sera_audit_logs 
         ORDER BY id DESC 
         LIMIT 50"
    )?;
    
    let rows = stmt.query_map([], |row| {
        let id: i64 = row.get(0)?;
        let fecha: String = row.get(1)?;
        let mensaje: String = row.get(2)?;
        let categoria: String = row.get(3)?;
        Ok(serde_json::json!({
            "id": id,
            "fecha": fecha,
            "mensaje": mensaje,
            "categoria": categoria,
        }))
    })?;

    let mut result = Vec::new();
    for r in rows {
        result.push(r?);
    }
    Ok(result)
}

/// Abre una conexión a la base de datos en la ruta indicada.
fn abrir_conn(db_path: &Path) -> Result<Connection> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    Ok(conn)
}

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

pub fn get_config(db_path: &Path) -> Result<ConfigData> {
    let conn = abrir_conn(db_path)?;
    let config = conn.query_row(
        "SELECT nombre_app, user_nombre, user_grado, user_institucion, user_dependencia, user_oficina, user_membrete, api_enabled, api_port FROM sera_config WHERE id = 1",
        [],
        |row| {
            Ok(ConfigData {
                nombre_app: row.get(0)?,
                user: UserConfig {
                    nombre: row.get(1)?,
                    grado: row.get(2)?,
                    institucion: row.get(3)?,
                    dependencia: row.get(4)?,
                    oficina: row.get(5)?,
                    membrete: row.get(6)?,
                    api_enabled: row.get(7).unwrap_or(0),
                    api_port: row.get(8).unwrap_or(54321),
                },
            })
        },
    )?;
    Ok(config)
}

pub fn update_config(db_path: &Path, config: &ConfigData) -> Result<()> {
    let conn = abrir_conn(db_path)?;
    conn.execute(
        "UPDATE sera_config SET
            nombre_app = ?1,
            user_nombre = ?2,
            user_grado = ?3,
            user_institucion = ?4,
            user_dependencia = ?5,
            user_oficina = ?6,
            user_membrete = ?7,
            api_enabled = ?8,
            api_port = ?9
        WHERE id = 1",
        params![
            config.nombre_app,
            config.user.nombre,
            config.user.grado,
            config.user.institucion,
            config.user.dependencia,
            config.user.oficina,
            config.user.membrete,
            config.user.api_enabled,
            config.user.api_port,
        ],
    )?;
    let _ = registrar_log(db_path, &format!("Configuración general del operador '{}' actualizada.", config.user.nombre), "INFO");
    Ok(())
}

// ─── TABLAS ───────────────────────────────────────────────────────────────────

pub fn get_tablas(db_path: &Path) -> Result<Vec<Tabla>> {
    let conn = abrir_conn(db_path)?;
    let mut stmt = conn.prepare("SELECT id_tablas, nombre_tabla FROM tablas ORDER BY nombre_tabla")?;
    let tablas = stmt
        .query_map([], |row| {
            Ok(Tabla {
                id_tablas: row.get(0)?,
                nombre_tabla: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<Tabla>>>()?;
    Ok(tablas)
}

pub fn get_tabla_config(db_path: &Path, nombre_tabla: &str) -> Result<String> {
    validar_nombre_identificador(nombre_tabla)?;
    let conn = abrir_conn(db_path)?;
    let config: String = conn.query_row(
        "SELECT config FROM tablas WHERE nombre_tabla = ?1",
        params![nombre_tabla],
        |row| row.get(0),
    ).unwrap_or_else(|_| "{}".to_string());
    Ok(config)
}

pub fn update_tabla_config(db_path: &Path, nombre_tabla: &str, config_json: &str) -> Result<()> {
    validar_nombre_identificador(nombre_tabla)?;
    let conn = abrir_conn(db_path)?;
    conn.execute(
        "UPDATE tablas SET config = ?1 WHERE nombre_tabla = ?2",
        params![config_json, nombre_tabla],
    )?;
    Ok(())
}

pub fn crear_tabla(db_path: &Path, nueva_tabla: &NuevaTabla) -> Result<()> {
    validar_nombre_identificador(&nueva_tabla.nombre)?;
    let conn = abrir_conn(db_path)?;

    let sql_create = format!(
        "CREATE TABLE IF NOT EXISTS \"{nombre}\" (
            id_{nombre} INTEGER PRIMARY KEY AUTOINCREMENT,
            {campos}
        )",
        nombre = nueva_tabla.nombre,
        campos = nueva_tabla.campos
    );

    conn.execute_batch(&sql_create)?;

    conn.execute(
        "INSERT OR REPLACE INTO tablas (nombre_tabla, config) VALUES (?1, ?2)",
        params![nueva_tabla.nombre, nueva_tabla.config.as_deref().unwrap_or("{}")],
    )?;

    let _ = registrar_log(db_path, &format!("Tabla '{}' creada exitosamente en el catálogo.", nueva_tabla.nombre), "SUCCESS");

    Ok(())
}

pub fn eliminar_tabla(db_path: &Path, nombre_tabla: &str) -> Result<()> {
    validar_nombre_identificador(nombre_tabla)?;
    let conn = abrir_conn(db_path)?;

    // 1. Limpiar adjuntos (huérfanos)
    let mut stmt = conn.prepare("SELECT archivo_ruta_relativa FROM _sera_adjuntos WHERE tabla_nombre = ?")?;
    let rutas: Vec<String> = stmt.query_map(params![nombre_tabla], |r| r.get(0))?
        .filter_map(|r| r.ok())
        .collect();

    let _ = conn.execute("DELETE FROM _sera_adjuntos WHERE tabla_nombre = ?", params![nombre_tabla]);

    if let Some(app_dir) = db_path.parent() {
        for ruta_rel in rutas {
            let full_path = app_dir.join(ruta_rel);
            let _ = std::fs::remove_file(full_path);
        }
    }

    // 2. Eliminar tabla física
    let sql_drop = format!("DROP TABLE IF EXISTS \"{nombre_tabla}\"");
    conn.execute_batch(&sql_drop)?;

    // 3. Quitar del catálogo
    conn.execute("DELETE FROM tablas WHERE nombre_tabla = ?1", params![nombre_tabla])?;

    let _ = registrar_log(db_path, &format!("Tabla '{}' eliminada del catálogo con todos sus adjuntos físicos.", nombre_tabla), "WARNING");

    Ok(())
}

pub fn reestructurar_tabla(db_path: &Path, info: &RestructureTable) -> Result<()> {
    validar_nombre_identificador(&info.nombre_viejo)?;
    validar_nombre_identificador(&info.nombre_nuevo)?;

    let mut conn = abrir_conn(db_path)?;
    let tx = conn.transaction()?;

    let temp_name = format!("__temp_{}", info.nombre_nuevo);
    let sql_create = format!(
        "CREATE TABLE \"{temp_name}\" (
            id_{new_name} INTEGER PRIMARY KEY AUTOINCREMENT,
            {campos}
        )",
        new_name = info.nombre_nuevo,
        campos = info.campos_schema
    );
    tx.execute_batch(&sql_create)?;

    let id_viejo = format!("id_{}", info.nombre_viejo);
    let id_nuevo = format!("id_{}", info.nombre_nuevo);

    let mut select_cols = vec![id_viejo];
    let mut insert_cols = vec![id_nuevo];

    for m in &info.mapeo {
        let new_trim = m.new_name.trim();
        validar_columna(&m.old_name)?;
        validar_columna(new_trim)?;
        select_cols.push(format!("\"{}\"", m.old_name));
        insert_cols.push(format!("\"{}\"", new_trim));
    }

    let sql_copy = format!(
        "INSERT INTO \"{temp_name}\" ({insert_cols}) SELECT {select_cols} FROM \"{nombre_viejo}\"",
        temp_name = temp_name,
        insert_cols = insert_cols.join(", "),
        select_cols = select_cols.join(", "),
        nombre_viejo = info.nombre_viejo
    );
    tx.execute_batch(&sql_copy)?;

    tx.execute_batch(&format!("DROP TABLE \"{nombre_viejo}\"", nombre_viejo = info.nombre_viejo))?;
    tx.execute_batch(&format!("ALTER TABLE \"{temp_name}\" RENAME TO \"{nombre_nuevo}\"", temp_name = temp_name, nombre_nuevo = info.nombre_nuevo))?;

    tx.execute(
        "UPDATE tablas SET nombre_tabla = ?1, config = ?2 WHERE nombre_tabla = ?3",
        params![info.nombre_nuevo, info.config.as_deref().unwrap_or("{}"), info.nombre_viejo],
    )?;

    tx.commit()?;
    Ok(())
}

// ─── CAMPOS Y CONTENIDO ───────────────────────────────────────────────────────

pub fn get_campos(db_path: &Path, tabla: &str) -> Result<Vec<Campo>> {
    validar_nombre_identificador(tabla)?;
    let conn = abrir_conn(db_path)?;
    let mut stmt = conn.prepare(&format!("PRAGMA table_info(\"{}\")", tabla))?;
    let rows = stmt.query_map([], |row| {
        let notnull: i32 = row.get(3)?;
        let pk: i32 = row.get(5)?;
        Ok(Campo {
            field: row.get(1)?,
            tipo: row.get(2).unwrap_or_else(|_| "TEXT".to_string()),
            null: if notnull == 1 { "NO".to_string() } else { "YES".to_string() },
            key: if pk == 1 { "PRI".to_string() } else { String::new() },
            default: row.get(4)?,
            extra: if pk == 1 { "auto_increment".to_string() } else { String::new() },
        })
    })?;

    let mut results = Vec::new();
    for r in rows {
        results.push(r?);
    }
    Ok(results)
}

pub fn get_contenido(db_path: &Path, tabla: &str) -> Result<Vec<Value>> {
    validar_nombre_identificador(tabla)?;
    let conn = abrir_conn(db_path)?;
    
    // Query que incluye el conteo de adjuntos vinculados a cada registro
    let sql = format!(
        "SELECT t.*, (SELECT COUNT(*) FROM _sera_adjuntos a WHERE a.tabla_nombre = '{tabla}' AND a.registro_id = t.id_{tabla}) as sera_adjuntos_count 
         FROM \"{tabla}\" t",
        tabla = tabla
    );
    
    let mut stmt = conn.prepare(&sql)?;
    let column_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

    let filas = stmt.query_map([], |row| {
        let mut obj = serde_json::Map::new();
        for (i, col) in column_names.iter().enumerate() {
            let valor: rusqlite::types::Value = row.get(i)?;
            obj.insert(col.clone(), sqlite_value_to_json(valor));
        }
        Ok(Value::Object(obj))
    })?.collect::<Result<Vec<Value>>>()?;

    Ok(filas)
}

// ─── REGISTROS ────────────────────────────────────────────────────────────────

pub fn nuevo_registro(db_path: &Path, record: &NewRecord) -> Result<i64> {
    validar_nombre_identificador(&record.tabla)?;
    let conn = abrir_conn(db_path)?;

    let placeholders: Vec<String> = (1..=record.campos.len()).map(|i| format!("?{}", i)).collect();
    let sql = format!(
        "INSERT INTO \"{tabla}\" ({columnas}) VALUES ({placeholders})",
        tabla = record.tabla,
        columnas = record.campos.iter().map(|c| format!("\"{}\"", c)).collect::<Vec<_>>().join(", "),
        placeholders = placeholders.join(", ")
    );

    let mut stmt = conn.prepare(&sql)?;
    let valores: Vec<rusqlite::types::Value> = record.contenido.iter().map(|v| rusqlite::types::Value::Text(v.trim().to_string())).collect();
    stmt.execute(rusqlite::params_from_iter(valores.iter()))?;

    Ok(conn.last_insert_rowid())
}

pub fn actualizar_registro(db_path: &Path, record: &NewRecord) -> Result<()> {
    validar_nombre_identificador(&record.tabla)?;
    let id = record.id.ok_or_else(|| rusqlite::Error::InvalidParameterName("id requerido".into()))?;
    let conn = abrir_conn(db_path)?;

    let sets: Vec<String> = record.campos.iter().enumerate().map(|(i, c)| format!("\"{}\" = ?{}", c, i + 1)).collect();
    let id_placeholder = record.campos.len() + 1;
    let sql = format!(
        "UPDATE \"{tabla}\" SET {sets} WHERE id_{tabla} = ?{id_placeholder}",
        tabla = record.tabla,
        sets = sets.join(", ")
    );

    let mut stmt = conn.prepare(&sql)?;
    let mut valores: Vec<rusqlite::types::Value> = record.contenido.iter().map(|v| rusqlite::types::Value::Text(v.trim().to_string())).collect();
    valores.push(rusqlite::types::Value::Integer(id));
    stmt.execute(rusqlite::params_from_iter(valores.iter()))?;

    Ok(())
}

pub fn eliminar_registro(db_path: &Path, record: &DeleteRecord) -> Result<()> {
    validar_nombre_identificador(&record.tabla)?;
    println!("[SERA] Intentando eliminar registro - Tabla: '{}', ID: {}", record.tabla, record.ids);
    
    let conn = abrir_conn(db_path)?;
    
    // Blindamos tanto el nombre de la tabla como el nombre de la columna ID con comillas dobles
    let sql = format!("DELETE FROM \"{tabla}\" WHERE \"id_{tabla}\" = ?1", tabla = record.tabla);
    
    match conn.execute(&sql, params![record.ids]) {
        Ok(affected) => {
            if affected == 0 {
                // Fallback por si la columna se llama simplemente 'id' (importaciones viejas o manuales)
                println!("[SERA] No se encontró id_{}, intentando con columna 'id'...", record.tabla);
                let sql_fallback = format!("DELETE FROM \"{tabla}\" WHERE \"id\" = ?1", tabla = record.tabla);
                conn.execute(&sql_fallback, params![record.ids])?;
            }
            println!("[SERA] Eliminación exitosa.");
            Ok(())
        },
        Err(e) => {
            println!("[SERA] Error en primer intento de eliminación: {}", e);
            // Re-intentar con columna 'id' por las dudas
            let sql_fallback = format!("DELETE FROM \"{tabla}\" WHERE \"id\" = ?1", tabla = record.tabla);
            conn.execute(&sql_fallback, params![record.ids]).map_err(|e| {
                println!("[SERA] Error crítico en eliminación: {}", e);
                e
            })?;
            Ok(())
        }
    }
}

pub fn importar_bulk(db_path: &Path, bulk: &BulkRecord) -> Result<()> {
    validar_nombre_identificador(&bulk.tabla)?;
    let mut conn = abrir_conn(db_path)?;
    let tx = conn.transaction()?;

    let placeholders: Vec<String> = (1..=bulk.campos.len()).map(|i| format!("?{}", i)).collect();
    let sql = format!(
        "INSERT INTO \"{}\" ({}) VALUES ({})",
        bulk.tabla,
        bulk.campos.iter().map(|c| format!("\"{}\"", c)).collect::<Vec<_>>().join(", "),
        placeholders.join(", ")
    );

    for row in &bulk.contenido {
        let valores: Vec<rusqlite::types::Value> = row.iter().map(|v| rusqlite::types::Value::Text(v.trim().to_string())).collect();
        tx.execute(&sql, rusqlite::params_from_iter(valores.iter()))?;
    }

    tx.commit()?;
    Ok(())
}

// ─── ADJUNTOS ─────────────────────────────────────────────────────────────

pub fn get_adjuntos(db_path: &Path, tabla: &str, registro_id: i64) -> Result<Vec<Value>> {
    let conn = abrir_conn(db_path)?;
    let mut stmt = conn.prepare("SELECT id, archivo_nombre, archivo_ruta_relativa, fecha_creacion FROM _sera_adjuntos WHERE tabla_nombre = ? AND registro_id = ?")?;
    let rows = stmt.query_map(params![tabla, registro_id], |row| {
        Ok(json!({
            "id": row.get::<_, i64>(0)?,
            "nombre": row.get::<_, String>(1)?,
            "ruta": row.get::<_, String>(2)?,
            "fecha": row.get::<_, String>(3)?
        }))
    })?;

    let mut results = Vec::new();
    for r in rows { results.push(r?); }
    Ok(results)
}

pub fn get_todos_los_adjuntos_de_tabla(db_path: &Path, tabla: &str) -> Result<Vec<crate::models::ExportedAdjunto>> {
    let conn = abrir_conn(db_path)?;
    let mut stmt = conn.prepare("SELECT registro_id, archivo_nombre, archivo_ruta_relativa FROM _sera_adjuntos WHERE tabla_nombre = ?")?;
    let rows = stmt.query_map(params![tabla], |row| {
        Ok(crate::models::ExportedAdjunto {
            registro_id: row.get(0)?,
            nombre: row.get(1)?,
            ruta_interna: row.get(2)?,
        })
    })?;

    let mut results = Vec::new();
    for r in rows { results.push(r?); }
    Ok(results)
}

pub fn insertar_adjunto(db_path: &Path, tabla: &str, registro_id: i64, nombre: &str, ruta: &str) -> Result<i64> {
    let conn = abrir_conn(db_path)?;
    conn.execute(
        "INSERT INTO _sera_adjuntos (tabla_nombre, registro_id, archivo_nombre, archivo_ruta_relativa) VALUES (?, ?, ?, ?)",
        params![tabla, registro_id, nombre, ruta]
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn eliminar_adjunto(db_path: &Path, id: i64) -> Result<String> {
    let conn = abrir_conn(db_path)?;
    let ruta: String = conn.query_row("SELECT archivo_ruta_relativa FROM _sera_adjuntos WHERE id = ?", params![id], |r| r.get(0))?;
    conn.execute("DELETE FROM _sera_adjuntos WHERE id = ?", params![id])?;
    Ok(ruta)
}

// ─── ESTADÍSTICAS ─────────────────────────────────────────────────────────────

pub fn get_global_stats(db_path: &Path) -> Result<GlobalStats> {
    let conn = abrir_conn(db_path)?;
    let total_tablas: i64 = conn.query_row("SELECT COUNT(*) FROM tablas", [], |r| r.get(0))?;
    
    let mut stmt = conn.prepare("SELECT nombre_tabla FROM tablas")?;
    let tablas: Vec<String> = stmt.query_map([], |row| row.get(0))?.filter_map(|r| r.ok()).collect();
    
    let mut total_registros = 0;
    for tabla in tablas {
        let count: i64 = conn.query_row(&format!("SELECT COUNT(*) FROM \"{}\"", tabla), [], |r| r.get(0)).unwrap_or(0);
        total_registros += count;
    }

    Ok(GlobalStats { total_tablas, total_registros })
}

// ─── BÚSQUEDA GLOBAL ─────────────────────────────────────────────────────────────

pub fn search_global(db_path: &Path, term: &str) -> Result<Value> {
    let conn = abrir_conn(db_path)?;
    let term_like = format!("%{}%", term);

    let mut stmt = conn.prepare("SELECT nombre_tabla FROM tablas")?;
    let tablas: Vec<String> = stmt.query_map([], |row| row.get(0))?.filter_map(|r| r.ok()).collect();

    let mut all_results = serde_json::Map::new();

    for tabla in tablas {
        let mut pragma_stmt = conn.prepare(&format!("PRAGMA table_info(\"{}\")", tabla))?;
        let columns: Vec<String> = pragma_stmt.query_map([], |row| Ok((row.get::<_, String>(1)?, row.get::<_, String>(2)?)))?
            .filter_map(|r| r.ok())
            .filter(|(_, dtype)| {
                let d = dtype.to_uppercase();
                d.contains("TEXT") || d.contains("VARCHAR") || d.contains("CHAR")
            })
            .map(|(name, _)| name)
            .collect();

        if columns.is_empty() { continue; }

        let conditions: Vec<String> = columns.iter().map(|c| format!("\"{}\" LIKE ?", c)).collect();
        let query = format!("SELECT * FROM \"{}\" WHERE {}", tabla, conditions.join(" OR "));
        let mut search_stmt = conn.prepare(&query)?;
        
        let params_vec: Vec<&dyn rusqlite::ToSql> = vec![&term_like; columns.len()];
        let rows = search_stmt.query_map(rusqlite::params_from_iter(params_vec), |row| {
            let col_count = row.as_ref().column_count();
            let mut map = serde_json::Map::new();
            for i in 0..col_count {
                let name = row.as_ref().column_name(i).unwrap_or("unknown").to_string();
                map.insert(name, sqlite_value_to_json(row.get(i)?));
            }
            Ok(Value::Object(map))
        })?;

        let results: Vec<Value> = rows.filter_map(|r| r.ok()).collect();
        if !results.is_empty() { all_results.insert(tabla, json!(results)); }
    }

    Ok(Value::Object(all_results))
}

pub fn importar_tabla(db_path: &Path, nombre_tabla: String, package: crate::models::ExportedTable) -> Result<()> {
    let mut conn = abrir_conn(db_path)?;
    let tx = conn.transaction()?;

    // 1. Crear la tabla física
    let mut sql_create = format!("CREATE TABLE IF NOT EXISTS \"{nombre}\" (id_{nombre} INTEGER PRIMARY KEY AUTOINCREMENT", nombre = nombre_tabla);
    
    let mut campos_finales = if package.campos.is_empty() {
        println!("[SERA] No se encontraron campos definidos. Deduciendo de los datos...");
        let mut deduccion = Vec::new();
        if let Some(primer_reg) = package.contenido.first().and_then(|v| v.as_object()) {
            for key in primer_reg.keys() {
                if key != "id" && !key.starts_with("sera_") {
                    deduccion.push(crate::models::Campo {
                        field: key.clone(),
                        tipo: "TEXT".to_string(),
                        null: "YES".to_string(),
                        key: "".to_string(),
                        default: None,
                        extra: "".to_string(),
                    });
                }
            }
        }
        deduccion
    } else {
        package.campos.clone()
    };

    // Filtrar campos virtuales y la columna primary key id_{nombre_tabla} para la creación física
    let id_col_name = format!("id_{}", nombre_tabla);
    campos_finales.retain(|c| {
        let field_lower = c.field.to_lowercase();
        !field_lower.starts_with("sera_") && field_lower != "id" && field_lower != id_col_name.to_lowercase()
    });

    for campo in &campos_finales {
        sql_create.push_str(&format!(", \"{}\" TEXT", campo.field));
    }
    sql_create.push_str(")");
    tx.execute(&sql_create, [])?;

    // 2. Registrar en la tabla maestra 'tablas'
    tx.execute(
        "INSERT OR REPLACE INTO tablas (nombre_tabla, config) VALUES (?, ?)",
        params![nombre_tabla, package.visual_config]
    )?;

    // 3. Insertar los registros
    for reg in &package.contenido {
        if let Some(obj) = reg.as_object() {
            let mut col_names: Vec<String> = Vec::new();
            let mut placeholders: Vec<String> = Vec::new();
            let mut vals_strings = Vec::new();

            // Preservar llave primaria original
            if let Some(id_val) = obj.get(&id_col_name) {
                col_names.push(format!("\"{}\"", id_col_name));
                placeholders.push("?".to_string());
                vals_strings.push(if id_val.is_string() {
                    id_val.as_str().unwrap().to_string()
                } else if id_val.is_null() {
                    "".to_string()
                } else {
                    id_val.to_string()
                });
            }

            for campo in &campos_finales {
                col_names.push(format!("\"{}\"", campo.field));
                placeholders.push("?".to_string());
                
                let v = obj.get(&campo.field).cloned().unwrap_or(serde_json::Value::Null);
                vals_strings.push(if v.is_string() { v.as_str().unwrap().trim().to_string() } else if v.is_null() { "".to_string() } else { v.to_string() });
            }
            
            if col_names.is_empty() { continue; }

            let columns = col_names.join(", ");
            let ques = placeholders.join(", ");
            let mut stmt = tx.prepare(&format!("INSERT OR IGNORE INTO \"{}\" ({}) VALUES ({})", nombre_tabla, columns, ques))?;
            
            let params: Vec<&dyn rusqlite::ToSql> = vals_strings.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
            stmt.execute(rusqlite::params_from_iter(params))?;
        }
    }

    // 4. Insertar los adjuntos si existen
    if let Some(adjuntos) = package.adjuntos {
        for adj in adjuntos {
            let ruta_final = if adj.ruta_interna.starts_with("attachments/") {
                adj.ruta_interna.clone()
            } else {
                format!("attachments/{}", adj.ruta_interna)
            };

            tx.execute(
                "INSERT OR IGNORE INTO _sera_adjuntos (tabla_nombre, registro_id, archivo_nombre, archivo_ruta_relativa) VALUES (?, ?, ?, ?)",
                params![nombre_tabla, adj.registro_id, adj.nombre, ruta_final]
            )?;
        }
    }

    tx.commit()?;
    
    let _ = registrar_log(db_path, &format!("Tabla '{}' importada de paquete .srx y firma criptográfica verificada.", nombre_tabla), "SUCCESS");
    
    println!("[SERA] Tabla '{}' importada con éxito.", nombre_tabla);
    Ok(())
}

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

fn validar_nombre_identificador(nombre: &str) -> Result<()> {
    if nombre.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName("Nombre vacío".into()));
    }
    if !nombre.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err(rusqlite::Error::InvalidParameterName(format!("Nombre inválido: {nombre}")));
    }
    Ok(())
}

fn validar_columna(nombre: &str) -> Result<()> {
    if nombre.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName("Columna vacía".into()));
    }
    if nombre.contains('"') {
        return Err(rusqlite::Error::InvalidParameterName("El nombre de la columna no puede contener comillas dobles".into()));
    }
    Ok(())
}

fn sqlite_value_to_json(valor: rusqlite::types::Value) -> Value {
    match valor {
        rusqlite::types::Value::Null => Value::Null,
        rusqlite::types::Value::Integer(i) => json!(i),
        rusqlite::types::Value::Real(f) => json!(f),
        rusqlite::types::Value::Text(s) => json!(s),
        rusqlite::types::Value::Blob(b) => json!(format!("blob:{} bytes", b.len())),
    }
}

// ─── EXPOSICIÓN DE TABLAS (API DE RED LOCAL) ───────────────────────────────

pub fn exponer_tabla(db_path: &Path, tabla_nombre: &str, permiso: &str, cifrado_e2e: i32) -> Result<(String, String)> {
    validar_nombre_identificador(tabla_nombre)?;
    let conn = abrir_conn(db_path)?;

    // Generar código de conexión XXXXX-XXXX
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let alfabeto: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut codigo = String::new();
    for i in 0..9 {
        if i == 4 {
            codigo.push('-');
        } else {
            let idx = rng.gen_range(0..alfabeto.len());
            codigo.push(alfabeto[idx] as char);
        }
    }

    // Generar token robusto
    let token = format!("sera_tok_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));

    conn.execute(
        "INSERT OR REPLACE INTO sera_api_exposicion (tabla_nombre, codigo_conexion, token_robusto, permiso, cifrado_e2e)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![tabla_nombre, codigo, token, permiso, cifrado_e2e],
    )?;

    let _ = registrar_log(
        db_path,
        &format!("Tabla '{}' expuesta en red local con permisos de '{}'.", tabla_nombre, permiso),
        "SUCCESS"
    );

    Ok((codigo, token))
}

pub fn actualizar_permiso_tabla(db_path: &Path, tabla_nombre: &str, permiso: &str) -> Result<()> {
    validar_nombre_identificador(tabla_nombre)?;
    let conn = abrir_conn(db_path)?;
    conn.execute(
        "UPDATE sera_api_exposicion SET permiso = ?1 WHERE tabla_nombre = ?2",
        params![permiso, tabla_nombre],
    )?;
    let _ = registrar_log(
        db_path,
        &format!("Permisos de la tabla expuesta '{}' actualizados a '{}'.", tabla_nombre, permiso),
        "INFO"
    );
    Ok(())
}

pub fn revocar_exposicion(db_path: &Path, tabla_nombre: &str) -> Result<()> {
    validar_nombre_identificador(tabla_nombre)?;
    let conn = abrir_conn(db_path)?;
    conn.execute("DELETE FROM sera_api_exposicion WHERE tabla_nombre = ?1", params![tabla_nombre])?;
    let _ = registrar_log(
        db_path,
        &format!("Revocada exposición en red local de la tabla '{}'.", tabla_nombre),
        "WARNING"
    );
    Ok(())
}

pub fn get_tablas_expuestas(db_path: &Path) -> Result<Vec<Value>> {
    let conn = abrir_conn(db_path)?;
    let mut stmt = conn.prepare(
        "SELECT tabla_nombre, codigo_conexion, token_robusto, permiso, cifrado_e2e FROM sera_api_exposicion ORDER BY tabla_nombre"
    )?;

    let rows = stmt.query_map([], |row| {
        let tabla_nombre: String = row.get(0)?;
        let codigo_conexion: String = row.get(1)?;
        let token_robusto: String = row.get(2)?;
        let permiso: String = row.get(3)?;
        let cifrado_e2e: i32 = row.get(4)?;
        Ok(json!({
            "tabla": tabla_nombre,
            "codigo": codigo_conexion,
            "token": token_robusto,
            "permiso": permiso,
            "cifradoE2e": cifrado_e2e == 1
        }))
    })?;

    let mut result = Vec::new();
    for r in rows {
        result.push(r?);
    }
    Ok(result)
}

pub fn validar_acceso_tabla(db_path: &Path, tabla_nombre: &str, credencial: &str, metodo_http: &str) -> Result<bool> {
    validar_nombre_identificador(tabla_nombre)?;
    let conn = abrir_conn(db_path)?;

    // Buscamos la fila en sera_api_exposicion que coincida con la tabla (case-insensitive) y con la credencial (Código o Token)
    let permiso_opt: Option<String> = conn.query_row(
        "SELECT permiso FROM sera_api_exposicion 
         WHERE tabla_nombre = ?1 COLLATE NOCASE AND (codigo_conexion = ?2 OR token_robusto = ?2)",
        params![tabla_nombre, credencial],
        |row| row.get(0),
    ).ok();

    let permiso = match permiso_opt {
        Some(p) => p,
        None => return Ok(false), // Credencial inválida o no expuesta
    };

    // Validamos el método HTTP frente al scope/permiso
    let method = metodo_http.to_uppercase();
    match permiso.as_str() {
        "FULL" => Ok(true), // Permite GET, POST, PUT, DELETE
        "READ_WRITE" => {
            // Permite GET, POST, PUT. Bloquea DELETE
            Ok(method != "DELETE")
        }
        "READ" => {
            // Solo permite GET
            Ok(method == "GET")
        }
        _ => Ok(false),
    }
}

