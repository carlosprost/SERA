/**
 * @file rename-installers.js
 * @description Script post-build que renombra los instaladores generados por Tauri
 * al formato limpio: SERA_{version}.exe y SERA_{version}.msi.
 * 
 * Uso: node scripts/rename-installers.js
 * O desde npm: npm run rename-installers
 */

const fs = require('fs');
const path = require('path');

// ─── Configuración ──────────────────────────────────────────────────────────

const pkg         = require('../package.json');
const VERSION     = pkg.version;
const PRODUCT     = 'SERA';
const BUNDLE_DIR  = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle');

/**
 * @typedef {Object} InstallerTarget
 * @property {string} srcDir   - Carpeta donde Tauri deja el archivo original
 * @property {string} pattern  - Regex para identificar el archivo generado
 * @property {string} destName - Nombre final deseado
 */

/** @type {InstallerTarget[]} */
const TARGETS = [
  {
    srcDir:   path.join(BUNDLE_DIR, 'nsis'),
    pattern:  /^SERA_[\d.]+_x64-setup\.exe$/,
    destName: `${PRODUCT}_${VERSION}.exe`,
  },
  {
    srcDir:   path.join(BUNDLE_DIR, 'msi'),
    pattern:  /^SERA_[\d.]+_x64_en-US\.msi$/,
    destName: `${PRODUCT}_${VERSION}.msi`,
  },
];

// ─── Ejecución ───────────────────────────────────────────────────────────────

console.log(`\n🚀 Renombrando instaladores de SERA v${VERSION}...\n`);

let exitos = 0;

for (const target of TARGETS) {
  // Verificar que la carpeta de bundle existe
  if (!fs.existsSync(target.srcDir)) {
    console.warn(`  ⚠️  Carpeta no encontrada: ${target.srcDir}`);
    console.warn(`     ¿Ejecutaste "npm run tauri build" antes?\n`);
    continue;
  }

  // Buscar el archivo que matchea el patrón
  const archivos = fs.readdirSync(target.srcDir);
  const original = archivos.find(f => target.pattern.test(f));

  if (!original) {
    console.warn(`  ⚠️  No se encontró ningún instalador con el patrón ${target.pattern} en:`);
    console.warn(`     ${target.srcDir}\n`);
    continue;
  }

  const srcPath  = path.join(target.srcDir, original);
  const destPath = path.join(target.srcDir, target.destName);

  fs.renameSync(srcPath, destPath);
  console.log(`  ✅  ${original}`);
  console.log(`      → ${target.destName}\n`);
  exitos++;
}

if (exitos === TARGETS.length) {
  console.log(`✔  Listo. Los instaladores renombrados están en:`);
  console.log(`   ${path.join(BUNDLE_DIR, 'nsis')}`);
  console.log(`   ${path.join(BUNDLE_DIR, 'msi')}\n`);
} else {
  console.error(`\n❌  Algunos instaladores no pudieron renombrarse. Revisá los avisos arriba.\n`);
  process.exit(1);
}
