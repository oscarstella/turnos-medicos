-- =========================================================================
-- Migración de Base de Datos: Mejoras Octubre OscarSoft Turnos
-- Paginación, Búsqueda Fonética, Reprogramación por Suspensión y O.S. Dinámica
-- =========================================================================

-- Inserción / Actualización de Plantillas en bot_respuestas
INSERT INTO bot_respuestas (clave, titulo, descripcion, mensaje, activo)
VALUES
(
  'no_mas_turnos_disponibles',
  'Paginación: Fin de Agenda Habilitada',
  'Aviso cuando no hay más fechas u horarios posteriores dentro del período habilitado de agenda.',
  'ℹ️ No hay más fechas disponibles dentro del período habilitado de agenda ({max_dias} días). Escribí el número de alguna de las fechas anteriores o *menu* para reiniciar.',
  1
),
(
  'sugerencia_medico_fuzzy',
  'Búsqueda Fonética: Sugerencias Inteligentes',
  'Mensaje con profesionales sugeridos cuando no hay coincidencia exacta pero sí fonética o difusa.',
  '🔎 No encontramos una coincidencia exacta para *"{busqueda}"*, pero encontramos estos profesionales:\n\n{lista_medicos}\n\n_Respondé con el *número* del profesional para agendar tu turno (o *menu* para volver):_',
  1
),
(
  'medico_no_encontrado',
  'Búsqueda Fonética: Médico No Encontrado',
  'Mensaje cuando ningún profesional coincide fonéticamente ni por nombre.',
  '❌ No encontramos profesionales coincidentes con *"{busqueda}"*.\n\nIntentá escribir solo el apellido o parte del nombre, o escribí *menu* para volver al inicio:',
  1
),
(
  'suspension_medico_aviso',
  'Aviso de Suspensión Médica y Reprogramación',
  'Notificación automática a pacientes afectados por cancelación de agenda médica con opción de reprogramar.',
  '⚠️ *Aviso Importante de Atención Médica*\n\nHola *{paciente_nombre}*, te informamos que el *Dr. {medico_nombre}* no podrá atender el día *{fecha}* a las *{hora} hs* por: _{motivo}_.\n\nLamentamos las molestias ocasionadas. ¿Qué deseás hacer con tu turno?\n*1* - 🗓 Reprogramar mi turno para otra fecha disponible\n*2* - ❌ Dejar cancelado el turno definitivamente\n\n_Respondé con 1 o 2 para continuar._',
  1
),
(
  'suspension_cancelado_confirmado',
  'Cancelación Confirmada tras Suspensión Médica',
  'Confirmación cuando el paciente decide dejar cancelado el turno suspendido.',
  '✅ Comprendido, tu turno ha quedado cancelado. Podés volver a escribirnos en cualquier momento cuando desees una nueva consulta. ¡Que tengas un excelente día!',
  1
),
(
  'cobertura_predeterminada_prompt',
  'Cobertura: Usar Obra Social Registrada o Cambiar',
  'Pregunta si el paciente desea utilizar su obra social predeterminada o cambiarla.',
  '💳 *Cobertura médica para la consulta:*\n\nTu cobertura registrada es:\n👉 *{obra_social}* {plan_info}\n\n¿Deseás utilizar esta cobertura?\n*1* - ✅ Sí, continuar con {obra_social}\n*2* - 🔄 Cambiar por otra obra social o prepaga\n*3* - 💵 Atención Particular (sin obra social)\n\n_O escribí *menu* para cancelar._',
  1
)
ON DUPLICATE KEY UPDATE 
  titulo = VALUES(titulo),
  descripcion = VALUES(descripcion),
  mensaje = VALUES(mensaje),
  activo = VALUES(activo);
