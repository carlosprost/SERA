#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Script MANUAL para publicar el ecosistema de plugins de SERA en GitHub.
    No requiere GitHub CLI. Usá este si no tenés 'gh' instalado.

.INSTRUCCIONES PREVIAS
    1. Creá los dos repos en github.com/new:
       - carlosprost/sera-plugins-marketplace (público)
       - carlosprost/sera-plugin-hello-world (público)
    2. Luego ejecutá este script.
#>

$ErrorActionPreference = "Stop"

# ⚠️ AJUSTÁ ESTOS VALORES ANTES DE CORRER EL SCRIPT
$GITHUB_USER = "carlosprost"   # Tu usuario de GitHub
$BASE_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  SERA Plugins — Setup Manual con Git" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ─── MARKETPLACE ───
Write-Host "📦 Inicializando Marketplace..." -ForegroundColor Yellow
Push-Location (Join-Path $BASE_DIR "sera-plugins-marketplace")

git init -b main
git add .
git commit -m "feat: catálogo inicial del Marketplace de SERA"
git remote add origin "https://github.com/$GITHUB_USER/sera-plugins-marketplace.git"
git push -u origin main

Write-Host "✅ Marketplace publicado!" -ForegroundColor Green
Pop-Location

Write-Host ""

# ─── PLUGIN DE DEMO ───
Write-Host "🧩 Inicializando Plugin Hello SERA..." -ForegroundColor Yellow
Push-Location (Join-Path $BASE_DIR "sera-plugin-hello-world")

git init -b main
git add .
git commit -m "feat: plugin demo Hello SERA v1.0.0"
git remote add origin "https://github.com/$GITHUB_USER/sera-plugin-hello-world.git"
git push -u origin main

# Tag v1.0.0 para el CDN de jsDelivr
git tag v1.0.0
git push origin v1.0.0

Write-Host "✅ Plugin publicado con tag v1.0.0!" -ForegroundColor Green
Pop-Location

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  ¡Todo listo! URLs del CDN:" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  JS : https://cdn.jsdelivr.net/gh/$GITHUB_USER/sera-plugin-hello-world@1.0.0/dist/index.js"
Write-Host "  CSS: https://cdn.jsdelivr.net/gh/$GITHUB_USER/sera-plugin-hello-world@1.0.0/dist/style.css"
Write-Host ""
Write-Host "  Ahora abrí SERA → Ajustes → Plugins → Marketplace" -ForegroundColor Cyan
