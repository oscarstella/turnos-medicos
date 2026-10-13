/**
 * Lógica de negocio compartida de turnos.
 * La usan tanto la API pública (web) como el bot de WhatsApp,
 * para que ambos canales consulten disponibilidad y agenden exactamente igual.
 */
const pool = require('../db');

const TZ = 'America/Argentina/Buenos_Aires';

const DIAS_MAP = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miercoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sabado',
  0: 'Domingo'
};

class ServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function normalizeDni(dni) {
  if (!dni) return null;
  const digits = String(dni).replace(/\D+/g, '');
  return digits.length >= 7 && digits.length <= 9 ? digits : null;
}

/** Fecha de hoy en Argentina como 'YYYY-MM-DD' (el VPS corre en otra zona horaria). */
function hoyArgentina() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

/** Hora actual en Argentina como 'HH:MM'. */
function horaArgentina() {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

/** Día del mes actual en Argentina. */
function diaDelMesArgentina() {
  return parseInt(hoyArgentina().split('-')[2], 10);
}

/** Suma días a una fecha 'YYYY-MM-DD' y devuelve 'YYYY-MM-DD'. */
function sumarDias(fechaStr, dias) {
  const d = new Date(fechaStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().split('T')[0];
}

/** Días máximos hacia adelante que se puede agendar con este médico. */
async function getMaxDiasAgenda(medico) {
  if (medico.dias_antelacion_agenda && Number(medico.dias_antelacion_agenda) > 0) {
    return Number(medico.dias_antelacion_agenda);
  }
  try {
    const [confRows] = await pool.query("SELECT valor FROM configuracion WHERE clave = 'meses_agenda' LIMIT 1");
    const meses = confRows.length > 0 ? parseInt(confRows[0].valor, 10) : 3;
    return (meses || 3) * 30;
  } catch (err) {
    return 90;
  }
}

/** Planes de una obra social (incluye la familia canónica). Devuelve [{id:0,'Plan General'}] si no hay. */
async function getPlanes(obraSocialId) {
  const targetId = parseInt(obraSocialId, 10);
  const [osRows] = await pool.query('SELECT id, nombre FROM obras_sociales WHERE id = ?', [targetId]);
  if (!osRows || osRows.length === 0) {
    return [{ id: 0, nombre: 'Plan General' }];
  }

  const osNombre = osRows[0].nombre.toLowerCase();
  const familyKeywords = [
    'accord', 'osde', 'swiss medical', 'galeno', 'sancor', 'medife', 'medifé',
    'omint', 'medicus', 'activa salud', 'aca salud', 'bristol', 'federada',
    'ioma', 'pami', 'luis pasteur', 'jerarqu', 'prevencion', 'prevención',
    'union personal', 'unión personal', 'osecac'
  ];

  let queryIds = [targetId];
  for (const kw of familyKeywords) {
    if (osNombre.includes(kw)) {
      const [relatedOS] = await pool.query(
        'SELECT id FROM obras_sociales WHERE LOWER(nombre) LIKE ? ORDER BY LENGTH(nombre) ASC LIMIT 6',
        [`%${kw}%`]
      );
      relatedOS.forEach(r => {
        if (!queryIds.includes(r.id)) queryIds.push(r.id);
      });
      break;
    }
  }

  const [rows] = await pool.query(
    `SELECT id, nombre FROM planes_obras_sociales 
     WHERE obra_social_id IN (?) 
     ORDER BY FIELD(obra_social_id, ?) DESC, nombre ASC`,
    [queryIds, targetId]
  );

  // Desduplicar planes preservando el ID más específico
  const seenNames = new Set();
  const uniquePlanes = [];
  for (const r of rows) {
    const clean = r.nombre.trim().toLowerCase();
    if (!seenNames.has(clean)) {
      seenNames.add(clean);
      uniquePlanes.push(r);
    }
  }

  if (uniquePlanes.length === 0) {
    return [{ id: 0, nombre: 'Plan General' }];
  }
  return uniquePlanes;
}

/** Detalle completo de un médico por id o slug. Devuelve null si no existe. */
async function getMedicoDetalle(idOrSlug) {
  const cleanParam = String(idOrSlug).trim().toLowerCase();
  const isNumeric = /^\d+$/.test(cleanParam);

  let query = `
    SELECT id, nombre, apellido, email, matricula, foto_perfil, biografia, direccion,
           dias_antelacion_agenda, dia_apertura_agenda,
           acepta_particular, honorarios_particular, mostrar_honorarios, slug
    FROM usuarios
    WHERE rol = 'medico' AND (
  `;
  const params = [];

  if (isNumeric) {
    query += ` id = ? OR slug = ?`;
    params.push(parseInt(cleanParam, 10), cleanParam);
  } else {
    const normalized = cleanParam.replace(/-/g, '').replace(/\s+/g, '');
    query += `
      slug = ?
      OR LOWER(REPLACE(REPLACE(CONCAT(apellido, nombre), ' ', ''), '-', '')) = ?
      OR LOWER(REPLACE(REPLACE(CONCAT(nombre, apellido), ' ', ''), '-', '')) = ?
      OR LOWER(REPLACE(REPLACE(apellido, ' ', ''), '-', '')) = ?
    `;
    params.push(cleanParam, normalized, normalized, normalized);
  }

  query += ` ) LIMIT 1`;

  const [rows] = await pool.query(query, params);
  if (rows.length === 0) return null;

  const medico = rows[0];
  const medicoId = medico.id;

  const [esp] = await pool.query(
    `SELECT e.id, e.nombre FROM especialidades e
     JOIN medicos_especialidades me ON e.id = me.especialidad_id
     WHERE me.usuario_id = ?`,
    [medicoId]
  );

  const [obras] = await pool.query(
    `SELECT os.id, os.nombre FROM obras_sociales os
     JOIN medicos_obras_sociales mos ON os.id = mos.obra_social_id
     WHERE mos.usuario_id = ? ORDER BY os.nombre ASC`,
    [medicoId]
  );

  const [horarios] = await pool.query(
    `SELECT hm.id, hm.dia_semana, hm.hora_inicio, hm.hora_fin, hm.duracion_turno_minutos,
            ua.id as unidad_id, ua.nombre as unidad_nombre, ua.calle, ua.numero
     FROM horarios_medicos hm
     LEFT JOIN unidades_atencion ua ON hm.unidad_id = ua.id
     WHERE hm.medico_id = ?
     ORDER BY FIELD(hm.dia_semana, 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'), hm.hora_inicio ASC`,
    [medicoId]
  );

  return {
    ...medico,
    especialidades: esp,
    obras_sociales: obras,
    horarios
  };
}

/**
 * Disponibilidad de un médico para una fecha.
 * Devuelve el mismo objeto que responde GET /public/disponibilidad.
 */
async function getDisponibilidad(medicoId, fecha) {
  if (!medicoId || !fecha) {
    throw new ServiceError(400, 'Se requiere medico_id y fecha (YYYY-MM-DD).');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new ServiceError(400, 'Formato de fecha inválido. Usar YYYY-MM-DD.');
  }

  const [medRows] = await pool.query(
    'SELECT id, dias_antelacion_agenda, dia_apertura_agenda FROM usuarios WHERE id = ? AND rol = "medico" LIMIT 1',
    [medicoId]
  );
  if (medRows.length === 0) {
    throw new ServiceError(404, 'Médico no encontrado.');
  }

  const medico = medRows[0];
  const hoy = hoyArgentina();

  // Fecha en el pasado
  if (fecha < hoy) {
    return { status: 'success', data: [], slots: [], message: 'La fecha seleccionada ya pasó.' };
  }

  // Día fijo de apertura de agenda cada mes
  if (medico.dia_apertura_agenda && Number(medico.dia_apertura_agenda) > 0) {
    const diaApertura = Number(medico.dia_apertura_agenda);
    if (diaDelMesArgentina() < diaApertura) {
      return {
        status: 'success',
        agenda_cerrada: true,
        dia_apertura: diaApertura,
        slots: [],
        message: `La agenda de turnos para este profesional se abre a partir del día ${diaApertura} de cada mes.`
      };
    }
  }

  // Antelación máxima
  const maxDias = await getMaxDiasAgenda(medico);
  if (fecha > sumarDias(hoy, maxDias)) {
    return {
      status: 'success',
      slots: [],
      message: `La agenda de este profesional solo está habilitada hasta ${maxDias} días hacia adelante.`
    };
  }

  const targetDate = new Date(fecha + 'T12:00:00Z');
  const diaNombre = DIAS_MAP[targetDate.getUTCDay()];

  const [horarios] = await pool.query(
    `SELECT hm.id, hm.hora_inicio, hm.hora_fin, hm.duracion_turno_minutos,
            ua.id as unidad_id, ua.nombre as unidad_nombre, ua.calle, ua.numero
     FROM horarios_medicos hm
     LEFT JOIN unidades_atencion ua ON hm.unidad_id = ua.id
     WHERE hm.medico_id = ? AND hm.dia_semana = ?
     ORDER BY hm.hora_inicio ASC`,
    [medicoId, diaNombre]
  );

  if (horarios.length === 0) {
    return { status: 'success', slots: [], message: `El profesional no atiende los días ${diaNombre}.` };
  }

  const [turnosOcupados] = await pool.query(
    `SELECT id, hora_inicio, hora_fin, estado
     FROM turnos
     WHERE medico_id = ? AND fecha = ? AND estado NOT IN ('cancelado', 'libre')`,
    [medicoId, fecha]
  );

  const horasOcupadas = new Set(turnosOcupados.map((t) => t.hora_inicio.substring(0, 5)));
  const slots = [];

  for (const h of horarios) {
    const dur = h.duracion_turno_minutos || 30;
    let [currentH, currentM] = h.hora_inicio.split(':').map(Number);
    const [endH, endM] = h.hora_fin.split(':').map(Number);
    const totalEndMinutes = endH * 60 + endM;

    while (currentH * 60 + currentM < totalEndMinutes) {
      const slotStartStr = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;

      let nextM = currentM + dur;
      let nextH = currentH;
      if (nextM >= 60) {
        nextH += Math.floor(nextM / 60);
        nextM = nextM % 60;
      }
      const slotEndStr = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;

      slots.push({
        hora_inicio: slotStartStr,
        hora_fin: slotEndStr,
        disponible: !horasOcupadas.has(slotStartStr),
        unidad_id: h.unidad_id,
        unidad_nombre: h.unidad_nombre,
        direccion: h.calle && h.numero ? `${h.calle} ${h.numero}` : null
      });

      currentH = nextH;
      currentM = nextM;
    }
  }

  return { status: 'success', fecha, dia_semana: diaNombre, slots };
}

/**
 * Crea un turno. Misma lógica que POST /public/agendar.
 * @param {object} datos - body del request (medico_id, fecha, hora_inicio, paciente, etc.)
 * @param {number|null} usuarioLogueadoId - id del paciente autenticado (web), o null
 * @returns {Promise<object>} turno creado con sus detalles
 */
async function crearTurno(datos, usuarioLogueadoId = null) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      medico_id,
      especialidad_id,
      obra_social_id,
      plan_id,
      unidad_id,
      fecha,
      hora_inicio,
      hora_fin,
      notas,
      paciente
    } = datos;

    if (!medico_id || !fecha || !hora_inicio) {
      throw new ServiceError(400, 'Faltan datos requeridos (médico, fecha, horario).');
    }

    let pacienteId = usuarioLogueadoId || null;
    const finalObraSocialId = (obra_social_id === 'particular' || !obra_social_id) ? null : parseInt(obra_social_id, 10);
    const finalPlanId = finalObraSocialId && plan_id ? parseInt(plan_id, 10) : null;

    // Si no está logueado, buscar o crear al paciente por DNI o Email
    if (!pacienteId) {
      if (!paciente || !paciente.nombre || !paciente.apellido || !paciente.dni || !paciente.email || !paciente.telefono) {
        throw new ServiceError(400, 'Todos los campos son obligatorios: Nombre, Apellido, DNI, Correo Electrónico y Teléfono / WhatsApp.');
      }

      const cleanDni = normalizeDni(paciente.dni);
      const cleanEmail = paciente.email.trim().toLowerCase();

      const [existingUser] = await connection.query(
        'SELECT id, rol FROM usuarios WHERE dni = ? OR LOWER(email) = ? LIMIT 1',
        [cleanDni, cleanEmail]
      );

      if (existingUser.length > 0) {
        pacienteId = existingUser[0].id;
        await connection.query(
          `UPDATE usuarios SET 
            nombre = COALESCE(?, nombre),
            apellido = COALESCE(?, apellido),
            telefono = COALESCE(?, telefono),
            obra_social_id = ?,
            plan_id = ?
           WHERE id = ?`,
          [paciente.nombre.trim(), (paciente.apellido || '').trim(), paciente.telefono || null, finalObraSocialId, finalPlanId, pacienteId]
        );
      } else {
        const [inserted] = await connection.query(
          `INSERT INTO usuarios (nombre, apellido, dni, email, telefono, tiene_whatsapp, obra_social_id, plan_id, rol)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paciente')`,
          [
            paciente.nombre.trim(),
            (paciente.apellido || '').trim(),
            cleanDni,
            cleanEmail,
            paciente.telefono || null,
            paciente.tiene_whatsapp !== false ? 1 : 0,
            finalObraSocialId,
            finalPlanId
          ]
        );
        pacienteId = inserted.insertId;
      }
    }

    // Calcular hora_fin si no fue provista (por defecto +30 min)
    let calculatedHoraFin = hora_fin;
    if (!calculatedHoraFin) {
      const [h, m] = hora_inicio.split(':').map(Number);
      let finM = m + 30;
      let finH = h;
      if (finM >= 60) {
        finH += 1;
        finM -= 60;
      }
      calculatedHoraFin = `${String(finH).padStart(2, '0')}:${String(finM).padStart(2, '0')}:00`;
    }

    // Control de concurrencia
    const [conflict] = await connection.query(
      `SELECT id FROM turnos 
       WHERE medico_id = ? AND fecha = ? AND hora_inicio = ? 
         AND estado NOT IN ('cancelado', 'libre') 
       FOR UPDATE`,
      [medico_id, fecha, hora_inicio]
    );
    if (conflict.length > 0) {
      throw new ServiceError(409, 'El horario seleccionado acaba de ser reservado por otra persona. Por favor selecciona otro turno.');
    }

    // Un turno por paciente / médico / día
    const [patientConflict] = await connection.query(
      `SELECT id FROM turnos
       WHERE paciente_id = ? AND medico_id = ? AND fecha = ? AND estado NOT IN ('cancelado') LIMIT 1`,
      [pacienteId, medico_id, fecha]
    );
    if (patientConflict.length > 0) {
      throw new ServiceError(400, 'Ya tienes un turno reservado con este profesional en la misma fecha.');
    }

    const [result] = await connection.query(
      `INSERT INTO turnos (
        medico_id, paciente_id, especialidad_id, obra_social_id, plan_id, unidad_id,
        fecha, hora_inicio, hora_fin, estado, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmado', ?)`,
      [
        medico_id,
        pacienteId,
        especialidad_id || null,
        finalObraSocialId,
        finalPlanId,
        unidad_id || null,
        fecha,
        hora_inicio,
        calculatedHoraFin,
        notas || null
      ]
    );

    await connection.commit();

    const [created] = await pool.query(
      `SELECT t.id, t.fecha, t.hora_inicio, t.hora_fin, t.estado, t.notas,
              m.nombre as medico_nombre, m.apellido as medico_apellido,
              p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni,
              e.nombre as especialidad_nombre,
              os.nombre as obra_social_nombre,
              ua.nombre as unidad_nombre, ua.calle, ua.numero
       FROM turnos t
       JOIN usuarios m ON t.medico_id = m.id
       JOIN usuarios p ON t.paciente_id = p.id
       LEFT JOIN especialidades e ON t.especialidad_id = e.id
       LEFT JOIN obras_sociales os ON t.obra_social_id = os.id
       LEFT JOIN unidades_atencion ua ON t.unidad_id = ua.id
       WHERE t.id = ? LIMIT 1`,
      [result.insertId]
    );

    return created[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const MESES_NOMBRES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function formatearFechaTexto(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const diaSemana = DIAS_NOMBRES[dateObj.getUTCDay()];
  const mes = MESES_NOMBRES[m - 1];
  return `${diaSemana} ${d} de ${mes}`;
}

/** Formatea una fecha 'YYYY-MM-DD' al formato estándar argentino 'DD/MM/AAAA' */
function formatearFechaCorta(fechaStr) {
  if (!fechaStr) return '';
  const clean = String(fechaStr).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return fechaStr;
}

/**
 * Calcula las próximas fechas disponibles para un médico según sus horarios semanales
 * y topes de antelación / apertura de agenda.
 */
async function calcularProximasFechas(medicoId, cantidad = 6) {
  const medico = await getMedicoDetalle(medicoId);
  if (!medico || !medico.horarios || medico.horarios.length === 0) return [];

  // Verificar si la agenda está cerrada por dia_apertura_agenda
  if (medico.dia_apertura_agenda && Number(medico.dia_apertura_agenda) > 0) {
    if (diaDelMesArgentina() < Number(medico.dia_apertura_agenda)) {
      return [];
    }
  }

  const diasAtencion = new Set(
    medico.horarios.map(h => (h.dia_semana || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim())
  );

  const maxDias = await getMaxDiasAgenda(medico);
  const hoyStr = hoyArgentina();
  const resFechas = [];

  for (let i = 1; i <= maxDias && resFechas.length < cantidad; i++) {
    const fStr = sumarDias(hoyStr, i);
    const [y, m, d] = fStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const dayOfWeek = dateObj.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Solo lunes a viernes

    const DIAS_KEYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const diaNorm = DIAS_KEYS[dayOfWeek];

    if (diasAtencion.has(diaNorm)) {
      resFechas.push({
        fecha: fStr,
        fechaTexto: formatearFechaTexto(fStr),
        diaSemana: DIAS_MAP[dayOfWeek]
      });
    }
  }

  return resFechas;
}

module.exports = {
  ServiceError,
  DIAS_MAP,
  normalizeDni,
  hoyArgentina,
  horaArgentina,
  sumarDias,
  formatearFechaTexto,
  formatearFechaCorta,
  calcularProximasFechas,
  getMaxDiasAgenda,
  getPlanes,
  getMedicoDetalle,
  getDisponibilidad,
  crearTurno
};
