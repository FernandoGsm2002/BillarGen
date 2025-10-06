-- Tabla para registrar todos los cambios en el stock de productos
-- Esto permite llevar un historial completo de aumentos y disminuciones

CREATE TABLE IF NOT EXISTS stock_changes (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id bigint NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  change_type text NOT NULL CHECK (change_type IN ('increase', 'decrease', 'adjustment', 'sale', 'initial')),
  quantity_change integer NOT NULL, -- positivo para aumentos, negativo para disminuciones
  stock_before integer NOT NULL,
  stock_after integer NOT NULL,
  reason text, -- razón del cambio (ej: "Compra de inventario", "Venta", "Ajuste manual", etc.)
  reference_id bigint, -- ID de referencia (sale_id si es por venta, session_id si es inicial, etc.)
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

