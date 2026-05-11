use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::{rngs::OsRng, RngCore};
use sha2::{Digest, Sha256};

/// Cabecera mágica para identificar archivos de SERA.
pub const MAGIC_HEADER: &[u8; 12] = b"SERA_V1_PACK";

/// Llave maestra interna para el cifrado de exportaciones (fallback).
const MASTER_KEY: &[u8; 32] = b"SERA_INTERNAL_SECURITY_KEY_2024_"; 

pub struct CryptoProvider;

impl CryptoProvider {
    /// Deriva una llave de 32 bytes a partir de una contraseña opcional.
    /// Si no hay contraseña, usa la MASTER_KEY interna.
    fn derive_key(password: Option<String>) -> [u8; 32] {
        let pw = password.unwrap_or_default();
        if pw.is_empty() {
            *MASTER_KEY
        } else {
            let mut hasher = Sha256::new();
            hasher.update(pw.as_bytes());
            let result = hasher.finalize();
            let mut key = [0u8; 32];
            key.copy_from_slice(&result);
            key
        }
    }

    /// Cifra un contenido y devuelve el paquete completo: Header + Nonce + Ciphertext.
    pub fn encrypt(data: &[u8], password: Option<String>) -> Result<Vec<u8>, String> {
        let key_bytes = Self::derive_key(password);
        let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
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
    pub fn decrypt(packet: &[u8], password: Option<String>) -> Result<Vec<u8>, String> {
        // INSPECCIÓN BINARIA PARA DEPURACIÓN
        if packet.len() >= 32 {
            println!("[SERA] Inspección de cabecera (primeros 32 bytes):");
            println!("Hex: {:02X?}", &packet[0..32]);
            if let Ok(s) = std::str::from_utf8(&packet[0..12]) {
                println!("ASCII (0-12): {}", s);
            }
        }
        
        // Detectar offset de cabecera dinámicamente
        let (nonce_start, _header_name) = if packet.len() >= 12 && (&packet[0..12] == b"SERA_V1_PACK" || &packet[0..12] == b"SERA-V1-PACK") {
            (12, "V1_PACK")
        } else if packet.len() >= 8 && &packet[0..8] == b"SERA_SRX" {
            (8, "SRX_LEGACY")
        } else if packet.len() >= 12 && &packet[0..12] == b"SERA_V1_SRX_" {
            (12, "V1_SRX")
        } else {
            (12, "UNKNOWN_FALLBACK")
        };

        if packet.len() < nonce_start + 12 {
            return Err("[SERA] Archivo demasiado corto o inválido".to_string());
        }

        let ciphertext_start = nonce_start + 12;
        let nonce_bytes = &packet[nonce_start..ciphertext_start];
        let ciphertext = &packet[ciphertext_start..];
        let nonce = Nonce::from_slice(nonce_bytes);

        // Si hay contraseña del usuario, intentamos solo con esa
        let pw = password.unwrap_or_default();
        if !pw.is_empty() {
            let key_bytes = Self::derive_key(Some(pw));
            let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
            let cipher = Aes256Gcm::new(key);
            return cipher.decrypt(nonce, ciphertext)
                .map_err(|_| "[SERA] Contraseña incorrecta o archivo corrupto".to_string());
        }

        // Si NO hay contraseña, probamos las variantes de la MASTER_KEY
        let variantes = [
            b"SERA_INTERNAL_SECURITY_KEY_2024_",
            b"SERA_INTERNAL_SECURITY_KEY_2024 ",
            b"SERA_INTERNAL_SECURITY_KEY_2024.",
            b"SERA_INTERNAL_SECURITY_KEY_2024\0",
            b"WOLFTEI_INTERNAL_SECURITY_KEY_24",
        ];

        for var_key in variantes {
            let key = aes_gcm::Key::<Aes256Gcm>::from_slice(var_key);
            let cipher = Aes256Gcm::new(key);
            if let Ok(plaintext) = cipher.decrypt(nonce, ciphertext) {
                println!("[SERA] Descifrado exitoso con variante de llave maestra.");
                return Ok(plaintext);
            }
        }

        Err("[SERA] Error de descifrado. Ninguna de las llaves maestras conocidas funcionó. El archivo podría estar protegido por una contraseña personalizada o estar corrupto.".to_string())
    }
}
