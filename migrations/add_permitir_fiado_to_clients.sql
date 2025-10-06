-- ============================================
-- MIGRACIÓN: Agregar campo permitir_fiado a clients
-- ============================================
-- Permite al admin configurar si un cliente puede tener crédito

-- Agregar la columna permitir_fiado
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS permitir_fiado boolean DEFAULT true NOT NULL;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_clients_permitir_fiado ON clients(tenant_id, permitir_fiado);

-- Comentario para documentación
COMMENT ON COLUMN clients.permitir_fiado IS 'Indica si el cliente puede realizar compras fiadas (a crédito)';

-- Verificación
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'clients' 
    AND column_name = 'permitir_fiado'
  ) THEN
    RAISE NOTICE '✓ Columna permitir_fiado agregada exitosamente a la tabla clients';
  ELSE
    RAISE WARNING '✗ Error: No se pudo agregar la columna permitir_fiado';
  END IF;
END $$;
