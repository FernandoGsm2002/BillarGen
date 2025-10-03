# Configuración del Proyecto BillarGen

## 1. Configurar Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
```

### ¿Dónde obtener estas credenciales?

1. Ve a [Supabase](https://supabase.com) e inicia sesión
2. Selecciona tu proyecto o crea uno nuevo
3. Ve a **Settings** → **API**
4. Copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Configurar la Base de Datos en Supabase

1. En tu proyecto de Supabase, ve a **SQL Editor**
2. Copia y ejecuta el contenido del archivo `main.sql` que está en la raíz del proyecto
3. Esto creará todas las tablas necesarias: `tenants`, `users`, `clients`, `tables`, `rentals`, `products`, `sales`

## 3. Crear el Primer Super Admin

Después de ejecutar las migraciones SQL, necesitas crear tu primer usuario super admin manualmente:

```sql
-- Ejecuta esto en el SQL Editor de Supabase
INSERT INTO users (username, password, role, tenant_id)
VALUES ('superadmin', 'tu_contraseña_segura', 'super_admin', NULL);
```

**IMPORTANTE**: En producción, las contraseñas deben estar hasheadas. Este es solo un ejemplo para desarrollo.

## 4. Instalar Dependencias

```bash
npm install
```

## 5. Ejecutar el Proyecto

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

## Estructura del Sistema

### Roles de Usuario

1. **Super Admin**: 
   - Crea y gestiona cuentas de administradores
   - Cada admin tiene su propio tenant (negocio)

2. **Admin**: 
   - Gestiona su propio negocio de billar
   - Crea empleados (workers)
   - Configura mesas, productos y precios
   - Ve reportes de su negocio

3. **Worker (Empleado)**:
   - Gestiona las rentas de mesas
   - Registra clientes
   - Procesa ventas de productos

### Multitenant

El sistema es completamente multitenant:
- Cada administrador tiene su propio `tenant_id`
- Los datos están completamente aislados entre tenants
- Los empleados solo ven datos de su tenant
- Supabase Row Level Security (RLS) debe configurarse para mayor seguridad

## ✅ Funcionalidades Implementadas

- ✅ Sistema multitenant completo
- ✅ Gestión de usuarios (super_admin, admin, worker)
- ✅ Gestión de mesas de billar
- ✅ Sistema de rentas con cálculo automático
- ✅ **Gestión de productos y precios**
- ✅ **Sistema de ventas completo con carrito de compras**
- ✅ **Configuración de tarifa por hora**
- ✅ Dashboard con estadísticas en tiempo real
- ✅ Registro de clientes

## 🎯 Cómo Usar las Nuevas Funcionalidades

### Gestión de Productos (Admin)
1. Inicia sesión como administrador
2. En la sección "Productos", click en "+ Agregar Producto"
3. Ingresa nombre y precio (Ej: Cerveza - $30.00)
4. Los productos estarán disponibles para venta inmediatamente

### Sistema de Ventas (Worker)
1. Inicia sesión como empleado
2. En "Rentas Activas", click en "Vender" para una mesa ocupada
3. Selecciona productos del catálogo
4. Ajusta cantidades con los botones +/-
5. Revisa el total y click en "Registrar Venta"
6. La venta queda registrada para el cliente de esa mesa

### Configuración de Tarifa
1. Como administrador, ve a la sección "Configuración"
2. Ajusta la "Tarifa por Hora" según tu negocio
3. Esta tarifa se usa automáticamente al finalizar rentas

## Próximos Pasos Recomendados

1. **Implementar Row Level Security (RLS)** en Supabase para asegurar el aislamiento de datos
2. **Hashear contraseñas** usando bcrypt o similar
3. **Implementar autenticación con Supabase Auth** en lugar de autenticación manual
4. **Agregar reportes y estadísticas** con gráficas
5. **Implementar sistema de pagos** (marcar rentas/ventas como pagadas)
6. **Agregar notificaciones** en tiempo real
7. **Exportar reportes** en PDF o Excel

## Tecnologías Utilizadas

- **Next.js 15** - Framework de React
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos
- **Supabase** - Base de datos PostgreSQL y backend
- **Vercel** - Despliegue (recomendado)
