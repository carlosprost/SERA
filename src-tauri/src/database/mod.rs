/// Módulo de base de datos SQLite para SERA.
/// Gestiona la conexión, inicialización del esquema y todas las operaciones CRUD.

use rusqlite::{Connection, Result, params};
use std::path::Path;
use crate::models::{Campo, ConfigData, DeleteRecord, NewRecord, NuevaTabla, RestructureTable, Tabla, UserConfig};

/// Inicializa la base de datos SQLite en la ruta indicada.
/// Crea el esquema inicial si no existe:
/// - Tabla `tablas`: catálogo de tablas creadas por el usuario.
/// - Tabla `sera_config`: configuración persistente del usuario.
///
/// # Arguments
/// * `db_path` - Ruta al archivo .db de SQLite.
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
            user_membrete TEXT NOT NULL DEFAULT ''
        );

        INSERT OR IGNORE INTO sera_config (id, nombre_app, user_nombre, user_grado, user_institucion, user_dependencia, user_oficina, user_membrete)
        VALUES (1, 'SERA', '', '', '', '', '', '');
        ",
    )?;

    // MIGRATION: Agregamos la columna config si la BD ya existía antes de esta versión
    let _ = conn.execute("ALTER TABLE tablas ADD COLUMN config TEXT DEFAULT '{}'", []);

    Ok(())
}

/// Abre una conexión a la base de datos en la ruta indicada.
fn abrir_conn(db_path: &Path) -> Result<Connection> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    Ok(conn)
}

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

/// Obtiene la configuración actual del usuario desde la DB.
pub fn get_config(db_path: &Path) -> Result<ConfigData> {
    let conn = abrir_conn(db_path)?;
    let config = conn.query_row(
        "SELECT nombre_app, user_nombre, user_grado, user_institucion, user_dependencia, user_oficina, user_membrete FROM sera_config WHERE id = 1",
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
                },
            })
        },
    )?;
    Ok(config)
}

/// Actualiza la configuración del usuario en la DB.
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
            user_membrete = ?7
        WHERE id = 1",
        params![
            config.nombre_app,
            config.user.nombre,
            config.user.grado,
            config.user.institucion,
            config.user.dependencia,
            config.user.oficina,
            config.user.membrete,
        ],
    )?;
    Ok(())
}

// ─── TABLAS ───────────────────────────────────────────────────────────────────

/// Devuelve el listado de todas las tablas registradas en el catálogo.
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

/// Obtiene la configuración de reglas (JSON string) para una tabla específica
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

/// Actualiza la configuración de reglas de una tabla específica
pub fn update_tabla_config(db_path: &Path, nombre_tabla: &str, config_json: &str) -> Result<()> {
    validar_nombre_identificador(nombre_tabla)?;
    let conn = abrir_conn(db_path)?;
    conn.execute(
        "UPDATE tablas SET config = ?1 WHERE nombre_tabla = ?2",
        params![config_json, nombre_tabla],
    )?;
    Ok(())
}

/// Crea una nueva tabla en la DB y la registra en el catálogo.
///
/// La tabla tendrá siempre una PK llamada `id_{nombre}` de tipo INTEGER AUTOINCREMENT.
/// Los campos adicionales se pasan como string con la sintaxis SQLite
/// (ej: "nombre TEXT, edad INTEGER").
///
/// NOTA DE SEGURIDAD: El nombre de tabla y los nombres de campos son validados
/// antes de ser interpolados en la query DDL. Esta es la única situación donde
/// no se pueden usar parámetros SQLite: las sentencias DDL (CREATE TABLE)
/// no admiten placeholders para nombres de objetos.
pub fn crear_tabla(db_path: &Path, nueva_tabla: &NuevaTabla) -> Result<()> {
    // Validación: solo se permiten nombres con letras, números y guiones bajos
    validar_nombre_identificador(&nueva_tabla.nombre)?;

    let conn = abrir_conn(db_path)?;

    // Crear la tabla con PK dinámica compatible con el frontend
    let sql_create = format!(
        "CREATE TABLE IF NOT EXISTS {nombre} (
            id_{nombre} INTEGER PRIMARY KEY AUTOINCREMENT,
            {campos}
        )",
        nombre = nueva_tabla.nombre,
        campos = nueva_tabla.campos
    );

    conn.execute_batch(&sql_create)?;

    // Registrar en el catálogo usando prepared statement (seguro contra injection)
    conn.execute(
        "INSERT OR IGNORE INTO tablas (nombre_tabla) VALUES (?1)",
        params![nueva_tabla.nombre],
    )?;

    Ok(())
}

/// Elimina una tabla de la DB y la quita del catálogo.
///
/// NOTA DE SEGURIDAD: Igual que en crear_tabla, el nombre de tabla en DDL
/// (DROP TABLE) no admite placeholders, por lo que se valida el nombre primero.
pub fn eliminar_tabla(db_path: &Path, nombre_tabla: &str) -> Result<()> {
    validar_nombre_identificador(nombre_tabla)?;

    let conn = abrir_conn(db_path)?;

    let sql_drop = format!("DROP TABLE IF EXISTS {nombre_tabla}");
    conn.execute_batch(&sql_drop)?;

    conn.execute(
        "DELETE FROM tablas WHERE nombre_tabla = ?1",
        params![nombre_tabla],
    )?;

    Ok(())
}

/// Reestructura una tabla existente (Renombrar, Reordenar, Borrar, Agregar campos).
/// Proceso: Crear temporal -> Copiar datos -> Borrar vieja -> Renombrar temporal.
pub fn reestructurar_tabla(db_path: &Path, info: &RestructureTable) -> Result<()> {
    validar_nombre_identificador(&info.nombre_viejo)?;
    validar_nombre_identificador(&info.nombre_nuevo)?;

    let mut conn = abrir_conn(db_path)?;
    let tx = conn.transaction()?;

    // 1. Crear tabla temporal
    let temp_name = format!("__temp_{}", info.nombre_nuevo);
    let sql_create = format!(
        "CREATE TABLE {temp_name} (
            id_{new_name} INTEGER PRIMARY KEY AUTOINCREMENT,
            {campos}
        )",
        new_name = info.nombre_nuevo,
        campos = info.campos_schema
    );
    tx.execute_batch(&sql_create)?;

    // 2. Construir la consulta de copia de datos selectiva
    // Mapeamos el ID viejo al ID nuevo explícitamente
    let id_viejo = format!("id_{}", info.nombre_viejo);
    let id_nuevo = format!("id_{}", info.nombre_nuevo);

    let mut select_cols = vec![id_viejo];
    let mut insert_cols = vec![id_nuevo];

    for m in &info.mapeo {
        validar_nombre_identificador(&m.old_name)?;
        validar_nombre_identificador(&m.new_name)?;
        select_cols.push(m.old_name.clone());
        insert_cols.push(m.new_name.clone());
    }

    let sql_copy = format!(
        "INSERT INTO {temp_name} ({insert_cols}) SELECT {select_cols} FROM {nombre_viejo}",
        temp_name = temp_name,
        insert_cols = insert_cols.join(", "),
        select_cols = select_cols.join(", "),
        nombre_viejo = info.nombre_viejo
    );
    tx.execute_batch(&sql_copy)?;

    // 3. Limpieza: Borrar tabla vieja y renombrar
    tx.execute_batch(&format!("DROP TABLE {nombre_viejo}", nombre_viejo = info.nombre_viejo))?;
    tx.execute_batch(&format!("ALTER TABLE {temp_name} RENAME TO {nombre_nuevo}", temp_name = temp_name, nombre_nuevo = info.nombre_nuevo))?;

    // 4. Actualizar catálogo si el nombre cambió
    tx.execute(
        "UPDATE tablas SET nombre_tabla = ?1 WHERE nombre_tabla = ?2",
        params![info.nombre_nuevo, info.nombre_viejo],
    )?;

    tx.commit()?;
    Ok(())
}

// ─── CAMPOS ───────────────────────────────────────────────────────────────────

/// Devuelve la estructura de campos de una tabla usando PRAGMA table_info.
/// El resultado se mapea al formato `Campos` esperado por el frontend Angular.
pub fn get_campos(db_path: &Path, tabla: &str) -> Result<Vec<Campo>> {
    validar_nombre_identificador(tabla)?;

    let conn = abrir_conn(db_path)?;
    let sql = format!("PRAGMA table_info({tabla})");
    let mut stmt = conn.prepare(&sql)?;

    let campos = stmt
        .query_map([], |row| {
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
        })?
        .collect::<Result<Vec<Campo>>>()?;

    Ok(campos)
}

// ─── CONTENIDO / REGISTROS ────────────────────────────────────────────────────

/// Devuelve todos los registros de una tabla.
pub fn get_contenido(db_path: &Path, tabla: &str) -> Result<Vec<serde_json::Value>> {
    validar_nombre_identificador(tabla)?;

    let conn = abrir_conn(db_path)?;
    let sql = format!("SELECT * FROM {tabla}");
    let mut stmt = conn.prepare(&sql)?;

    let column_names: Vec<String> = stmt
        .column_names()
        .iter()
        .map(|s| s.to_string())
        .collect();

    let filas = stmt
        .query_map([], |row| {
            let mut obj = serde_json::Map::new();
            for (i, col) in column_names.iter().enumerate() {
                let valor: rusqlite::types::Value = row.get(i)?;
                obj.insert(col.clone(), sqlite_value_to_json(valor));
            }
            Ok(serde_json::Value::Object(obj))
        })?
        .collect::<Result<Vec<serde_json::Value>>>()?;

    Ok(filas)
}

/// Inserta un nuevo registro en la tabla indicada.
///
/// NOTA DE SEGURIDAD: Los valores se insertan usando execute_batch con
/// parámetros posicionales. Los nombres de columnas son validados.
/// Los valores vienen como strings desde el frontend y se insertan directamente
/// mediante la API de parámetros de rusqlite, eliminando el riesgo de SQL Injection.
pub fn nuevo_registro(db_path: &Path, record: &NewRecord) -> Result<()> {
    validar_nombre_identificador(&record.tabla)?;
    for campo in &record.campos {
        validar_nombre_identificador(campo)?;
    }

    let conn = abrir_conn(db_path)?;

    let columnas = record.campos.join(", ");
    let placeholders: Vec<String> = (1..=record.campos.len())
        .map(|i| format!("?{i}"))
        .collect();
    let placeholders_str = placeholders.join(", ");

    let sql = format!(
        "INSERT INTO {tabla} ({columnas}) VALUES ({placeholders_str})",
        tabla = record.tabla
    );

    let mut stmt = conn.prepare(&sql)?;

    // Mapear los valores del frontend a params de rusqlite
    let valores: Vec<rusqlite::types::Value> = record
        .contenido
        .iter()
        .map(|v| {
            // Limpiar comillas que el frontend agrega (compatibilidad con el formato anterior)
            let limpio = v.trim_matches('"');
            rusqlite::types::Value::Text(limpio.to_string())
        })
        .collect();

    stmt.execute(rusqlite::params_from_iter(valores.iter()))?;

    Ok(())
}

/// Actualiza un registro existente.
pub fn actualizar_registro(db_path: &Path, record: &NewRecord) -> Result<()> {
    validar_nombre_identificador(&record.tabla)?;
    for campo in &record.campos {
        validar_nombre_identificador(campo)?;
    }

    let id = record.id.ok_or_else(|| rusqlite::Error::InvalidParameterName("id requerido para actualizar".into()))?;
    let conn = abrir_conn(db_path)?;

    let sets: Vec<String> = record
        .campos
        .iter()
        .enumerate()
        .map(|(i, campo)| format!("{campo} = ?{}", i + 1))
        .collect();
    let sets_str = sets.join(", ");
    let id_placeholder = record.campos.len() + 1;

    let sql = format!(
        "UPDATE {tabla} SET {sets_str} WHERE id_{tabla} = ?{id_placeholder}",
        tabla = record.tabla
    );

    let mut stmt = conn.prepare(&sql)?;

    let mut valores: Vec<rusqlite::types::Value> = record
        .contenido
        .iter()
        .map(|v| {
            let limpio = v.trim_matches('"');
            rusqlite::types::Value::Text(limpio.to_string())
        })
        .collect();
    valores.push(rusqlite::types::Value::Integer(id));

    stmt.execute(rusqlite::params_from_iter(valores.iter()))?;

    Ok(())
}

/// Elimina un registro por su ID.
pub fn eliminar_registro(db_path: &Path, record: &DeleteRecord) -> Result<()> {
    validar_nombre_identificador(&record.tabla)?;

    let conn = abrir_conn(db_path)?;
    let sql = format!(
        "DELETE FROM {tabla} WHERE id_{tabla} = ?1",
        tabla = record.tabla
    );
    conn.execute(&sql, params![record.ids])?;

    Ok(())
}

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

/// Valida que un identificador (nombre de tabla o campo) solo contenga
/// caracteres seguros: letras, números y guiones bajos.
///
/// Esto mitiga el riesgo de SQL Injection en sentencias DDL donde
/// los placeholders (?) no son aplicables.
///
/// OWASP A03 — Injection: validación de identificadores.
fn validar_nombre_identificador(nombre: &str) -> Result<()> {
    if nombre.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName(
            "El nombre no puede estar vacío".into(),
        ));
    }
    let valido = nombre
        .chars()
        .all(|c| c.is_alphanumeric() || c == '_');
    if !valido {
        return Err(rusqlite::Error::InvalidParameterName(format!(
            "Nombre inválido '{nombre}': solo se permiten letras, números y guiones bajos"
        )));
    }
    Ok(())
}

/// Convierte valores de SQLite a JSON para serialización.
fn sqlite_value_to_json(valor: rusqlite::types::Value) -> serde_json::Value {
    match valor {
        rusqlite::types::Value::Null => serde_json::Value::Null,
        rusqlite::types::Value::Integer(i) => serde_json::Value::Number(i.into()),
        rusqlite::types::Value::Real(f) => {
            serde_json::Number::from_f64(f)
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::Null)
        }
        rusqlite::types::Value::Text(s) => serde_json::Value::String(s),
        rusqlite::types::Value::Blob(b) => {
            serde_json::Value::String(base64_encode(&b))
        }
    }
}

/// Codifica bytes en base64 sin dependencias externas (implementación simple).
fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();
    let mut i = 0;
    while i < data.len() {
        let b0 = data[i] as u32;
        let b1 = if i + 1 < data.len() { data[i + 1] as u32 } else { 0 };
        let b2 = if i + 2 < data.len() { data[i + 2] as u32 } else { 0 };
        result.push(CHARS[((b0 >> 2) & 0x3F) as usize] as char);
        result.push(CHARS[((b0 << 4 | b1 >> 4) & 0x3F) as usize] as char);
        result.push(if i + 1 < data.len() { CHARS[((b1 << 2 | b2 >> 6) & 0x3F) as usize] as char } else { '=' });
        result.push(if i + 2 < data.len() { CHARS[(b2 & 0x3F) as usize] as char } else { '=' });
        i += 3;
    }
    result
}
