-- Script for PostgreSQL

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol VARCHAR(20) CHECK (rol IN ('supervisor', 'ejecutivo', 'tecnico')) NOT NULL,
  activo BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ordenes (
  id SERIAL PRIMARY KEY,
  orden_servicio VARCHAR(50) UNIQUE NOT NULL,
  modelo VARCHAR(10) CHECK (modelo IN ('TM5', 'TM6', 'TM7')) NOT NULL,
  comentarios TEXT,
  prioridad BOOLEAN DEFAULT false,
  estado VARCHAR(30) CHECK (estado IN ('CREADA', 'EN_DIAGNOSTICO', 'DIAGNOSTICO_TERMINADO', 'ESPERANDO_PAGO', 'PAGADO', 'EN_REPARACION', 'REPARACION_TERMINADA', 'FINALIZADA')) NOT NULL,
  tipo_proceso VARCHAR(20) CHECK (tipo_proceso IN ('diagnostico', 'reparacion')) NOT NULL,
  ejecutivo_id INT NULL REFERENCES usuarios(id),
  tecnico_diagnostico_id INT NULL REFERENCES usuarios(id),
  tecnico_reparacion_id INT NULL REFERENCES usuarios(id),
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  fecha_inicio TIMESTAMP NULL,
  fecha_fin TIMESTAMP NULL,
  fecha_pago TIMESTAMP NULL,
  tiempo_pausado_segundos INT DEFAULT 0,
  pausa_inicio TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS configuracion (
  id INT PRIMARY KEY DEFAULT 1,
  modo_asignacion VARCHAR(30) CHECK (modo_asignacion IN ('AUTO_POR_TAREA', 'MISMO_TECNICO')) NOT NULL DEFAULT 'AUTO_POR_TAREA'
);

CREATE TABLE IF NOT EXISTS historial_ordenes (
  id SERIAL PRIMARY KEY,
  orden_id INT NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  estado_anterior VARCHAR(30) NULL,
  estado_nuevo VARCHAR(30) NOT NULL,
  usuario_id INT NULL REFERENCES usuarios(id),
  fecha TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mensaje TEXT NOT NULL,
  leida BOOLEAN DEFAULT false,
  fecha TIMESTAMP DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS reglas (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  tecnico_id INT NOT NULL REFERENCES usuarios(id),
  modelo VARCHAR(10) CHECK (modelo IN ('TM5', 'TM6', 'TM7')) NOT NULL,
  tipo_proceso VARCHAR(20) CHECK (tipo_proceso IN ('diagnostico', 'reparacion')) NOT NULL,
  activo BOOLEAN DEFAULT true,
  UNIQUE(fecha, tecnico_id)
);

-- Insert a default supervisor (password is 'admin123' hashed with bcrypt, cost 10)
-- BCRYPT hash for 'admin123': $2b$10$AuqXFDBgn2QDcIFnSxou1OnRPWxHH8QuxPUFC1R0/IQQOg1S.OXbS
INSERT INTO usuarios (nombre, email, password, rol) 
VALUES ('Super Admin', 'admin@thermomix.com', '$2b$10$AuqXFDBgn2QDcIFnSxou1OnRPWxHH8QuxPUFC1R0/IQQOg1S.OXbS', 'supervisor')
ON CONFLICT (email) DO NOTHING;

-- Insert the required configuration record.
-- Without this row the application crashes when assigning orders because
-- configResult.rows[0] is undefined. Run `node backend/init_config.js` to
-- insert this record on an existing database where it may have been deleted.
INSERT INTO configuracion (id, modo_asignacion) VALUES (1, 'AUTO_POR_TAREA')
ON CONFLICT (id) DO NOTHING;
