#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Script de inicialización de los repositorios del ecosistema de plugins de SERA.
    Ejecutá este script UNA sola vez para crear los repos en GitHub y hacer el push inicial.

.REQUISITOS
    - Git instalado y configurado
    - GitHub CLI (gh) instalado: https://cli.github.com/
    - Estar autenticado: gh auth login
#>

$ErrorActionPreference = "Stop"

$GITHUB_USER = "carlosprost"   # ← Cambiá esto si tu usuario de GitHub es otro
$BASE_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  SERA Plugins Ecosystem — Setup Inicial" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ─────────────────────────────────────────────
# PASO 1: Publicar el Marketplace (catálogo)
# ─────────────────────────────────────────────
Write-Host "📦 Paso 1: Creando repositorio del Marketplace..." -ForegroundColor Yellow

$marketplaceDir = Join-Path $BASE_DIR "sera-plugins-marketplace"
Push-Location $marketplaceDir

git init
git add .
git commit -m "feat: catálogo inicial del Marketplace de SERA"

gh repo create "$GITHUB_USER/sera-plugins-marketplace" `
    --public `
    --description "Catálogo central descentralizado de plugins para SERA" `
    --source . `
    --remote origin `
    --push

Write-Host "✅ Marketplace publicado en: https://github.com/$GITHUB_USER/sera-plugins-marketplace" -ForegroundColor Green
Pop-Location

Write-Host ""

# ─────────────────────────────────────────────
# PASO 2: Publicar el Plugin de Demo
# ─────────────────────────────────────────────
Write-Host "🧩 Paso 2: Creando repositorio del Plugin Hello SERA..." -ForegroundColor Yellow

$pluginDir = Join-Path $BASE_DIR "sera-plugin-hello-world"
Push-Location $pluginDir

git init
git add .
git commit -m "feat: plugin de demostración oficial Hello SERA v1.0.0"

gh repo create "$GITHUB_USER/sera-plugin-hello-world" `
    --public `
    --description "Plugin de demostración oficial de SERA — Template para desarrolladores" `
    --source . `
    --remote origin `
    --push

# Crear el release/tag v1.0.0 para que jsDelivr pueda servirlo como CDN
git tag v1.0.0
git push origin v1.0.0
gh release create v1.0.0 --title "v1.0.0 — Lanzamiento Inicial" --notes "Primera versión del plugin de demostración oficial de SERA."

Write-Host "✅ Plugin publicado en: https://github.com/$GITHUB_USER/sera-plugin-hello-world" -ForegroundColor Green
Write-Host ""
Pop-Location

# ─────────────────────────────────────────────
# RESUMEN FINAL
# ─────────────────────────────────────────────
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  ¡Ecosistema de Plugins listo! 🚀" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 URLs del CDN (jsDelivr) del plugin Hello SERA:" -ForegroundColor White
Write-Host "   JS:  https://cdn.jsdelivr.net/gh/$GITHUB_USER/sera-plugin-hello-world@1.0.0/dist/index.js"
Write-Host "   CSS: https://cdn.jsdelivr.net/gh/$GITHUB_USER/sera-plugin-hello-world@1.0.0/dist/style.css"
Write-Host ""
Write-Host "📋 Próximo paso: Abrí SERA → Ajustes → Plugins → Marketplace" -ForegroundColor Green
Write-Host "   y vas a ver el plugin 'Hello SERA' listo para instalar." -ForegroundColor Green
