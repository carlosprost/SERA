/// Módulo de modelos de datos de SERA.
/// Define los structs serializables que se intercambian entre el backend Rust
/// y el frontend Angular vía Tauri IPC.

use serde::{Deserialize, Serialize};

/// Representa una tabla registrada en el catálogo de SERA.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Tabla {
    /// Identificador único de la entrada en la tabla de catálogo.
    pub id_tablas: i64,
    /// Nombre de la tabla en la base de datos.
    pub nombre_tabla: String,
}

/// Datos para crear una nueva tabla en la base de datos.
#[derive(Debug, Serialize, Deserialize)]
pub struct NuevaTabla {
    /// Nombre de la tabla a crear.
    pub nombre: String,
    /// Definición de los campos adicionales (ej: "nombre TEXT, edad INTEGER").
    pub campos: String,
    /// Configuración visual y vínculos (JSON).
    pub config: Option<String>,
}

/// Información de un campo de tabla, compatible con la interface `Campos`
/// del frontend Angular (mapeada desde PRAGMA table_info de SQLite).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Campo {
    /// Nombre del campo (mapeado desde `name` de PRAGMA table_info).
    #[serde(rename = "Field")]
    pub field: String,
    /// Tipo de dato del campo (mapeado desde `type` de PRAGMA table_info).
    #[serde(rename = "Type")]
    pub tipo: String,
    /// Si acepta nulos: "YES" o "NO" (mapeado desde `notnull`).
    #[serde(rename = "Null")]
    pub null: String,
    /// Indica si es clave primaria: "PRI" o vacío (mapeado desde `pk`).
    #[serde(rename = "Key")]
    pub key: String,
    /// Valor por defecto del campo.
    #[serde(rename = "Default")]
    pub default: Option<String>,
    /// Extra info (AUTO_INCREMENT, etc.). Vacío en SQLite.
    #[serde(rename = "Extra")]
    pub extra: String,
}

/// Datos para crear o actualizar un registro.
#[derive(Debug, Serialize, Deserialize)]
pub struct NewRecord {
    /// ID del registro (None para crear, Some(id) para actualizar).
    pub id: Option<i64>,
    /// Nombre de la tabla destino.
    pub tabla: String,
    /// Lista de nombres de campos.
    pub campos: Vec<String>,
    /// Lista de valores correspondientes (como strings).
    pub contenido: Vec<String>,
}

/// Datos para eliminar un registro.
#[derive(Debug, Serialize, Deserialize)]
pub struct DeleteRecord {
    /// Nombre de la tabla.
    pub tabla: String,
    /// ID del registro a eliminar.
    pub ids: i64,
}

/// Mapeo de campos para reestructurar tabla.
#[derive(Debug, Serialize, Deserialize)]
pub struct FieldMapping {
    /// Nombre de la columna en la tabla vieja.
    pub old_name: String,
    /// Nombre de la columna en la tabla nueva (o el mismo).
    pub new_name: String,
}

/// Datos para reestructurar (migrar) una tabla existente.
#[derive(Debug, Serialize, Deserialize)]
pub struct RestructureTable {
    /// Nombre actual de la tabla.
    pub nombre_viejo: String,
    /// Nuevo nombre deseado para la tabla.
    pub nombre_nuevo: String,
    /// Definición SQL de los campos nuevos (ej: "col1 TEXT, col2 INTEGER").
    pub campos_schema: String,
    /// Lista de mapeos para copiar datos (viejo_nombre -> nuevo_nombre).
    pub mapeo: Vec<FieldMapping>,
    /// Nueva configuración visual y vínculos (JSON).
    pub config: Option<String>,
}

/// Configuración persistente del usuario.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConfigData {
    /// Nombre de la aplicación.
    #[serde(rename = "nombreApp")]
    pub nombre_app: String,
    /// Datos del usuario actual.
    pub user: UserConfig,
}

/// Datos del usuario configurados en la app.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserConfig {
    pub nombre: String,
    pub grado: String,
    pub institucion: String,
    pub dependencia: String,
    pub oficina: String,
    pub membrete: String,
}

/// Modelo para exportar adjuntos junto con la tabla.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportedAdjunto {
    pub registro_id: i64,
    pub nombre: String,
    pub ruta_interna: String,
}

/// Empaquetado completo de una tabla para exportación (.srx).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportedTable {
    pub nombre: String,
    pub campos: Vec<Campo>,
    pub contenido: Vec<serde_json::Value>,
    pub visual_config: String,
    pub adjuntos: Option<Vec<ExportedAdjunto>>,
}

/// Paquete multi-tabla para exportación (.srx).
#[derive(Debug, Serialize, Deserialize)]
pub struct ExportPackage {
    pub tablas: Vec<ExportedTable>,
}

/// Datos para insertar múltiples registros en bloque.
#[derive(Debug, Serialize, Deserialize)]
pub struct BulkRecord {
    /// Nombre de la tabla destino.
    pub tabla: String,
    /// Lista de nombres de campos.
    pub campos: Vec<String>,
    /// Lista de registros, donde cada registro es una lista de valores (strings).
    pub contenido: Vec<Vec<String>>,
}

/// Estadísticas globales del sistema.
#[derive(Debug, Serialize, Deserialize)]
pub struct GlobalStats {
    /// Cantidad total de tablas creadas.
    pub total_tablas: i64,
    /// Suma total de registros en todas las tablas.
    pub total_registros: i64,
}
