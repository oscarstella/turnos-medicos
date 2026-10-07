-- Ejecutar una vez en la base que usa la aplicación, después del despliegue.
-- Antes, revisar y corregir duplicados. La consulta debe devolver cero filas:
-- SELECT REGEXP_REPLACE(dni, '[^0-9]', '') AS dni_normalizado, COUNT(*) AS cantidad
-- FROM usuarios WHERE dni IS NOT NULL AND dni <> ''
-- GROUP BY dni_normalizado HAVING COUNT(*) > 1;
-- También verificar DNIs inválidos y corregirlos manualmente para no mezclar fichas.
-- SELECT id, dni FROM usuarios WHERE dni IS NOT NULL AND dni <> ''
-- AND REGEXP_REPLACE(dni, '[^0-9]', '') NOT REGEXP '^[0-9]{7,8}$';

-- Ejecutar la normalización solo después de comprobar que no hay DNIs repetidos.
UPDATE usuarios SET dni = NULL WHERE dni IS NOT NULL AND TRIM(dni) = '';
UPDATE usuarios
SET dni = REGEXP_REPLACE(dni, '[^0-9]', '')
WHERE dni IS NOT NULL AND dni <> ''
  AND REGEXP_REPLACE(dni, '[^0-9]', '') REGEXP '^[0-9]{7,8}$';

-- Un DNI por paciente; MySQL permite múltiples NULL para médicos y cuentas administrativas.
ALTER TABLE usuarios
    ADD UNIQUE KEY uq_usuarios_dni (dni);

-- Índice de apoyo a la consulta de disponibilidad y solapamientos.
ALTER TABLE turnos
    ADD KEY idx_turnos_medico_fecha_estado_horas (medico_id, fecha, estado, hora_inicio, hora_fin);
