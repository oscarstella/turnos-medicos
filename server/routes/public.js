const express = require('express');
const router = express.Router();
const pool = require('../db');
const { optionalAuth } = require('../middleware/auth');

const DIAS_MAP = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miercoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sabado',
  0: 'Domingo'
};

function normalizeDni(dni) {
  if (!dni) return null;
  const digits = String(dni).replace(/\D+/g, '');
  return digits.length >= 7 && digits.length <= 9 ? digits : null;
}

// 0. Obtener configuración del sistema (ej: meses_agenda / tope general)
router.get('/config', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT clave, valor FROM configuracion');
    const config = {};
    rows.forEach((r) => {
      config[r.clave] = r.valor;
    });
    if (!config.meses_agenda) {
      config.meses_agenda = '3';
    }
    res.json({ status: 'success', data: config });
  } catch (error) {
    console.error('Error en /config:', error);
    res.json({ status: 'success', data: { meses_agenda: '3' } });
  }
});

// 1. Obtener todas las especialidades activas
router.get('/especialidades', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT e.id, e.nombre, e.descripcion, COUNT(DISTINCT me.usuario_id) as total_medicos
      FROM especialidades e
      LEFT JOIN medicos_especialidades me ON e.id = me.especialidad_id
      GROUP BY e.id, e.nombre, e.descripcion
      ORDER BY e.nombre ASC
    `);
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error en /especialidades:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener especialidades.' });
  }
});

// 2. Obtener obras sociales (todas o filtradas por texto)
router.get('/obras-sociales', async (req, res) => {
  try {
    const search = req.query.q && req.query.q.trim() ? `%${req.query.q.trim()}%` : null;
    let query = 'SELECT id, nombre FROM obras_sociales ';
    const params = [];

    if (search) {
      query += 'WHERE nombre LIKE ? ';
      params.push(search);
    }
    query += 'ORDER BY nombre ASC';

    const [rows] = await pool.query(query, params);
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error en /obras-sociales:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener obras sociales.' });
  }
});

// 3. Obtener planes de una obra social
router.get('/planes', async (req, res) => {
  try {
    const { obra_social_id } = req.query;
    if (!obra_social_id) {
      return res.status(400).json({ status: 'error', message: 'Falta parámetro obra_social_id.' });
    }

    const [rows] = await pool.query(
      'SELECT id, nombre FROM planes_obras_sociales WHERE obra_social_id = ? ORDER BY nombre ASC',
      [obra_social_id]
    );
    if (!rows || rows.length === 0) {
      return res.json({ status: 'success', data: [{ id: 0, nombre: 'Plan General' }] });
    }
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error en /planes:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener planes.' });
  }
});

// 3b. Obtener centros y unidades de atención
router.get('/unidades', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT ua.id, ua.nombre, ua.calle, ua.numero, ua.localidad, ua.latitud, ua.longitud,
             COUNT(DISTINCT hm.medico_id) as total_medicos
      FROM unidades_atencion ua
      LEFT JOIN horarios_medicos hm ON ua.id = hm.unidad_id
      WHERE ua.activa = 1
      GROUP BY ua.id, ua.nombre, ua.calle, ua.numero, ua.localidad, ua.latitud, ua.longitud
      ORDER BY ua.nombre ASC
    `);
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error en /unidades:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener unidades de atención.' });
  }
});

// 4. Buscar médicos con filtros (médico específico, centro/unidad, especialidad, obra social, texto libre)
router.get('/medicos', async (req, res) => {
  try {
    const { medico_id, unidad_id, especialidad_id, obra_social_id, q } = req.query;

    let query = `
      SELECT u.id, u.nombre, u.apellido, u.email, u.matricula, u.foto_perfil, u.biografia, u.direccion,
             u.dias_antelacion_agenda, u.dia_apertura_agenda,
             GROUP_CONCAT(DISTINCT e.id, ':', e.nombre SEPARATOR '||') as especialidades_raw,
             GROUP_CONCAT(DISTINCT ua.id, ':', ua.nombre, ':', COALESCE(ua.calle,''), ' ', COALESCE(ua.numero,'') SEPARATOR '||') as sedes_raw
      FROM usuarios u
      LEFT JOIN medicos_especialidades me ON u.id = me.usuario_id
      LEFT JOIN especialidades e ON me.especialidad_id = e.id
      LEFT JOIN horarios_medicos hm ON u.id = hm.medico_id
      LEFT JOIN unidades_atencion ua ON hm.unidad_id = ua.id
      LEFT JOIN medicos_obras_sociales mos ON u.id = mos.usuario_id
      WHERE u.rol = 'medico'
    `;
    const params = [];

    if (medico_id) {
      query += ' AND u.id = ?';
      params.push(medico_id);
    }

    if (unidad_id) {
      query += ' AND (hm.unidad_id = ? OR u.direccion LIKE ?)';
      params.push(unidad_id, `%${unidad_id}%`);
    }

    if (especialidad_id) {
      query += ' AND me.especialidad_id = ?';
      params.push(especialidad_id);
    }

    if (obra_social_id) {
      query += ' AND mos.obra_social_id = ?';
      params.push(obra_social_id);
    }

    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      query += ' AND (u.nombre LIKE ? OR u.apellido LIKE ? OR e.nombre LIKE ? OR ua.nombre LIKE ? OR ua.calle LIKE ? OR u.direccion LIKE ?)';
      params.push(term, term, term, term, term, term);
    }

    query += ' GROUP BY u.id ORDER BY u.apellido ASC, u.nombre ASC';

    const [rows] = await pool.query(query, params);

    if (rows.length === 0) {
      return res.json({ status: 'success', data: [] });
    }

    const doctorIds = rows.map(r => r.id);

    // Obtener horarios semanales vigentes (estrictamente Lunes a Viernes, sin sábados)
    const [horariosRows] = await pool.query(`
      SELECT hm.medico_id, hm.dia_semana, hm.hora_inicio, hm.hora_fin, hm.duracion_turno_minutos,
             ua.id as unidad_id, ua.nombre as unidad_nombre, ua.calle as unidad_calle, ua.numero as unidad_numero,
             ua.localidad as unidad_localidad, ua.latitud as unidad_latitud, ua.longitud as unidad_longitud
      FROM horarios_medicos hm
      LEFT JOIN unidades_atencion ua ON hm.unidad_id = ua.id
      WHERE hm.medico_id IN (?) AND hm.dia_semana IN ('Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes')
      ORDER BY FIELD(hm.dia_semana, 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'), hm.hora_inicio ASC
    `, [doctorIds]);

    // Obtener coberturas médicas aceptadas
    const [obrasRows] = await pool.query(`
      SELECT mos.usuario_id as medico_id, os.id, os.nombre
      FROM medicos_obras_sociales mos
      JOIN obras_sociales os ON mos.obra_social_id = os.id
      WHERE mos.usuario_id IN (?)
      ORDER BY os.nombre ASC
    `, [doctorIds]);

    const horariosByMedico = {};
    for (const h of horariosRows) {
      if (!horariosByMedico[h.medico_id]) horariosByMedico[h.medico_id] = [];
      horariosByMedico[h.medico_id].push(h);
    }

    const obrasByMedico = {};
    for (const o of obrasRows) {
      if (!obrasByMedico[o.medico_id]) obrasByMedico[o.medico_id] = [];
      obrasByMedico[o.medico_id].push({ id: o.id, nombre: o.nombre });
    }

    const data = rows.map((med) => {
      const especialidades = (med.especialidades_raw || '')
        .split('||')
        .filter(Boolean)
        .map((item) => {
          const [id, nombre] = item.split(':');
          return { id: parseInt(id, 10), nombre };
        });

      let sedes = (med.sedes_raw || '')
        .split('||')
        .filter(Boolean)
        .map((item) => {
          const parts = item.split(':');
          return { id: parseInt(parts[0], 10), nombre: parts[1], direccion: parts[2] || '' };
        });

      // Si no tiene sedes en horarios pero tiene dirección registrada, mostrarla
      if (sedes.length === 0 && med.direccion) {
        sedes = [{ id: 0, nombre: med.direccion, direccion: med.direccion }];
      }

      return {
        id: med.id,
        nombre: med.nombre,
        apellido: med.apellido,
        email: med.email,
        matricula: med.matricula,
        foto_perfil: med.foto_perfil,
        biografia: med.biografia,
        direccion: med.direccion,
        dias_antelacion_agenda: med.dias_antelacion_agenda,
        dia_apertura_agenda: med.dia_apertura_agenda,
        especialidades,
        sedes,
        horarios: horariosByMedico[med.id] || [],
        obras_sociales: obrasByMedico[med.id] || []
      };
    });

    res.json({ status: 'success', data });
  } catch (error) {
    console.error('Error en /medicos:', error);
    res.status(500).json({ status: 'error', message: 'Error al buscar profesionales.' });
  }
});

// 5. Perfil de un médico específico
router.get('/medicos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT id, nombre, apellido, email, matricula, foto_perfil, biografia, direccion,
              dias_antelacion_agenda, dia_apertura_agenda
       FROM usuarios WHERE id = ? AND rol = 'medico' LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Médico no encontrado.' });
    }

    const medico = rows[0];

    // Especialidades
    const [esp] = await pool.query(
      `SELECT e.id, e.nombre FROM especialidades e
       JOIN medicos_especialidades me ON e.id = me.especialidad_id
       WHERE me.usuario_id = ?`,
      [id]
    );

    // Obras Sociales atendidas
    const [obras] = await pool.query(
      `SELECT os.id, os.nombre FROM obras_sociales os
       JOIN medicos_obras_sociales mos ON os.id = mos.obra_social_id
       WHERE mos.usuario_id = ? ORDER BY os.nombre ASC`,
      [id]
    );

    // Horarios semanales
    const [horarios] = await pool.query(
      `SELECT hm.id, hm.dia_semana, hm.hora_inicio, hm.hora_fin, hm.duracion_turno_minutos,
              ua.id as unidad_id, ua.nombre as unidad_nombre, ua.calle, ua.numero
       FROM horarios_medicos hm
       LEFT JOIN unidades_atencion ua ON hm.unidad_id = ua.id
       WHERE hm.medico_id = ?
       ORDER BY FIELD(hm.dia_semana, 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'), hm.hora_inicio ASC`,
      [id]
    );

    res.json({
      status: 'success',
      data: {
        ...medico,
        especialidades: esp,
        obras_sociales: obras,
        horarios
      }
    });
  } catch (error) {
    console.error('Error en /medicos/:id:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener detalle del médico.' });
  }
});

// 6. Consultar disponibilidad y turnos de un día
router.get('/disponibilidad', async (req, res) => {
  try {
    const { medico_id, fecha } = req.query;

    if (!medico_id || !fecha) {
      return res.status(400).json({ status: 'error', message: 'Se requiere medico_id y fecha (YYYY-MM-DD).' });
    }

    // Validar formato fecha
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ status: 'error', message: 'Formato de fecha inválido. Usar YYYY-MM-DD.' });
    }

    // Datos del médico y sus reglas de antelación
    const [medRows] = await pool.query(
      'SELECT id, dias_antelacion_agenda, dia_apertura_agenda FROM usuarios WHERE id = ? AND rol = "medico" LIMIT 1',
      [medico_id]
    );

    if (medRows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Médico no encontrado.' });
    }

    const medico = medRows[0];
    const targetDate = new Date(fecha + 'T12:00:00Z');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Comprobar si la fecha es en el pasado
    const targetDateZero = new Date(fecha + 'T00:00:00Z');
    const todayZero = new Date(today.toISOString().split('T')[0] + 'T00:00:00Z');
    if (targetDateZero < todayZero) {
      return res.json({ status: 'success', data: [], slots: [], message: 'La fecha seleccionada ya pasó.' });
    }

    // Si el médico tiene un día fijo de apertura cada mes (ej: día 10), y hoy aún no llegó ese día
    const currentDayOfMonth = new Date().getDate();
    if (medico.dia_apertura_agenda && Number(medico.dia_apertura_agenda) > 0) {
      const diaApertura = Number(medico.dia_apertura_agenda);
      if (currentDayOfMonth < diaApertura) {
        return res.json({
          status: 'success',
          agenda_cerrada: true,
          dia_apertura: diaApertura,
          slots: [],
          message: `La agenda de turnos para este profesional se abre a partir del día ${diaApertura} de cada mes.`
        });
      }
    }

    // Antelación máxima
    let maxDias = 90;
    if (medico.dias_antelacion_agenda && Number(medico.dias_antelacion_agenda) > 0) {
      maxDias = Number(medico.dias_antelacion_agenda);
    } else {
      try {
        const [confRows] = await pool.query("SELECT valor FROM configuracion WHERE clave = 'meses_agenda' LIMIT 1");
        const meses = confRows.length > 0 ? parseInt(confRows[0].valor, 10) : 3;
        maxDias = (meses || 3) * 30;
      } catch (err) {
        maxDias = 90;
      }
    }

    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + maxDias);

    if (targetDate > maxDate) {
      return res.json({
        status: 'success',
        slots: [],
        message: `La agenda de este profesional solo está habilitada hasta ${maxDias} días hacia adelante.`
      });
    }

    // Obtener día de la semana
    const dayOfWeekIndex = targetDate.getUTCDay();
    const diaNombre = DIAS_MAP[dayOfWeekIndex];

    // Buscar horarios configurados para ese día de la semana
    const [horarios] = await pool.query(
      `SELECT hm.id, hm.hora_inicio, hm.hora_fin, hm.duracion_turno_minutos,
              ua.id as unidad_id, ua.nombre as unidad_nombre, ua.calle, ua.numero
       FROM horarios_medicos hm
       LEFT JOIN unidades_atencion ua ON hm.unidad_id = ua.id
       WHERE hm.medico_id = ? AND hm.dia_semana = ?
       ORDER BY hm.hora_inicio ASC`,
      [medico_id, diaNombre]
    );

    if (horarios.length === 0) {
      return res.json({ status: 'success', slots: [], message: `El profesional no atiende los días ${diaNombre}.` });
    }

    // Buscar turnos ya asignados u ocupados para esa fecha
    const [turnosOcupados] = await pool.query(
      `SELECT id, hora_inicio, hora_fin, estado
       FROM turnos
       WHERE medico_id = ? AND fecha = ? AND estado NOT IN ('cancelado', 'libre')`,
      [medico_id, fecha]
    );

    const horasOcupadas = new Set(
      turnosOcupados.map((t) => t.hora_inicio.substring(0, 5))
    );

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

        const isTaken = horasOcupadas.has(slotStartStr);

        slots.push({
          hora_inicio: slotStartStr,
          hora_fin: slotEndStr,
          disponible: !isTaken,
          unidad_id: h.unidad_id,
          unidad_nombre: h.unidad_nombre,
          direccion: h.calle && h.numero ? `${h.calle} ${h.numero}` : null
        });

        currentH = nextH;
        currentM = nextM;
      }
    }

    res.json({ status: 'success', fecha, dia_semana: diaNombre, slots });
  } catch (error) {
    console.error('Error en /disponibilidad:', error);
    res.status(500).json({ status: 'error', message: 'Error al consultar disponibilidad.' });
  }
});

// 7. Agendar turno (Público o Autenticado)
router.post('/agendar', optionalAuth, async (req, res) => {
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
    } = req.body;

    if (!medico_id || !fecha || !hora_inicio) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'Faltan datos requeridos (médico, fecha, horario).' });
    }

    let pacienteId = req.user ? req.user.id : null;

    // Si no está logueado, buscar o crear al paciente por DNI o Email
    if (!pacienteId) {
      if (!paciente || !paciente.nombre || !paciente.dni || !paciente.email) {
        await connection.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Debes proporcionar nombre, apellido, DNI y email del paciente para agendar.'
        });
      }

      const cleanDni = normalizeDni(paciente.dni);
      const cleanEmail = paciente.email.trim().toLowerCase();

      // Buscar si ya existe paciente con este DNI
      const [existingUser] = await connection.query(
        'SELECT id, rol FROM usuarios WHERE dni = ? OR LOWER(email) = ? LIMIT 1',
        [cleanDni, cleanEmail]
      );

      if (existingUser.length > 0) {
        pacienteId = existingUser[0].id;
        // Actualizar datos de contacto si cambiaron
        await connection.query(
          `UPDATE usuarios SET 
            telefono = COALESCE(?, telefono),
            obra_social_id = COALESCE(?, obra_social_id),
            plan_id = COALESCE(?, plan_id)
           WHERE id = ?`,
          [paciente.telefono || null, obra_social_id || null, plan_id || null, pacienteId]
        );
      } else {
        // Crear nuevo paciente
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
            obra_social_id || null,
            plan_id || null
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

    // Comprobar si el turno ya fue reservado (control de concurrencia)
    const [conflict] = await connection.query(
      `SELECT id FROM turnos 
       WHERE medico_id = ? AND fecha = ? AND hora_inicio = ? 
         AND estado NOT IN ('cancelado', 'libre') 
       FOR UPDATE`,
      [medico_id, fecha, hora_inicio]
    );

    if (conflict.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        status: 'error',
        message: 'El horario seleccionado acaba de ser reservado por otra persona. Por favor selecciona otro turno.'
      });
    }

    // Comprobar si el paciente ya tiene otro turno con el mismo médico el mismo día
    const [patientConflict] = await connection.query(
      `SELECT id FROM turnos
       WHERE paciente_id = ? AND medico_id = ? AND fecha = ? AND estado NOT IN ('cancelado') LIMIT 1`,
      [pacienteId, medico_id, fecha]
    );

    if (patientConflict.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Ya tienes un turno reservado con este profesional en la misma fecha.'
      });
    }

    // Insertar el nuevo turno
    const [result] = await connection.query(
      `INSERT INTO turnos (
        medico_id, paciente_id, especialidad_id, obra_social_id, plan_id, unidad_id,
        fecha, hora_inicio, hora_fin, estado, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmado', ?)`,
      [
        medico_id,
        pacienteId,
        especialidad_id || null,
        obra_social_id || null,
        plan_id || null,
        unidad_id || null,
        fecha,
        hora_inicio,
        calculatedHoraFin,
        notas || null
      ]
    );

    await connection.commit();

    // Obtener detalles del turno para respuesta clara
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

    res.status(201).json({
      status: 'success',
      message: '¡Turno reservado exitosamente!',
      turno: created[0]
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error en /agendar:', error);
    res.status(500).json({ status: 'error', message: 'No se pudo agendar el turno. Intenta nuevamente.' });
  } finally {
    connection.release();
  }
});

module.exports = router;
