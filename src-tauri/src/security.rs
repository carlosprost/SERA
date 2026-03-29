use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::{rngs::OsRng, RngCore};

/// Cabecera mágica para identificar archivos de SERA.
pub const MAGIC_HEADER: &[u8; 12] = b"SERA_V1_PACK";

/// Llave maestra interna para el cifrado de exportaciones.
/// En un entorno real, esto podría derivarse de un secreto del sistema.
const MASTER_KEY: &[u8; 32] = b"SERA_INTERNAL_SECURITY_KEY_2024_"; // 32 bytes para AES-256

pub struct CryptoProvider;

impl CryptoProvider {
    /// Cifra un contenido y devuelve el paquete completo: Header + Nonce + Ciphertext.
    pub fn encrypt(data: &[u8]) -> Result<Vec<u8>, String> {
        let key = aes_gcm::Key::<Aes256Gcm>::from_slice(MASTER_KEY);
        let cipher = Aes256Gcm::new(key);

        // Generar Nonce aleatorio
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Cifrar
        let ciphertext = cipher
            .encrypt(nonce, data)
            .map_err(|e| format!("[SERA] Error de cifrado: {}", e))?;

        // Construir paquete final
        let mut packet = Vec::with_capacity(MAGIC_HEADER.len() + nonce_bytes.len() + ciphertext.len());
        packet.extend_from_slice(MAGIC_HEADER);
        packet.extend_from_slice(&nonce_bytes);
        packet.extend_from_slice(&ciphertext);

        Ok(packet)
    }

    /// Descifra un paquete verificando la cabecera e integridad.
    pub fn decrypt(packet: &[u8]) -> Result<Vec<u8>, String> {
        if packet.len() < MAGIC_HEADER.len() + 12 {
            return Err("[SERA] Archivo demasiado corto o inválido".to_string());
        }

        // Verificar cabecera
        if &packet[0..MAGIC_HEADER.len()] != MAGIC_HEADER {
            return Err("[SERA] El archivo seleccionado no es un formato válido de SERA (.srx)".to_string());
        }

        // Extraer Nonce y Ciphertext
        let nonce_start = MAGIC_HEADER.len();
        let ciphertext_start = nonce_start + 12;
        let nonce_bytes = &packet[nonce_start..ciphertext_start];
        let ciphertext = &packet[ciphertext_start..];

        let key = aes_gcm::Key::<Aes256Gcm>::from_slice(MASTER_KEY);
        let cipher = Aes256Gcm::new(key);
        let nonce = Nonce::from_slice(nonce_bytes);

        // Descifrar y verificar tag GCM
        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| format!("[SERA] Error de descifrado (posible archivo corrupto o clave incorrectA): {}", e))?;

        Ok(plaintext)
    }
}
