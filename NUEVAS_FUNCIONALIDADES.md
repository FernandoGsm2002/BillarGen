# Nuevas Funcionalidades - BillarGen

## 📋 Resumen de Cambios

Este documento describe las nuevas funcionalidades implementadas en el sistema BillarGen.

### 1. 📊 Registro de Cambios de Stock

El sistema ahora registra automáticamente **todos los cambios** en el stock de productos, permitiendo un control total del inventario.

#### Características:
- ✅ Registro automático al crear un producto (stock inicial)
- ✅ Registro automático al editar el stock de un producto
- ✅ Registro automático al realizar una venta en el POS
- ✅ Historial completo con fecha, hora, usuario, tipo de cambio y razón
- ✅ Diferenciación por tipos: `increase`, `decrease`, `adjustment`, `sale`, `initial`

#### Base de Datos:
```sql
-- Ejecutar el archivo:
billargen-app/migrations/create_stock_changes.sql
```

**Tabla:** `stock_changes`
- `id`: Identificador único
- `tenant_id`: ID del negocio
- `product_id`: ID del producto
- `user_id`: ID del usuario que realizó el cambio
- `change_type`: Tipo de cambio (increase, decrease, adjustment, sale, initial)
- `quantity_change`: Cantidad del cambio (positivo o negativo)
- `stock_before`: Stock antes del cambio
- `stock_after`: Stock después del cambio
- `reason`: Razón del cambio
- `reference_id`: ID de referencia (opcional, ej: sale_id)
- `created_at`: Fecha y hora del cambio

#### Uso:
1. **Ver historial de un producto:**
   - Ve a Productos → Ver Reporte → Click en el ícono de historial 📜 de cualquier producto
   - Se mostrará el historial completo de cambios de stock

2. **Automatización:**
   - Los cambios se registran automáticamente, no requiere acción manual
   - Cada venta, ajuste o aumento queda registrado

---

### 2. 📈 Modal de Reporte Mejorado

El modal de reporte de productos ahora incluye:

#### Mejoras:
- ✅ **Resumen financiero completo** de la sesión
  - Ingresos por ventas de productos
  - Ingresos por rentas de mesas
  - Ingresos totales
  - Venta promedio por transacción
  - Duración de la sesión

- ✅ **Botón de historial por producto**
  - Ver todos los movimientos de stock de cada producto
  - Tabla detallada con fecha/hora, tipo, cambios, y razón

- ✅ **Resumen de stock**
  - Total de movimientos
  - Total de aumentos
  - Total de disminuciones

#### Uso:
1. Iniciar una sesión en Productos → "Comenzar Día"
2. Durante el día, realizar ventas y ajustes normalmente
3. Click en "Ver Reporte" para ver el estado actual
4. Click en el ícono 📜 (History) de cualquier producto para ver su historial completo

---

### 3. ⚙️ Página de Configuración (Ajustes)

Nueva página para personalizar la información de tu negocio.

#### Características:
- ✅ Subir logo de la empresa (almacenado en Supabase Storage)
- ✅ Configurar nombre de la empresa
- ✅ Agregar RUC (opcional)
- ✅ Dirección, teléfono, email, sitio web (opcionales)
- ✅ Descripción del negocio

#### Base de Datos:
```sql
-- Ejecutar el archivo:
billargen-app/migrations/create_tenant_config.sql
```

**Tabla:** `tenant_config`
- `id`: Identificador único
- `tenant_id`: ID del negocio (único por tenant)
- `business_name`: Nombre de la empresa
- `ruc`: RUC del negocio
- `logo_url`: URL del logo (Supabase Storage)
- `address`: Dirección
- `phone`: Teléfono
- `email`: Email
- `website`: Sitio web
- `description`: Descripción
- `created_at`: Fecha de creación
- `updated_at`: Fecha de actualización

#### Configuración de Supabase Storage:

**IMPORTANTE:** Antes de subir logos, debes crear el bucket en Supabase:

1. Ve a tu proyecto en Supabase → Storage
2. Crea un nuevo bucket llamado: `tenant-assets`
3. Configura el bucket como **público** (public)
4. Configura las políticas de acceso:
   ```sql
   -- Permitir lectura pública
   CREATE POLICY "Public Access"
   ON storage.objects FOR SELECT
   USING (bucket_id = 'tenant-assets');
   
   -- Permitir subida para usuarios autenticados (opcional si usas auth)
   CREATE POLICY "Authenticated Upload"
   ON storage.objects FOR INSERT
   WITH CHECK (bucket_id = 'tenant-assets');
   ```

#### Uso:
1. Como administrador, ve a **Configuración** en el menú lateral
2. Completa la información de tu empresa
3. Sube un logo (arrastra o selecciona archivo, máx 2MB)
4. Haz click en **Guardar**
5. Los cambios se reflejarán automáticamente en:
   - **Sidebar:** Logo, nombre de empresa y RUC
   - **Dashboard:** Header con logo y nombre de empresa

---

## 🔧 Instalación

### Paso 1: Ejecutar Migraciones SQL

```bash
# En Supabase SQL Editor, ejecuta en orden:

1. billargen-app/migrations/create_stock_changes.sql
2. billargen-app/migrations/create_tenant_config.sql
```

### Paso 2: Configurar Supabase Storage

1. Crear bucket `tenant-assets` en Supabase Storage
2. Configurar como público
3. Agregar políticas de acceso (ver arriba)

### Paso 3: Probar las Funcionalidades

1. **Registro de Stock:**
   - Crea un producto nuevo
   - Ve a la página de productos → Ver Reporte → Click en historial del producto
   - Verás el registro inicial del stock

2. **Configuración:**
   - Ve a Configuración
   - Completa los datos de tu empresa
   - Sube un logo
   - Verifica que aparezca en el Sidebar y Dashboard

---

## 📝 Tipos TypeScript Actualizados

Se agregaron nuevas interfaces en `src/types/database.types.ts`:

```typescript
export interface StockChange {
  id: number;
  tenant_id: number;
  product_id: number;
  user_id: number | null;
  change_type: 'increase' | 'decrease' | 'adjustment' | 'sale' | 'initial';
  quantity_change: number;
  stock_before: number;
  stock_after: number;
  reason: string | null;
  reference_id: number | null;
  created_at: string;
}

export interface TenantConfig {
  id: number;
  tenant_id: number;
  business_name: string | null;
  ruc: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}
```

---

## 🎯 Funciones Auxiliares

Se creó un archivo `src/lib/stockUtils.ts` con funciones reutilizables:

- `recordStockChange()`: Registra un cambio de stock
- `updateProductStock()`: Actualiza stock y registra el cambio automáticamente

Estas funciones pueden ser utilizadas en cualquier parte del código para mantener consistencia.

---

## 📸 Capturas de Pantalla

### Modal de Reporte Mejorado:
- Resumen financiero con tarjetas coloridas
- Tabla de stock con columnas: Inicial, Vendido, Actual, Diferencia, Estado
- Botón de historial por producto

### Página de Configuración:
- Formulario completo con todos los campos
- Preview del logo en tiempo real
- Botón para subir archivo con validación

### Sidebar Actualizado:
- Logo personalizado del negocio
- Nombre de la empresa
- RUC (si está configurado)

### Dashboard:
- Header con logo y nombre de empresa (visible en pantallas grandes)

---

## 🐛 Solución de Problemas

### Error al subir logo:
- Verifica que el bucket `tenant-assets` existe en Supabase Storage
- Verifica que el bucket está configurado como público
- Verifica las políticas de acceso

### El historial de stock no muestra datos:
- Verifica que ejecutaste la migración SQL
- Verifica que la tabla `stock_changes` existe
- Los datos solo aparecerán para cambios realizados después de ejecutar la migración

### La configuración no se guarda:
- Verifica que ejecutaste la migración SQL
- Verifica que la tabla `tenant_config` existe
- Revisa la consola del navegador para ver errores

---

## ✅ Checklist de Implementación

- [x] Crear tabla `stock_changes`
- [x] Crear tabla `tenant_config`
- [x] Implementar registro automático de stock en productos
- [x] Implementar registro automático de stock en POS
- [x] Mejorar modal de reporte con historial
- [x] Crear página de configuración
- [x] Actualizar Sidebar con datos de configuración
- [x] Actualizar Dashboard con datos de configuración
- [x] Actualizar tipos TypeScript
- [x] Crear funciones auxiliares para stock
- [x] Documentar todas las funcionalidades

---

## 📞 Soporte

Si tienes problemas o preguntas:
1. Revisa los logs en la consola del navegador
2. Verifica que todas las migraciones SQL se ejecutaron correctamente
3. Verifica la configuración de Supabase Storage

---

**Fecha de Implementación:** Octubre 2025
**Versión:** 2.0.0

