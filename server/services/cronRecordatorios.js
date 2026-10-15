const pool = require('../db');
const { sendWhatsAppMessage, getBotMessage, userSessions } = require('../routes/whatsapp');
const { formatearFechaCorta } = require('./turnosService');

/**
 * Obtiene la fecha y hora actual en la zona horaria de Argentina (UTC-3)
 */
function getNowArgentina() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc - (3600000 * 3));
}

function formatearYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sumarDias(ymdStr, dias) {
  const [y, m, d] = ymdStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().split('T')[0];
}

/**
 * Procesa y envía recordatorios de 48hs (con solicitud de confirmación / cancelación)
 * Horario restringido: Entre las 11:00 y las 14:00 hs de Argentina
 */
async function procesarRecordatorios48h(nowArg) {
  try {
    const hoyStr = formatearYMD(nowArg);
    const mananaStr = sumarDias(hoyStr, 1);
    const hastaStr = sumarDias(hoyStr, 2);

    const [turnos] = await pool.query(
      `SELECT t.id, DATE_FORMAT(t.fecha, '%Y-%m-%d') as fecha_str, t.fecha, t.hora_inicio, t.estado,
              p.id as paciente_id, p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.telefono as paciente_telefono,
              m.nombre as medico_nombre, m.apellido as medico_apellido,
              e.nombre as especialidad_nombre,
              u.nombre as sede_nombre, TRIM(CONCAT(COALESCE(u.calle, ''), ' ', COALESCE(u.numero, ''))) as sede_direccion
       FROM turnos t
       JOIN usuarios p ON t.paciente_id = p.id
       JOIN usuarios m ON t.medico_id = m.id
       LEFT JOIN especialidades e ON t.especialidad_id = e.id
       LEFT JOIN unidades_atencion u ON t.unidad_id = u.id
       WHERE t.fecha BETWEEN ? AND ?
         AND t.estado IN ('asignado', 'pendiente', 'confirmado')
         AND t.recordatorio_48h_enviado = 0
         AND p.telefono IS NOT NULL AND p.telefono != ''
       LIMIT 40`,
      [mananaStr, hastaStr]
    );

    if (turnos.length === 0) return;

    console.log(`⏰ [CRON 48HS] Procesando ${turnos.length} recordatorio(s) de 48hs...`);

    for (const t of turnos) {
      const phone = t.paciente_telefono;
      const fechaArg = formatearFechaCorta(t.fecha);
      const horaStr = (t.hora_inicio || '').substring(0, 5);
      const sede = t.sede_nombre ? `${t.sede_nombre}${t.sede_direccion ? ` (${t.sede_direccion})` : ''}` : 'Consultorio';
      const esp = t.especialidad_nombre || 'Medicina General';

      const msg = await getBotMessage(
        'recordatorio_48h',
        `🔔 *Recordatorio de Turno Médico (en 48 hs)*\n\nHola *{paciente_nombre}*, te recordamos tu próximo turno:\n\n👨‍⚕️ *Profesional:* Dr. {medico_nombre}\n🩺 *Especialidad:* {especialidad}\n🗓 *Fecha:* {fecha} a las ⏰ {hora} hs\n📍 *Lugar:* {sede}\n\nPor favor, confirmá tu asistencia respondiendo:\n*1* - ✅ Sí, confirmo mi asistencia\n*2* - ❌ Deseo cancelar mi turno`,
        {
          paciente_nombre: `${t.paciente_nombre} ${t.paciente_apellido}`.trim(),
          medico_nombre: `${t.medico_nombre} ${t.medico_apellido}`.trim(),
          especialidad: esp,
          fecha: fechaArg,
          hora: horaStr,
          sede: sede
        }
      );

      const enviado = await sendWhatsAppMessage(phone, msg);
      if (enviado) {
        await pool.query('UPDATE turnos SET recordatorio_48h_enviado = 1 WHERE id = ?', [t.id]);
        console.log(`✅ [CRON 48HS] Recordatorio enviado a ${phone} para turno #${t.id}`);

        // Configurar sesión conversacional para responder a la confirmación
        const digits = String(phone).replace(/\D/g, '');
        const sessionData = {
          step: 'AWAIT_REMINDER_CONFIRMATION',
          turnoId: t.id,
          turno: t,
          paciente: { id: t.paciente_id, nombre: t.paciente_nombre, apellido: t.paciente_apellido }
        };
        userSessions.set(digits, sessionData);
        if (digits.startsWith('549')) {
          userSessions.set('54' + digits.slice(3), sessionData);
        } else if (digits.startsWith('54')) {
          userSessions.set('549' + digits.slice(2), sessionData);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error en procesarRecordatorios48h:', err.message);
  }
}

/**
 * Procesa y envía recordatorios de 2hs (alerta puntual)
 */
async function procesarRecordatorios2h(nowArg) {
  try {
    const hoyStr = formatearYMD(nowArg);

    const [turnos] = await pool.query(
      `SELECT t.id, DATE_FORMAT(t.fecha, '%Y-%m-%d') as fecha_str, t.fecha, t.hora_inicio, t.estado,
              p.id as paciente_id, p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.telefono as paciente_telefono,
              m.nombre as medico_nombre, m.apellido as medico_apellido,
              e.nombre as especialidad_nombre,
              u.nombre as sede_nombre, TRIM(CONCAT(COALESCE(u.calle, ''), ' ', COALESCE(u.numero, ''))) as sede_direccion
       FROM turnos t
       JOIN usuarios p ON t.paciente_id = p.id
       JOIN usuarios m ON t.medico_id = m.id
       LEFT JOIN especialidades e ON t.especialidad_id = e.id
       LEFT JOIN unidades_atencion u ON t.unidad_id = u.id
       WHERE t.fecha = ?
         AND t.estado IN ('asignado', 'pendiente', 'confirmado')
         AND t.recordatorio_2h_enviado = 0
         AND p.telefono IS NOT NULL AND p.telefono != ''
       LIMIT 40`,
      [hoyStr]
    );

    if (turnos.length === 0) return;

    const nowMinutos = (nowArg.getHours() * 60) + nowArg.getMinutes();

    for (const t of turnos) {
      const [h, m] = t.hora_inicio.split(':').map(Number);
      const turnoMinutos = (h * 60) + m;
      const diffMinutos = turnoMinutos - nowMinutos;

      // Se envía si faltan entre 60 y 135 minutos (aprox. 1h a 2h y cuarto antes)
      if (diffMinutos >= 60 && diffMinutos <= 135) {
        const phone = t.paciente_telefono;
        const horaStr = (t.hora_inicio || '').substring(0, 5);
        const sede = t.sede_nombre ? `${t.sede_nombre}${t.sede_direccion ? ` (${t.sede_direccion})` : ''}` : 'Consultorio';
        const esp = t.especialidad_nombre || 'Consulta Médica';

        const msg = await getBotMessage(
          'recordatorio_2h',
          `⏰ *¡Recordatorio: Tu turno es en 2 horas!*\n\nHola *{paciente_nombre}*, te recordamos que hoy a las ⏰ *{hora} hs* tenés tu turno con el *Dr. {medico_nombre}* ({especialidad}).\n\n📍 *Lugar:* {sede}\n\n🚗 *¿Estás demorado por el tránsito?* Podés responder directamente a este mensaje indicando tu demora (ej: *'Estoy retrasado 15 minutos'*) y le avisaremos de inmediato al consultorio.\n\n_¡Te esperamos!_`,
          {
            paciente_nombre: t.paciente_nombre,
            medico_nombre: `${t.medico_nombre} ${t.medico_apellido}`.trim(),
            especialidad: esp,
            hora: horaStr,
            sede: sede
          }
        );

        const enviado = await sendWhatsAppMessage(phone, msg);
        if (enviado) {
          await pool.query('UPDATE turnos SET recordatorio_2h_enviado = 1 WHERE id = ?', [t.id]);
          console.log(`✅ [CRON 2HS] Alerta enviada a ${phone} para turno #${t.id}`);

          // Configurar sesión para capturar posible aviso de retraso del paciente
          const digits = String(phone).replace(/\D/g, '');
          const sessionData = {
            step: 'AWAIT_2H_PATIENT_REPLY',
            turnoId: t.id,
            turno: t,
            paciente: { id: t.paciente_id, nombre: t.paciente_nombre, apellido: t.paciente_apellido }
          };
          userSessions.set(digits, sessionData);
          if (digits.startsWith('549')) {
            userSessions.set('54' + digits.slice(3), sessionData);
          } else if (digits.startsWith('54')) {
            userSessions.set('549' + digits.slice(2), sessionData);
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ Error en procesarRecordatorios2h:', err.message);
  }
}

/**
 * Función principal que ejecuta la revisión periódica
 */
async function ejecutarRevisionRecordatorios() {
  const nowArg = getNowArgentina();
  const horaActual = nowArg.getHours();

  console.log(`🔍 [CRON RECORDATORIOS] Verificando turnos... (Hora Argentina: ${nowArg.toLocaleTimeString('es-AR')})`);

  // Recordatorios 48hs: Solo se envían en la ventana de 11:00 a 14:00 hs de Argentina
  if (horaActual >= 11 && horaActual < 14) {
    await procesarRecordatorios48h(nowArg);
  }

  // Recordatorios 2hs: Se envían puntualmente 2 horas antes de la cita
  await procesarRecordatorios2h(nowArg);
}

/**
 * Inicia el cron job cada 15 minutos
 */
function iniciarCronRecordatorios() {
  // Ejecutar una primera revisión a los 10 segundos de iniciar el servidor
  setTimeout(ejecutarRevisionRecordatorios, 10000);

  // Repetir cada 15 minutos (15 * 60 * 1000 ms)
  setInterval(ejecutarRevisionRecordatorios, 15 * 60 * 1000);

  console.log('🕒 Cron Job de Recordatorios iniciado (Revisión cada 15m | 48hs entre 11 y 14hs Arg | 2hs puntuales)');
}

module.exports = {
  iniciarCronRecordatorios,
  ejecutarRevisionRecordatorios
};
