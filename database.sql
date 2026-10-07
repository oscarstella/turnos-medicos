-- Esquema completo para una instalación nueva.
-- Ajustar DB_NAME en backend/config/database.php para que coincida con la base elegida.
CREATE DATABASE IF NOT EXISTS oscarsoft_turnos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE oscarsoft_turnos;

CREATE TABLE IF NOT EXISTS especialidades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS obras_sociales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS unidades_atencion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    calle VARCHAR(150) NULL,
    numero VARCHAR(20) NULL,
    localidad VARCHAR(100) NULL,
    latitud DECIMAL(10,7) NULL,
    longitud DECIMAL(10,7) NULL,
    activa TINYINT(1) NOT NULL DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS planes_obras_sociales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    obra_social_id INT NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    CONSTRAINT fk_planes_obra_social FOREIGN KEY (obra_social_id) REFERENCES obras_sociales(id) ON DELETE CASCADE,
    KEY idx_planes_obra_social (obra_social_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    firebase_uid VARCHAR(128) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NULL,
    dni VARCHAR(20) NULL UNIQUE,
    fecha_nacimiento DATE NULL,
    telefono VARCHAR(30) NULL,
    rol ENUM('superadmin','admin','recepcionista','medico','paciente') NOT NULL DEFAULT 'paciente',
    obra_social_id INT NULL,
    plan_id INT NULL,
    foto_perfil VARCHAR(255) NULL,
    biografia TEXT NULL,
    direccion VARCHAR(255) NULL,
    matricula VARCHAR(100) NULL,
    contrasena VARCHAR(255) NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario_obra_social FOREIGN KEY (obra_social_id) REFERENCES obras_sociales(id) ON DELETE SET NULL,
    CONSTRAINT fk_usuario_plan FOREIGN KEY (plan_id) REFERENCES planes_obras_sociales(id) ON DELETE SET NULL,
    KEY idx_usuarios_rol_nombre (rol,nombre,apellido)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS medicos_especialidades (
    usuario_id INT NOT NULL,
    especialidad_id INT NOT NULL,
    PRIMARY KEY (usuario_id,especialidad_id),
    CONSTRAINT fk_me_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_me_especialidad FOREIGN KEY (especialidad_id) REFERENCES especialidades(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS medicos_obras_sociales (
    usuario_id INT NOT NULL,
    obra_social_id INT NOT NULL,
    PRIMARY KEY (usuario_id,obra_social_id),
    CONSTRAINT fk_mos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_mos_obra_social FOREIGN KEY (obra_social_id) REFERENCES obras_sociales(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS medicos_planes (
    usuario_id INT NOT NULL,
    plan_id INT NOT NULL,
    PRIMARY KEY (usuario_id,plan_id),
    CONSTRAINT fk_mp_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_mp_plan FOREIGN KEY (plan_id) REFERENCES planes_obras_sociales(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS horarios_medicos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    medico_id INT NOT NULL,
    dia_semana ENUM('Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo') NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    duracion_turno_minutos INT NOT NULL DEFAULT 30,
    unidad_id INT NULL,
    CONSTRAINT fk_horario_medico FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_horario_unidad FOREIGN KEY (unidad_id) REFERENCES unidades_atencion(id) ON DELETE SET NULL,
    KEY idx_horarios_medico_dia (medico_id,dia_semana,hora_inicio)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS turnos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    medico_id INT NOT NULL,
    paciente_id INT NULL,
    especialidad_id INT NULL,
    obra_social_id INT NULL,
    plan_id INT NULL,
    unidad_id INT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    estado ENUM('libre','pendiente','confirmado','asistio','ausente','cancelado') NOT NULL DEFAULT 'confirmado',
    notas TEXT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_turno_medico FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT fk_turno_paciente FOREIGN KEY (paciente_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT fk_turno_especialidad FOREIGN KEY (especialidad_id) REFERENCES especialidades(id) ON DELETE RESTRICT,
    CONSTRAINT fk_turno_obra_social FOREIGN KEY (obra_social_id) REFERENCES obras_sociales(id) ON DELETE SET NULL,
    CONSTRAINT fk_turno_plan FOREIGN KEY (plan_id) REFERENCES planes_obras_sociales(id) ON DELETE SET NULL,
    CONSTRAINT fk_turno_unidad FOREIGN KEY (unidad_id) REFERENCES unidades_atencion(id) ON DELETE SET NULL,
    UNIQUE KEY uq_medico_fecha_hora (medico_id,fecha,hora_inicio),
    KEY idx_turnos_disponibilidad (medico_id,fecha,estado,hora_inicio,hora_fin),
    KEY idx_turnos_paciente_fecha (paciente_id,fecha,estado)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS configuracion (
    clave VARCHAR(100) PRIMARY KEY,
    valor VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO especialidades (nombre) VALUES ('Fonoaudiología'),('Kinesiología'),('Psicología'),('Medicina General');
INSERT IGNORE INTO configuracion (clave,valor) VALUES ('meses_agenda','3');
