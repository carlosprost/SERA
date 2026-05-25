use axum::{
    extract::{Path, State, ConnectInfo},
    http::{StatusCode, HeaderMap},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use std::net::SocketAddr;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use serde_json::{json, Value};
use tokio::sync::oneshot;

#[derive(Clone)]
struct ApiState {
    db_path: PathBuf,
    app_handle: AppHandle,
}

/// Representa el payload de datos de escritura (creación y actualización)
#[derive(serde::Deserialize)]
struct PayloadEscritura {
    id: Option<i64>,
    campos: Vec<String>,
    contenido: Vec<String>,
}

/// Inicia el servidor Axum en segundo plano. Retorna el canal para apagar el servidor de forma graciosa.
pub fn iniciar_servidor_api(
    app_handle: AppHandle,
    db_path: PathBuf,
    puerto: u16,
) -> Result<oneshot::Sender<()>, String> {
    let state = ApiState {
        db_path,
        app_handle: app_handle.clone(),
    };

    // Configuración del ruteo de Axum
    let app = Router::new()
        .route("/api/v1/status", get(handle_status))
        .route("/api/v1/tablas/:nombre/campos", get(handle_get_campos))
        .route("/api/v1/tablas/:nombre/contenido", get(handle_get_contenido))
        .route(
            "/api/v1/tablas/:nombre/registro",
            post(handle_escribir_registro)
                .put(handle_actualizar_registro)
                .delete(handle_eliminar_registro),
        )
        .route(
            "/api/v1/tablas/:nombre/registro/:id",
            post(handle_escribir_registro)
                .put(handle_actualizar_registro)
                .delete(handle_eliminar_registro),
        )
        .layer(
            tower_http::cors::CorsLayer::new()
                .allow_origin(tower_http::cors::Any)
                .allow_methods(tower_http::cors::Any)
                .allow_headers(tower_http::cors::Any),
        )
        .with_state(state);

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    let addr = SocketAddr::from(([0, 0, 0, 0], puerto));
    println!("[SERA Host API] Iniciando servidor de red local en {:?}", addr);

    // Spawnear el servidor en el runtime asíncrono de Tauri v2
    tauri::async_runtime::spawn(async move {
        match tokio::net::TcpListener::bind(addr).await {
            Ok(listener) => {
                let server = axum::serve(
                    listener,
                    app.into_make_service_with_connect_info::<SocketAddr>(),
                )
                .with_graceful_shutdown(async move {
                    let _ = shutdown_rx.await;
                    println!("[SERA Host API] Apagando socket del servidor HTTP local de forma limpia...");
                });

                if let Err(e) = server.await {
                    eprintln!("[SERA Host API] Error durante la ejecución del servidor: {:?}", e);
                }
            }
            Err(err) => {
                eprintln!("[SERA Host API] No se pudo enlazar el socket al puerto {:?}: {:?}", puerto, err);
                // Notificar error de binding de red a la UI
                let _ = app_handle.emit("api-server-error", format!("El puerto {} ya se encuentra ocupado.", puerto));
            }
        }
    });

    Ok(shutdown_tx)
}

/// Endpoint público de validación de estado del Host.
async fn handle_status() -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(json!({
            "status": "online",
            "app": "SERA",
            "version": "4.0.0"
        })),
    )
}

/// Middleware interno para validar la autorización por tabla y método HTTP.
fn autorizar_solicitud(
    headers: &HeaderMap,
    db_path: &PathBuf,
    tabla_nombre: &str,
    metodo: &str,
) -> Result<(), (StatusCode, Json<Value>)> {
    // 1. Obtener la credencial del header de autorización
    let auth_header = match headers.get("Authorization").and_then(|h| h.to_str().ok()) {
        Some(auth) => auth,
        None => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Credenciales ausentes. Cabecera 'Authorization: Bearer <TOKEN>' requerida." })),
            ));
        }
    };

    let credencial = if auth_header.starts_with("Bearer ") {
        &auth_header[7..]
    } else {
        auth_header
    };

    // 2. Validar credenciales en la base de datos contra el catálogo expuesto
    match crate::database::validar_acceso_tabla(db_path, tabla_nombre, credencial, metodo) {
        Ok(true) => Ok(()), // Acceso concedido
        Ok(false) => {
            // Credencial incorrecta o permisos insuficientes
            Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "Credenciales inválidas o permisos insuficientes para realizar esta operación." })),
            ))
        }
        Err(err) => {
            eprintln!("[SERA Host API] Error al validar credenciales: {:?}", err);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Error interno del servidor al validar credenciales." })),
            ))
        }
    }
}

/// Inspecciona recursivamente los campos del payload contra inyecciones de código HTML/JS (WAF).
fn ejecutar_waf(
    app_handle: &AppHandle,
    db_path: &PathBuf,
    ip_origen: &str,
    tabla_nombre: &str,
    payload: &PayloadEscritura,
) -> Result<(), (StatusCode, Json<Value>)> {
    for (i, campo) in payload.campos.iter().enumerate() {
        if i >= payload.contenido.len() {
            continue;
        }
        let valor = &payload.contenido[i];
        if let Some(firma) = crate::security::detectar_patrones_sospechosos(valor) {
            eprintln!(
                "[SERA Host API] ¡INTRUSIÓN BLOQUEADA! IP: {}, Tabla: {}, Campo: {}, Payload: '{}', Firma: {}",
                ip_origen, tabla_nombre, campo, valor, firma
            );

            // 1. Registrar log crítico en base de datos
            let mensaje_log = format!(
                "Intento de intrusión (Script Injection) bloqueado desde la IP '{}'. Tabla: '{}', Campo: '{}'. Firma detectada: {}.",
                ip_origen, tabla_nombre, campo, firma
            );
            let _ = crate::database::registrar_log(db_path, &mensaje_log, "CRITICAL_SECURITY");

            // 2. Emitir alerta visual al operador de SERA en tiempo real
            let _ = app_handle.emit(
                "security-alert",
                json!({
                    "ip": ip_origen,
                    "tabla": tabla_nombre,
                    "campo": campo,
                    "payload": valor,
                    "firma": firma
                }),
            );

            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "Petición bloqueada por directivas de seguridad del Host (WAF: Script Detectado)."
                })),
            ));
        }
    }
    Ok(())
}

/// Realiza una validación estricta de consistencia de tipos de datos en escritura.
fn validar_consistencia_tipos(
    db_path: &PathBuf,
    tabla_nombre: &str,
    payload: &PayloadEscritura,
) -> Result<(), (StatusCode, Json<Value>)> {
    // Obtener esquema de campos reales de la tabla SQLite
    let campos_reales = match crate::database::get_campos(db_path, tabla_nombre) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[SERA Host API] Error al obtener columnas de la tabla {}: {:?}", tabla_nombre, e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Error interno del servidor al verificar consistencia de datos." })),
            ));
        }
    };

    for (i, campo) in payload.campos.iter().enumerate() {
        if i >= payload.contenido.len() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("Petición malformada: Falta valor para el campo '{}'", campo) })),
            ));
        }
        let valor = &payload.contenido[i];

        // Buscar el campo en el esquema real
        if let Some(campo_schema) = campos_reales.iter().find(|c| c.field.eq_ignore_ascii_case(campo)) {
            let tipo = campo_schema.tipo.to_uppercase();

            // 1. Validar Tipo Numérico
            if tipo.contains("INT") || tipo.contains("REAL") || tipo.contains("NUM") || tipo.contains("DOUBLE") || tipo.contains("FLOAT") {
                if !valor.trim().is_empty() && valor.trim().parse::<f64>().is_err() {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(json!({
                            "error": format!("Error de validación de datos: El campo '{}' debe ser un valor numérico válido (recibido: '{}').", campo, valor)
                        })),
                    ));
                }
            }

            // 2. Validar Booleano
            if tipo.contains("BOOL") {
                let v_lower = valor.to_lowercase();
                if !valor.trim().is_empty() && v_lower != "true" && v_lower != "false" && v_lower != "1" && v_lower != "0" {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(json!({
                            "error": format!("Error de validación de datos: El campo '{}' debe ser un booleano válido (true/false, 1/0).", campo)
                        })),
                    ));
                }
            }

            // 3. Validar Estructura Temporal simple (Fecha)
            if tipo.contains("DATE") || tipo.contains("TIMESTAMP") {
                // Validación simple de patrón YYYY-MM-DD
                let trimmed = valor.trim();
                if !trimmed.is_empty() {
                    let mut parts = trimmed.split('-');
                    let y = parts.next().and_then(|s| s.parse::<u16>().ok());
                    let m = parts.next().and_then(|s| s.parse::<u8>().ok());
                    let d = parts.next().and_then(|s| s.split(' ').next()?.parse::<u8>().ok());
                    
                    if y.is_none() || m.is_none() || d.is_none() || m.unwrap() > 12 || d.unwrap() > 31 {
                        return Err((
                            StatusCode::BAD_REQUEST,
                            Json(json!({
                                "error": format!("Error de validación de datos: El campo '{}' debe tener un formato de fecha ISO válido YYYY-MM-DD.", campo)
                            })),
                        ));
                    }
                }
            }

            // 4. Validar Hora (HH:MM)
            if tipo.contains("TIME") {
                let trimmed = valor.trim();
                if !trimmed.is_empty() {
                    let mut parts = trimmed.split(':');
                    let hh = parts.next().and_then(|s| s.parse::<u8>().ok());
                    let mm = parts.next().and_then(|s| s.parse::<u8>().ok());
                    
                    if hh.is_none() || mm.is_none() || hh.unwrap() > 23 || mm.unwrap() > 59 {
                        return Err((
                            StatusCode::BAD_REQUEST,
                            Json(json!({
                                "error": format!("Error de validación de datos: El campo '{}' debe tener un formato de hora válido HH:MM o HH:MM:SS.", campo)
                            })),
                        ));
                    }
                }
            }
        } else {
            // Columna inexistente en la base de datos
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("Error de consistencia: La columna '{}' no pertenece al esquema de la tabla.", campo) })),
            ));
        }
    }
    Ok(())
}

/// Handler GET para obtener el esquema de columnas de una tabla expuesta.
async fn handle_get_campos(
    Path(nombre): Path<String>,
    State(state): State<ApiState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    // Validar autorización
    if let Err(err_response) = autorizar_solicitud(&headers, &state.db_path, &nombre, "GET") {
        return err_response;
    }

    match crate::database::get_campos(&state.db_path, &nombre) {
        Ok(campos) => (StatusCode::OK, Json(json!(campos))),
        Err(e) => {
            eprintln!("[SERA Host API] Error al recuperar columnas para la tabla '{}': {:?}", nombre, e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("No se pudo recuperar el esquema de la tabla expuesta '{}'", nombre) })),
            )
        }
    }
}

/// Handler GET para consultar las filas (contenido) de una tabla expuesta.
async fn handle_get_contenido(
    Path(nombre): Path<String>,
    State(state): State<ApiState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    // Validar autorización
    if let Err(err_response) = autorizar_solicitud(&headers, &state.db_path, &nombre, "GET") {
        return err_response;
    }

    match crate::database::get_contenido(&state.db_path, &nombre) {
        Ok(contenido) => (StatusCode::OK, Json(json!(contenido))),
        Err(e) => {
            eprintln!("[SERA Host API] Error al recuperar filas de la tabla '{}': {:?}", nombre, e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("No se pudo recuperar el contenido de la tabla expuesta '{}'", nombre) })),
            )
        }
    }
}

/// Handler POST para registrar un nuevo elemento en la tabla expuesta.
async fn handle_escribir_registro(
    Path(nombre): Path<String>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(payload): Json<PayloadEscritura>,
) -> impl IntoResponse {
    let ip_origen = addr.ip().to_string();

    // 1. Validar autorización (Mínimo READ_WRITE)
    if let Err(err_response) = autorizar_solicitud(&headers, &state.db_path, &nombre, "POST") {
        return err_response;
    }

    // 2. WAF - Sanitización de scripts inyectados
    if let Err(err_response) = ejecutar_waf(&state.app_handle, &state.db_path, &ip_origen, &nombre, &payload) {
        return err_response;
    }

    // 3. Validación estricta de consistencia de tipos
    if let Err(err_response) = validar_consistencia_tipos(&state.db_path, &nombre, &payload) {
        return err_response;
    }

    // Mapeo al struct de base de datos
    let db_record = crate::models::NewRecord {
        id: None,
        tabla: nombre.clone(),
        campos: payload.campos,
        contenido: payload.contenido,
    };

    // 4. Inserción física en SQLite
    match crate::database::nuevo_registro(&state.db_path, &db_record) {
        Ok(inserted_id) => {
            let log_msg = format!("Registro remoto agregado a la tabla '{}' ID #{} por API desde IP '{}'.", nombre, inserted_id, ip_origen);
            let _ = crate::database::registrar_log(&state.db_path, &log_msg, "INFO");

            (
                StatusCode::CREATED,
                Json(json!({
                    "status": "success",
                    "message": "Registro insertado de forma remota exitosamente.",
                    "insertedId": inserted_id
                })),
            )
        }
        Err(e) => {
            eprintln!("[SERA Host API] Error de inserción física en SQLite: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Error interno de base de datos al registrar el elemento." })),
            )
        }
    }
}

/// Handler PUT para actualizar un registro en la tabla.
async fn handle_actualizar_registro(
    Path(nombre): Path<String>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(payload): Json<PayloadEscritura>,
) -> impl IntoResponse {
    let ip_origen = addr.ip().to_string();

    // 1. Validar autorización (Mínimo READ_WRITE)
    if let Err(err_response) = autorizar_solicitud(&headers, &state.db_path, &nombre, "PUT") {
        return err_response;
    }

    let id_registro = match payload.id {
        Some(id) => id,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "El atributo 'id' del registro es obligatorio para su actualización." })),
            );
        }
    };

    // 2. WAF - Sanitización de scripts inyectados
    if let Err(err_response) = ejecutar_waf(&state.app_handle, &state.db_path, &ip_origen, &nombre, &payload) {
        return err_response;
    }

    // 3. Validación de consistencia de tipos
    if let Err(err_response) = validar_consistencia_tipos(&state.db_path, &nombre, &payload) {
        return err_response;
    }

    let db_record = crate::models::NewRecord {
        id: Some(id_registro),
        tabla: nombre.clone(),
        campos: payload.campos,
        contenido: payload.contenido,
    };

    // 4. Actualización física en SQLite
    match crate::database::actualizar_registro(&state.db_path, &db_record) {
        Ok(_) => {
            let log_msg = format!("Registro ID #{} actualizado remotamente en la tabla '{}' por API desde IP '{}'.", id_registro, nombre, ip_origen);
            let _ = crate::database::registrar_log(&state.db_path, &log_msg, "INFO");

            (
                StatusCode::OK,
                Json(json!({
                    "status": "success",
                    "message": "Registro actualizado exitosamente de forma remota."
                })),
            )
        }
        Err(e) => {
            eprintln!("[SERA Host API] Error de actualización física en SQLite: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Error interno de base de datos al actualizar el registro." })),
            )
        }
    }
}

/// Handler DELETE para remover un registro de la tabla.
async fn handle_eliminar_registro(
    Path(nombre): Path<String>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    let ip_origen = addr.ip().to_string();

    // 1. Validar autorización (Mínimo FULL)
    if let Err(err_response) = autorizar_solicitud(&headers, &state.db_path, &nombre, "DELETE") {
        return err_response;
    }

    // Extraer el ID de la solicitud
    let id_registro = match payload.get("id").and_then(|v| v.as_i64()) {
        Some(id) => id,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "El campo 'id' del registro es requerido en el body del JSON para la eliminación." })),
            );
        }
    };

    let delete_record = crate::models::DeleteRecord {
        tabla: nombre.clone(),
        ids: id_registro,
    };

    // 2. Eliminación física en SQLite
    match crate::database::eliminar_registro(&state.db_path, &delete_record) {
        Ok(_) => {
            let log_msg = format!("Registro ID #{} eliminado de forma remota en la tabla '{}' por API desde IP '{}'.", id_registro, nombre, ip_origen);
            let _ = crate::database::registrar_log(&state.db_path, &log_msg, "INFO");

            (
                StatusCode::OK,
                Json(json!({
                    "status": "success",
                    "message": "Registro remoto eliminado exitosamente de SQLite."
                })),
            )
        }
        Err(e) => {
            eprintln!("[SERA Host API] Error de borrado en SQLite: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Error interno de base de datos al eliminar el elemento." })),
            )
        }
    }
}
