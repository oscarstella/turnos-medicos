-- Migración para soporte de Recordatorios Automáticos (48hs y 2hs)

ALTER TABLE turnos 
    ADD COLUMN IF NOT EXISTS recordatorio_48h_enviado TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS recordatorio_2h_enviado TINYINT(1) NOT NULL DEFAULT 0;

-- Nuevas plantillas para bot_respuestas
INSERT INTO bot_respuestas (clave, titulo, descripcion, mensaje, activo)
VALUES
(
  'recordatorio_48h',
  'Recordatorio 48hs Antes (Confirmación / Cancelación)',
  'Mensaje automático enviado 48hs antes del turno solicitando confirmación.',
  '🔔 *Recordatorio de Turno Médico (en 48 hs)*\n\nHola *{paciente_nombre}*, te recordamos tu próximo turno:\n\n👨‍⚕️ *Profesional:* Dr. {medico_nombre}\n🩺 *Especialidad:* {especialidad}\n🗓 *Fecha:* {fecha} a las ⏰ {hora} hs\n📍 *Lugar:* {sede}\n\nPor favor, confirmá tu asistencia respondiendo:\n*1* - ✅ Sí, confirmo mi asistencia\n*2* - ❌ Deseo cancelar mi turno',
  1
),
(
  'recordatorio_2h',
  'Alerta 2hs Antes del Turno',
  'Mensaje recordatorio final enviado 2 horas antes de la consulta médica.',
  '⏰ *¡Recordatorio: Tu turno es en 2 horas!*\n\nHola *{paciente_nombre}*, te recordamos que hoy a las ⏰ *{hora} hs* tenés tu turno con el *Dr. {medico_nombre}* ({especialidad}).\n\n📍 *Lugar:* {sede}\n\n_¡Te esperamos puntualmente!_',
  1
),
(
  'recordatorio_confirmado_exito',
  'Confirmación Exitosa tras Recordatorio 48hs',
  'Mensaje de agradecimiento cuando el paciente confirma asistencia desde el recordatorio de 48hs.',
  '✅ *¡Muchas gracias {paciente_nombre}!* Tu turno con el Dr. {medico_nombre} para el día *{fecha}* a las *{hora} hs* ha sido *confirmado exitosamente*.\n\n_¡Te esperamos! Podés escribir *menu* en cualquier momento para más opciones._',
  1
)
ON DUPLICATE KEY UPDATE 
  titulo = VALUES(titulo),
  descripcion = VALUES(descripcion),
  mensaje = VALUES(mensaje);
