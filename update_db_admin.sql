-- 1. Configuracion del Sistema
CREATE TABLE IF NOT EXISTS configuracion (
    clave VARCHAR(100) PRIMARY KEY,
    valor VARCHAR(255) NOT NULL
);

INSERT IGNORE INTO configuracion (clave, valor) VALUES ('meses_agenda', '3');

-- 2. Nuevos campos en usuarios para los médicos
ALTER TABLE usuarios 
    ADD COLUMN foto_perfil VARCHAR(255) NULL,
    ADD COLUMN biografia TEXT NULL,
    ADD COLUMN direccion VARCHAR(255) NULL,
    ADD COLUMN matricula VARCHAR(100) NULL;

-- 3. Tabla relacional medicos_planes
CREATE TABLE IF NOT EXISTS medicos_planes (
    usuario_id INT NOT NULL,
    plan_id INT NOT NULL,
    PRIMARY KEY (usuario_id, plan_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES planes_obras_sociales(id) ON DELETE CASCADE
);

-- 4. Nuevos campos para atención particular, honorarios y slug del médico
ALTER TABLE usuarios 
    ADD COLUMN acepta_particular TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN honorarios_particular DECIMAL(10,2) NULL DEFAULT NULL,
    ADD COLUMN mostrar_honorarios TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN slug VARCHAR(120) NULL,
    ADD UNIQUE KEY idx_usuario_slug (slug);

-- 5. Campo username para médicos y usuarios
ALTER TABLE usuarios 
    ADD COLUMN username VARCHAR(60) NULL DEFAULT NULL,
    ADD UNIQUE KEY idx_usuario_username (username);


