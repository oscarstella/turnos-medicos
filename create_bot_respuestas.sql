-- Tabla de Preguntas y Respuestas del Bot de WhatsApp
CREATE TABLE IF NOT EXISTS bot_respuestas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clave VARCHAR(80) NOT NULL UNIQUE,
  titulo VARCHAR(150) NOT NULL,
  descripcion VARCHAR(255) NULL,
  disparador VARCHAR(200) NULL,
  mensaje TEXT NOT NULL,
  activo TINYINT(1) DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insertar respuestas base del sistema
INSERT INTO bot_respuestas (clave, titulo, descripcion, disparador, mensaje, activo)
VALUES 
(
  'menu_principal',
  'Menú Principal de Bienvenida',
  'Mensaje mostrado al escribir hola, menu o iniciar conversación.',
  'menu,hola,inicio,buenas,empezar',
  '🏥 *Bienvenido al Sistema de Turnos de OscarSoft* 🏥\n_Gestión digital de turnos médicos en San Carlos de Bariloche_{saludo_paciente}\nPor favor, seleccioná una opción respondiendo con el número:\n\n1️⃣ *Buscar turno por médico* (ej: Bocian, Carlos)\n2️⃣ *Buscar médico por especialidad* (ej: Cardiología, Pediatría)\n3️⃣ *Ver sedes y horarios de atención*\n4️⃣ *Consultar mis turnos agendados*\n5️⃣ *Cancelar un turno agendado*\n\n_Respondé con el número (1, 2, 3, 4 o 5) para continuar._',
  1
),
(
  'pedir_dni_paciente',
  'Pregunta: Pedir DNI de Paciente',
  'Mensaje cuando el paciente va a reservar y se le solicita su DNI.',
  NULL,
  '📋 *Identificación de Paciente*\n\nPara agendar tu turno con el *Dr. {medico_nombre}*, por favor ingresá tu número de *DNI* (solo números, sin puntos):',
  1
),
(
  'dni_no_registrado',
  'Respuesta: DNI no registrado (Invitación a Registro)',
  'Enviado cuando el DNI no existe en la base de datos para invitar al registro web.',
  NULL,
  '❌ *DNI no registrado*\n\nNo encontramos ninguna cuenta registrada con el DNI *{dni}* en nuestro sistema.\n\nPara poder agendar tu turno, primero debés registrarte en nuestra plataforma web:\n🔗 https://oscarsoft.com.ar/turnos/login?registro=1\n\n_Luego de completar tu registro, regresá a este chat y escribí *menu* o *hola* para continuar con tu reserva._',
  1
),
(
  'sedes_info',
  'Respuesta: Sedes y Horarios de Atención',
  'Información de consultorios, ubicaciones y horarios.',
  'sedes,horarios,donde atienden,direcciones,ubicacion',
  '🏥 *Nuestras Sedes de Atención en Bariloche*\n\n📍 *Sede Central:*\nPasaje Gutiérrez 980\n⏰ _Lunes a Viernes: 08:00 a 20:00 hs_\n\n📍 *Consultorios Mitre:*\nMitre 124\n⏰ _Lunes a Viernes: 08:00 a 20:00 hs_\n\n📍 *Centro Frey:*\nFrey 111\n⏰ _Lunes a Viernes: 08:00 a 20:00 hs_\n\n🌐 Podés ver ubicaciones y mapas en:\nhttps://oscarsoft.com.ar/turnos/\n\n_Escribí *menu* para volver al menú de opciones._',
  1
),
(
  'buscar_medico_prompt',
  'Pregunta: Buscar Médico',
  'Instrucción para escribir el nombre o apellido del profesional.',
  NULL,
  '🔍 *Búsqueda de Turno por Médico*\n\nPor favor, escribí el *nombre o apellido* del profesional que estás buscando (ej: _Bocian_, _Carlos_):\n\n_O escribí *menu* para volver._',
  1
),
(
  'motivo_consulta_prompt',
  'Pregunta: Motivo de Consulta',
  'Solicitud opcional del motivo de la cita médica.',
  NULL,
  '📝 *Motivo de Consulta (Opcional)*\n\nPor favor, escribí brevemente el motivo de tu consulta médica, o respondé *0* (o *no*) para omitir:\n\n_O escribí *menu* para cancelar._',
  1
),
(
  'turno_confirmado_exito',
  'Respuesta: Confirmación Exitosa de Turno',
  'Comprobante final tras guardar el turno en la base de datos.',
  NULL,
  '🎉 *¡Turno confirmado con éxito!*\n\n🔖 *Comprobante de Turno:* #{turno_id}\n👨‍⚕️ *Profesional:* Dr. {medico_nombre}\n🗓 *Fecha:* {fecha}\n⏰ *Horario:* {hora} hs\n📍 *Lugar:* {sede}\n👤 *Paciente:* {paciente_nombre}\n💳 *Cobertura:* {cobertura}\n\n⚠️ *Información importante:*\nPor favor presentate 10 minutos antes con tu DNI y carnet de cobertura.\n\nPodés consultar tus turnos agendados en cualquier momento escribiendo *4*.\n\n_¡Muchas gracias por confiar en OscarSoft Turnos!_',
  1
),
(
  'confirmar_cancelacion_prompt',
  'Pregunta: Confirmar Cancelación de Turno',
  'Pregunta al usuario si confirma la cancelación del turno encontrado.',
  NULL,
  '⚠️ *¿Confirmás la cancelación de este turno?*\n\n🔖 *Turno:* #{turno_id}\n👨‍⚕️ *Profesional:* Dr. {medico_nombre}\n🗓 *Fecha:* {fecha} ({hora} hs)\n📍 *Sede:* {sede}\n\nRespondé:\n*1* - ✅ Sí, cancelar este turno\n*2* - ❌ No, conservar mi turno',
  1
),
(
  'turno_cancelado_exito',
  'Respuesta: Turno Cancelado Exitosamente',
  'Confirmación de turno anulado y horario liberado.',
  NULL,
  '✅ *¡Turno cancelado exitosamente!*\n\nTu turno #{turno_id} con el Dr. {medico_nombre} para el día {fecha} a las {hora} hs ha sido cancelado.\n\nEl horario ha quedado liberado en el sistema. Escribí *menu* para volver al inicio.',
  1
),
(
  'faq_requisitos',
  'FAQ: Requisitos para la Atención',
  'Qué documentación debe llevar el paciente al asistir.',
  'requisitos,documentacion,carnet,que llevar,preparacion',
  '📄 *Requisitos para tu Atención Médica:*\n\n• Documento Nacional de Identidad (DNI)\n• Carnet o credencial de tu Obra Social / Prepaga\n• Orden médica o número de autorización si corresponde\n\n_Presentate 10 minutos antes del horario asignado._\n\n_Escribí *menu* para volver._',
  1
)
ON DUPLICATE KEY UPDATE
  titulo = VALUES(titulo),
  descripcion = VALUES(descripcion),
  disparador = VALUES(disparador);
