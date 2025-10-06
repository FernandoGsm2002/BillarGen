-- ============================================
-- MIGRACIÓN STOCK_CHANGES - Versión Segura
-- ============================================
-- Esta versión maneja casos donde la tabla puede existir parcialmente

-- Primero verificamos si la tabla existe y la eliminamos si es necesario
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

-- Verificación final
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_changes') THEN
    RAISE NOTICE '✓ Tabla stock_changes creada exitosamente';
  ELSE
    RAISE WARNING '✗ Error: Tabla stock_changes no se pudo crear';
  END IF;
END $$;
