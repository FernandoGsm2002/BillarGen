# Comandos Git para Subir a GitHub

## 1. Inicializar repositorio (si no existe)
```bash
git init
```

## 2. Agregar el remote de GitHub
```bash
git remote add origin https://github.com/FernandoGsm2002/BillarGen.git
```

## 3. Verificar que .env.local NO se subirá
```bash
git check-ignore .env.local
# Debe mostrar: .env.local
```

## 4. Agregar todos los archivos
```bash
git add .
```

## 5. Verificar qué archivos se van a subir
```bash
git status
# Asegúrate que NO aparezca .env.local
```

## 6. Hacer commit
```bash
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
```

## 7. Subir a GitHub
```bash
git push -u origin main
```

### Si el repositorio ya existe y necesitas forzar:
```bash
git pull origin main --rebase
git push -u origin main
```

### Si hay conflictos o necesitas forzar (CUIDADO):
```bash
git push -u origin main --force
```

## Notas Importantes:
- ✅ `.env.local` está en `.gitignore` y NO se subirá
- ✅ `node_modules` está en `.gitignore` y NO se subirá
- ✅ `.next` está en `.gitignore` y NO se subirá
