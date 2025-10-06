-- ============================================
-- MIGRACION COMPLETA V2.0 - BillarGen
-- ============================================
-- Este archivo consolida todas las migraciones necesarias
-- para las nuevas funcionalidades implementadas
-- 
-- Ejecutar en orden en Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. TABLA STOCK_CHANGES
-- ============================================
-- Registra todos los cambios en el stock de productos

CREATE TABLE IF NOT EXISTS stock_changes (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id bigint NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  change_type text NOT NULL CHECK (change_type IN ('increase', 'decrease', 'adjustment', 'sale', 'initial')),
  quantity_change integer NOT NULL, -- positivo para aumentos, negativo para disminuciones
  stock_before integer NOT NULL,
  stock_after integer NOT NULL,
  reason text, -- razón del cambio
  reference_id bigint, -- ID de referencia (sale_id, session_id, etc.)
  created_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT stock_changes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT stock_changes_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT stock_changes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_stock_changes_tenant_product ON stock_changes(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_changes_created_at ON stock_changes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_changes_type ON stock_changes(change_type);

-- Comentarios para documentación
COMMENT ON TABLE stock_changes IS 'Historial completo de todos los cambios en el stock de productos';
COMMENT ON COLUMN stock_changes.change_type IS 'Tipo de cambio: increase (compra), decrease (ajuste), adjustment (manual), sale (venta), initial (stock inicial de sesión)';
COMMENT ON COLUMN stock_changes.quantity_change IS 'Cantidad del cambio (positivo = aumento, negativo = disminución)';
COMMENT ON COLUMN stock_changes.reference_id IS 'ID de referencia opcional (sale_id, session_id, etc.)';

-- ============================================
-- 2. TABLA TENANT_CONFIG
-- ============================================
-- Almacena la configuración personalizada de cada negocio

CREATE TABLE IF NOT EXISTS tenant_config (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id bigint NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  business_name text, -- Nombre de la empresa/negocio
  ruc text, -- RUC (Registro Único de Contribuyentes) - opcional
  logo_url text, -- URL del logo (almacenado en Supabase Storage)
  address text, -- Dirección del negocio
  phone text, -- Teléfono del negocio
  email text, -- Email del negocio
  website text, -- Sitio web del negocio
  description text, -- Descripción del negocio
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT tenant_config_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Índice para búsqueda rápida por tenant_id
CREATE INDEX IF NOT EXISTS idx_tenant_config_tenant_id ON tenant_config(tenant_id);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_tenant_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tenant_config_updated_at
  BEFORE UPDATE ON tenant_config
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_config_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE tenant_config IS 'Configuración personalizada de cada negocio (logo, nombre, RUC, etc.)';
COMMENT ON COLUMN tenant_config.logo_url IS 'URL del logo almacenado en Supabase Storage (bucket: tenant-assets)';
COMMENT ON COLUMN tenant_config.ruc IS 'Registro Único de Contribuyentes - opcional';

-- ============================================
-- 3. VERIFICACIÓN
-- ============================================

-- Verificar que las tablas se crearon correctamente
DO $$
BEGIN
  -- Verificar stock_changes
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_changes') THEN
    RAISE NOTICE '✓ Tabla stock_changes creada exitosamente';
  ELSE
    RAISE WARNING '✗ Error: Tabla stock_changes no existe';
  END IF;

  -- Verificar tenant_config
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tenant_config') THEN
    RAISE NOTICE '✓ Tabla tenant_config creada exitosamente';
  ELSE
    RAISE WARNING '✗ Error: Tabla tenant_config no existe';
  END IF;

  RAISE NOTICE '================================================';
  RAISE NOTICE 'Migración V2.0 completada';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'IMPORTANTE: No olvides crear el bucket "tenant-assets" en Supabase Storage';
  RAISE NOTICE 'y configurarlo como público para poder subir logos.';
  RAISE NOTICE '================================================';
END $$;

-- ============================================
-- 4. INSTRUCCIONES POST-MIGRACIÓN
-- ============================================

-- PASO 1: Crear bucket en Supabase Storage
-- 1. Ve a Storage en tu proyecto Supabase
-- 2. Crea un bucket llamado "tenant-assets"
-- 3. Configúralo como público (public)
-- 4. Ejecuta las siguientes políticas de acceso:

/*
-- Política de lectura pública
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-assets');

-- Política de subida para usuarios autenticados
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tenant-assets');

-- Política de actualización para usuarios autenticados
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tenant-assets');

-- Política de eliminación para usuarios autenticados
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'tenant-assets');
*/

-- PASO 2: Reiniciar la aplicación
-- npm run dev

-- PASO 3: Probar las nuevas funcionalidades
-- 1. Ve a Configuración y completa los datos de tu empresa
-- 2. Sube un logo
-- 3. Verifica que aparezca en el Sidebar y Dashboard
-- 4. Crea o edita un producto
-- 5. Ve al reporte de stock y haz click en el ícono de historial

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================

