-- ============================================
-- MIGRACION COMPLETA V2.0 - BillarGen (VERSIÓN CORREGIDA)
-- ============================================
-- Este archivo consolida todas las migraciones necesarias
-- y maneja casos donde las tablas pueden existir parcialmente
-- 
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. TABLA STOCK_CHANGES
-- ============================================

-- Eliminar tabla si existe (para empezar limpio)
DROP TABLE IF EXISTS stock_changes CASCADE;

-- Crear la tabla desde cero
CREATE TABLE stock_changes (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id bigint NOT NULL,
  product_id bigint NOT NULL,  
  user_id bigint,
  change_type text NOT NULL CHECK (change_type IN ('increase', 'decrease', 'adjustment', 'sale', 'initial')),
  quantity_change integer NOT NULL, -- positivo para aumentos, negativo para disminuciones
  stock_before integer NOT NULL,
  stock_after integer NOT NULL,
  reason text, -- razón del cambio
  reference_id bigint, -- ID de referencia (sale_id, session_id, etc.)
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Agregar foreign keys
ALTER TABLE stock_changes 
ADD CONSTRAINT stock_changes_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE stock_changes 
ADD CONSTRAINT stock_changes_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE stock_changes 
ADD CONSTRAINT stock_changes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

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

-- Manejar tabla existente de forma segura
DROP TABLE IF EXISTS tenant_config CASCADE;

-- Crear la tabla desde cero
CREATE TABLE tenant_config (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id bigint NOT NULL UNIQUE,
  business_name text, -- Nombre de la empresa/negocio
  ruc text, -- RUC (Registro Único de Contribuyentes) - opcional
  logo_url text, -- URL del logo (almacenado en Supabase Storage)
  address text, -- Dirección del negocio
  phone text, -- Teléfono del negocio
  email text, -- Email del negocio
  website text, -- Sitio web del negocio
  description text, -- Descripción del negocio
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Agregar foreign key
ALTER TABLE tenant_config 
ADD CONSTRAINT tenant_config_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Índice para búsqueda rápida por tenant_id
CREATE INDEX IF NOT EXISTS idx_tenant_config_tenant_id ON tenant_config(tenant_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_tenant_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_tenant_config_updated_at ON tenant_config;
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
  RAISE NOTICE 'Migración V2.0 completada exitosamente';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'IMPORTANTE: No olvides crear el bucket "tenant-assets" en Supabase Storage';
  RAISE NOTICE 'y configurarlo como público para poder subir logos.';
  RAISE NOTICE '================================================';
END $$;

-- ============================================
-- 4. CONFIGURACIÓN DE SUPABASE STORAGE
-- ============================================

-- PASO 1: Crear bucket en Supabase Storage
-- 1. Ve a Storage en tu proyecto Supabase
-- 2. Crea un bucket llamado "tenant-assets"
-- 3. Configúralo como público (public)
-- 4. Ejecuta las siguientes políticas de acceso:

/*
-- Política de lectura pública
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tenant-assets', 'tenant-assets', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Políticas de acceso
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'tenant-assets');

CREATE POLICY "Authenticated Upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'tenant-assets');

CREATE POLICY "Authenticated Update" ON storage.objects
FOR UPDATE USING (bucket_id = 'tenant-assets');

CREATE POLICY "Authenticated Delete" ON storage.objects
FOR DELETE USING (bucket_id = 'tenant-assets');
*/

-- ============================================
-- 5. INSTRUCCIONES DE PRUEBA
-- ============================================

-- PASO 1: Reiniciar la aplicación
-- npm run dev

-- PASO 2: Probar las nuevas funcionalidades
-- 1. Ve a Configuración y completa los datos de tu empresa
-- 2. Sube un logo
-- 3. Verifica que aparezca en el Sidebar y Dashboard
-- 4. Crea o edita un producto
-- 5. Ve al reporte de stock y haz click en el ícono de historial

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================
