const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Leer la nueva versión desde package.json (que npm version ya actualizó)
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = require(pkgPath);
const newVersion = pkg.version;

console.log(`\n🚀 Sincronizando versión ${newVersion} en todo el proyecto...`);

// 2. Actualizar tauri.conf.json
const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
let tauriConf = fs.readFileSync(tauriConfPath, 'utf8');
tauriConf = tauriConf.replace(/"version":\s*"[^"]+"/, `"version": "${newVersion}"`);
fs.writeFileSync(tauriConfPath, tauriConf);
console.log(`  ✅ tauri.conf.json actualizado.`);

// 3. Actualizar Cargo.toml
const cargoTomlPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');
let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
cargoToml = cargoToml.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVersion}"`);
fs.writeFileSync(cargoTomlPath, cargoToml);
console.log(`  ✅ Cargo.toml actualizado.`);

// 4. Actualizar app-version.config.ts (Configuración central de Angular)
const appVersionConfigPath = path.join(__dirname, '..', 'src', 'app', 'config', 'app-version.config.ts');
if (fs.existsSync(appVersionConfigPath)) {
  let appVersionConfig = fs.readFileSync(appVersionConfigPath, 'utf8');
  // Actualizar APP_VERSION
  appVersionConfig = appVersionConfig.replace(/export const APP_VERSION = '[^']+';/, `export const APP_VERSION = '${newVersion}';`);
  
  // Calcular nuevo patch code manteniendo la constelación actual (ej: Phoenix-421)
  const versionDigits = newVersion.replace(/\./g, '');
  appVersionConfig = appVersionConfig.replace(/export const APP_PATCH_CODE = '([A-Za-z]+)-\d+';/, `export const APP_PATCH_CODE = '$1-${versionDigits}';`);
  
  fs.writeFileSync(appVersionConfigPath, appVersionConfig);
  console.log(`  ✅ app-version.config.ts actualizado.`);
}

// 5. Añadir los archivos modificados a git para que se incluyan en el commit del release
try {
  execSync(`git add src-tauri/tauri.conf.json src-tauri/Cargo.toml src/app/config/app-version.config.ts`, { stdio: 'inherit' });
  console.log(`  ✅ Archivos agregados a git.\n`);
} catch (e) {
  console.error(`  ❌ Error agregando archivos a git:`, e.message);
  process.exit(1);
}
