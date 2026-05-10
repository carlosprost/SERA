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

// 4. Actualizar about-dialog.ts (Cartel de "Acerca de")
const aboutPath = path.join(__dirname, '..', 'src', 'app', 'components', 'about-dialog', 'about-dialog.ts');
if (fs.existsSync(aboutPath)) {
  let aboutContent = fs.readFileSync(aboutPath, 'utf8');
  // Reemplaza "Versión X.X.X" manteniendo el codename si existe
  aboutContent = aboutContent.replace(/Versión\s+[\d\.]+/g, `Versión ${newVersion}`);
  fs.writeFileSync(aboutPath, aboutContent);
  console.log(`  ✅ about-dialog.ts actualizado.`);
}

// 5. Añadir los archivos modificados a git para que se incluyan en el commit del release
try {
  execSync(`git add src-tauri/tauri.conf.json src-tauri/Cargo.toml src/app/components/about-dialog/about-dialog.ts`, { stdio: 'inherit' });
  console.log(`  ✅ Archivos agregados a git.\n`);
} catch (e) {
  console.error(`  ❌ Error agregando archivos a git:`, e.message);
  process.exit(1);
}
