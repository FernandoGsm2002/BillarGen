-- Migración para agregar user_id a la tabla rentals
-- Esto permitirá filtrar las rentas por el trabajador que las creó

-- Agregar la columna user_id a la tabla rentals
ALTER TABLE rentals 
ADD COLUMN user_id INTEGER REFERENCES users(id);

-- Crear índice para mejorar el rendimiento de las consultas
CREATE INDEX idx_rentals_user_id ON rentals(user_id);

-- Comentario sobre la columna
COMMENT ON COLUMN rentals.user_id IS 'ID del usuario/trabajador que creó la renta';
