-- Tabla para almacenar la configuración personalizada de cada tenant (negocio)
-- Permite personalizar logo, nombre de empresa, RUC, etc.

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
COMMENT ON COLUMN tenant_config.logo_url IS 'URL del logo almacenado en Supabase Storage (bucket: tenant-logos)';
COMMENT ON COLUMN tenant_config.ruc IS 'Registro Único de Contribuyentes - opcional';

