# Instrucciones de Migración - Separación de Datos por Trabajador

## Problema Resuelto
Los trabajadores estaban viendo los ingresos combinados de todos los empleados en lugar de solo sus propios movimientos.

## Cambios Realizados

### 1. Código Actualizado
- ✅ **Dashboard Worker**: Ahora filtra ventas por `worker_id` y rentas por `user_id`
- ✅ **Página de Mesas**: Solo muestra rentas activas del trabajador actual
- ✅ **Creación de Rentas**: Ahora guarda el `user_id` del trabajador que crea la renta
- ✅ **Tipos TypeScript**: Agregado campo `user_id` a la interfaz `Rental`

### 2. Migración de Base de Datos Requerida

**IMPORTANTE**: Debes ejecutar el siguiente SQL en tu base de datos para que los cambios funcionen correctamente:

```sql
-- Agregar la columna user_id a la tabla rentals
ALTER TABLE rentals 
ADD COLUMN user_id INTEGER REFERENCES users(id);

-- Crear índice para mejorar el rendimiento
CREATE INDEX idx_rentals_user_id ON rentals(user_id);

-- Comentario sobre la columna
COMMENT ON COLUMN rentals.user_id IS 'ID del usuario/trabajador que creó la renta';
```

### 3. Cómo Aplicar la Migración

1. **Conectarse a la base de datos** (Supabase, PostgreSQL, etc.)
2. **Ejecutar el SQL** del archivo `migration_add_user_id_to_rentals.sql`
3. **Verificar** que la columna se agregó correctamente:
   ```sql
   SELECT column_name, data_type, is_nullable 
   FROM information_schema.columns 
   WHERE table_name = 'rentals' AND column_name = 'user_id';
   ```

### 4. Comportamiento Después de la Migración

#### Para Trabajadores (Workers):
- **Dashboard**: Solo muestra sus propias ventas e ingresos del día
- **Mesas**: Solo ve las rentas que él/ella creó
- **Nuevas Rentas**: Se guardan con su `user_id`

#### Para Administradores:
- **Sin cambios**: Siguen viendo todos los datos de la empresa
- **Estadísticas**: Mantienen acceso completo a todos los movimientos

### 5. Datos Existentes

Las rentas creadas antes de la migración tendrán `user_id = NULL`. Estas rentas:
- No aparecerán en los dashboards de trabajadores
- Seguirán siendo visibles para administradores
- Pueden ser asignadas manualmente si es necesario

### 6. Verificación Post-Migración

Para verificar que todo funciona correctamente:

1. **Crear una nueva renta** como trabajador
2. **Verificar en el dashboard** que solo aparecen sus datos
3. **Probar con otro trabajador** para confirmar la separación
4. **Verificar como admin** que sigue viendo todos los datos

## Archivos Modificados

- `src/app/worker/dashboard/page.tsx`
- `src/app/worker/tables/page.tsx`
- `src/types/database.types.ts`
- `migration_add_user_id_to_rentals.sql` (nuevo)

## Notas Técnicas

- Las **ventas** ya tenían el campo `worker_id`, por lo que no necesitan migración
- Las **rentas** necesitaban el campo `user_id` para filtrar por trabajador
- El filtrado es **automático** y **transparente** para los usuarios
- La **compatibilidad hacia atrás** se mantiene para administradores
