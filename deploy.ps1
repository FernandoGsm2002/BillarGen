# Script de Deploy para BillarGen
# Ejecuta este script desde PowerShell en la carpeta billargen-app

Write-Host "🚀 Iniciando proceso de deploy..." -ForegroundColor Cyan
Write-Host ""

# Verificar que .env.local NO se suba
Write-Host "✓ Verificando .gitignore..." -ForegroundColor Yellow
$envIgnored = git check-ignore .env.local 2>$null
if ($envIgnored) {
    Write-Host "  ✅ .env.local está correctamente ignorado" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  ADVERTENCIA: .env.local podría no estar ignorado" -ForegroundColor Red
    Write-Host "  Verifica tu .gitignore antes de continuar" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✓ Agregando archivos..." -ForegroundColor Yellow
git add .

Write-Host ""
Write-Host "✓ Verificando archivos a subir..." -ForegroundColor Yellow
Write-Host ""
git status --short

Write-Host ""
$confirm = Read-Host "¿Continuar con el commit? (s/n)"
if ($confirm -ne 's' -and $confirm -ne 'S') {
    Write-Host "❌ Cancelado por el usuario" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "✓ Creando commit..." -ForegroundColor Yellow
git commit -m "feat: Migración completa a shadcn/ui para Admin y Worker

- Migrado Admin > Ventas, Clientes, Estadísticas a shadcn
- Migrado Worker > Clientes con modal de detalles
- Agregado buscador con debounce en Admin > Clientes
- Mejorado Login con diseño consistente usando shadcn/ui
- Agregada columna Mesa en tabla de ventas
- Agregado estado Pagado/Fiado en ventas
- Modal detallado de finalización de renta con consumo
- Modal de historial de ventas por cliente
- Mejorada responsividad en todas las vistas
- Aumentado tamaño de cards en Worker > Mesas
- Tablas ahora ocupan todo el ancho disponible"

Write-Host ""
Write-Host "✓ Subiendo a GitHub..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deploy completado exitosamente!" -ForegroundColor Green
    Write-Host "🌐 Revisa tu repositorio en: https://github.com/FernandoGsm2002/BillarGen" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "⚠️  Hubo un problema con el push" -ForegroundColor Yellow
    Write-Host "Intenta: git pull origin main --rebase" -ForegroundColor Yellow
    Write-Host "Luego: git push -u origin main" -ForegroundColor Yellow
}
