const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireRole(['medico', 'admin', 'superadmin']));

// Agenda del médico por fecha (incluye turnos ocupados y slots libres/vacíos)
router.get('/agenda', async (req, res) => {
  try {
    const medicoId = req.user.rol === 'medico' ? req.user.id : (req.query.medico_id || req.user.id);
    const { fecha, desde, hasta, estado, q, incluir_vacios = '1' } = req.query;

    // Si viene una fecha puntual (ej: 2026-10-14), generamos la grilla completa con turnos vacíos y ocupados
    if (fecha && (incluir_vacios === '1' || incluir_vacios === 'true')) {
      const DIAS_MAP = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
      const targetDate = new Date(fecha + 'T12:00:00Z');
      const diaNombre = DIAS_MAP[targetDate.getUTCDay()];

      // 1. Verificar suspensión médica
      const [suspRows] = await pool.query(
        'SELECT id, motivo FROM medicos_suspensiones WHERE medico_id = ? AND ? BETWEEN fecha_inicio AND fecha_fin LIMIT 1',
        [medicoId, fecha]
      );
      const suspendido = suspRows.length > 0;
      const motivoSuspension = suspendido ? (suspRows[0].motivo || 'Atención médica suspendida') : null;

      // 2. Horarios semanales configurados para este día
      const [horarios] = await pool.query(
        `SELECT hm.id, hm.hora_inicio, hm.hora_fin, hm.duracion_turno_minutos,
                ua.id as unidad_id, ua.nombre as unidad_nombre, ua.calle, ua.numero
         FROM horarios_medicos hm
         LEFT JOIN unidades_atencion ua ON hm.unidad_id = ua.id
         WHERE hm.medico_id = ? AND hm.dia_semana = ?
         ORDER BY hm.hora_inicio ASC`,
        [medicoId, diaNombre]
      );

      // 3. Turnos reservados para esa fecha
      let turnosSql = `
        SELECT t.id, DATE_FORMAT(t.fecha, '%Y-%m-%d') as fecha, t.hora_inicio, t.hora_fin, t.estado, t.notas, t.creado_en,
               p.id as paciente_id, p.nombre as paciente_nombre, p.apellido as paciente_apellido,
               p.dni as paciente_dni, p.telefono as paciente_telefono, p.tiene_whatsapp as paciente_whatsapp,
               p.email as paciente_email,
               e.nombre as especialidad_nombre,
               os.nombre as obra_social_nombre,
               pl.nombre as plan_nombre,
               ua.id as unidad_id,
               ua.nombre as unidad_nombre
        FROM turnos t
        JOIN usuarios p ON t.paciente_id = p.id
        LEFT JOIN especialidades e ON t.especialidad_id = e.id
        LEFT JOIN obras_sociales os ON t.obra_social_id = os.id
        LEFT JOIN planes_obras_sociales pl ON t.plan_id = pl.id
        LEFT JOIN unidades_atencion ua ON t.unidad_id = ua.id
        WHERE t.medico_id = ? AND t.fecha = ?
      `;
      const turnosParams = [medicoId, fecha];

      if (q && q.trim()) {
        const term = `%${q.trim()}%`;
        turnosSql += ' AND (p.nombre LIKE ? OR p.apellido LIKE ? OR p.dni LIKE ? OR os.nombre LIKE ?)';
        turnosParams.push(term, term, term, term);
      }

      turnosSql += ' ORDER BY t.hora_inicio ASC';
      const [turnosRows] = await pool.query(turnosSql, turnosParams);

      // 4. Mapear turnos ocupados
      const turnosMap = new Map();
      const processedTurnoIds = new Set();
      for (const t of turnosRows) {
        const key = t.hora_inicio.substring(0, 5);
        if (!turnosMap.has(key) && t.estado !== 'cancelado') {
          turnosMap.set(key, t);
        }
      }

      const pad = (n) => String(n).padStart(2, '0');
      const allSlots = [];

      // 5. Generar slots a partir de los bloques de horario
      for (const h of horarios) {
        const dur = h.duracion_turno_minutos || 30;
        let [currentH, currentM] = h.hora_inicio.split(':').map(Number);
        const [endH, endM] = h.hora_fin.split(':').map(Number);
        const totalEndMinutes = endH * 60 + endM;

        while (currentH * 60 + currentM < totalEndMinutes) {
          const slotStart = `${pad(currentH)}:${pad(currentM)}`;
          let nextM = currentM + dur;
          let nextH = currentH;
          if (nextM >= 60) {
            nextH += Math.floor(nextM / 60);
            nextM = nextM % 60;
          }
          const slotEnd = `${pad(nextH)}:${pad(nextM)}`;

          if (turnosMap.has(slotStart)) {
            const turno = turnosMap.get(slotStart);
            processedTurnoIds.add(turno.id);
            allSlots.push({
              ...turno,
              hora_inicio: slotStart,
              hora_fin: turno.hora_fin ? turno.hora_fin.substring(0, 5) : slotEnd,
              tipo: 'ocupado',
              disponible: false,
              unidad_id: turno.unidad_id || h.unidad_id,
              unidad_nombre: turno.unidad_nombre || h.unidad_nombre
            });
          } else {
            allSlots.push({
              id: `vacio_${slotStart}`,
              fecha: fecha,
              hora_inicio: slotStart,
              hora_fin: slotEnd,
              estado: 'libre',
              tipo: 'vacio',
              disponible: true,
              paciente_id: null,
              paciente_nombre: null,
              paciente_apellido: null,
              paciente_dni: null,
              paciente_telefono: null,
              paciente_whatsapp: 0,
              paciente_email: null,
              obra_social_nombre: null,
              plan_nombre: null,
              unidad_id: h.unidad_id,
              unidad_nombre: h.unidad_nombre
            });
          }

          currentH = nextH;
          currentM = nextM;
        }
      }

      // 6. Añadir turnos que no coincidieron con bloques regulares (sobreturnos o cancelados)
      for (const t of turnosRows) {
        if (!processedTurnoIds.has(t.id)) {
          allSlots.push({
            ...t,
            hora_inicio: t.hora_inicio.substring(0, 5),
            hora_fin: t.hora_fin ? t.hora_fin.substring(0, 5) : null,
            tipo: t.estado === 'cancelado' ? 'cancelado' : 'ocupado',
            sobreturno: true,
            disponible: false
          });
        }
      }

      // Ordenar por hora_inicio ASC
      allSlots.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

      const ocupadosCount = allSlots.filter(s => s.tipo === 'ocupado').length;
      const libresCount = allSlots.filter(s => s.tipo === 'vacio').length;

      // Filtrar por estado si se solicitó
      let filteredSlots = allSlots;
      if (estado) {
        if (estado === 'libre' || estado === 'vacio') {
          filteredSlots = allSlots.filter(s => s.tipo === 'vacio');
        } else if (estado === 'ocupado') {
          filteredSlots = allSlots.filter(s => s.tipo === 'ocupado');
        } else {
          filteredSlots = allSlots.filter(s => s.estado === estado);
        }
      }

      return res.json({
        status: 'success',
        data: filteredSlots,
        meta: {
          fecha,
          dia_semana: diaNombre,
          total_slots: allSlots.length,
          ocupados: ocupadosCount,
          libres: libresCount,
          suspendido,
          motivo_suspension: motivoSuspension,
          tiene_bloques: horarios.length > 0
        }
      });
    }

    // Consulta estándar si no hay fecha puntual o no incluye vacíos
    let query = `
      SELECT t.id, DATE_FORMAT(t.fecha, '%Y-%m-%d') as fecha, t.hora_inicio, t.hora_fin, t.estado, t.notas, t.creado_en,
             p.id as paciente_id, p.nombre as paciente_nombre, p.apellido as paciente_apellido,
             p.dni as paciente_dni, p.telefono as paciente_telefono, p.tiene_whatsapp as paciente_whatsapp,
             p.email as paciente_email,
             e.nombre as especialidad_nombre,
             os.nombre as obra_social_nombre,
             pl.nombre as plan_nombre,
             ua.nombre as unidad_nombre
      FROM turnos t
      JOIN usuarios p ON t.paciente_id = p.id
      LEFT JOIN especialidades e ON t.especialidad_id = e.id
      LEFT JOIN obras_sociales os ON t.obra_social_id = os.id
      LEFT JOIN planes_obras_sociales pl ON t.plan_id = pl.id
      LEFT JOIN unidades_atencion ua ON t.unidad_id = ua.id
      WHERE t.medico_id = ?
    `;
    const params = [medicoId];

    if (fecha) {
      query += ' AND t.fecha = ?';
      params.push(fecha);
    } else if (desde && hasta) {
      query += ' AND t.fecha BETWEEN ? AND ?';
      params.push(desde, hasta);
    } else {
      query += ' AND t.fecha >= CURDATE()';
    }

    if (estado) {
      query += ' AND t.estado = ?';
      params.push(estado);
    }

    query += ' ORDER BY t.fecha ASC, t.hora_inicio ASC';

    const [rows] = await pool.query(query, params);
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error en /medico/agenda:', error);
    res.status(500).json({ status: 'error', message: 'Error al consultar agenda médica.' });
  }
});

// Cambiar estado de un turno (asistió, ausente, cancelado, etc.)
router.put('/turnos/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, notas } = req.body;
    const medicoId = req.user.rol === 'medico' ? req.user.id : null;

    const validStates = ['libre', 'pendiente', 'confirmado', 'asignado', 'asistio', 'ausente', 'cancelado'];
    if (!validStates.includes(estado)) {
      return res.status(400).json({ status: 'error', message: 'Estado inválido.' });
    }

    let query = 'UPDATE turnos SET estado = ?';
    const params = [estado];

    if (typeof notas === 'string') {
      query += ', notas = ?';
      params.push(notas);
    }

    query += ' WHERE id = ?';
    params.push(id);

    if (medicoId) {
      query += ' AND medico_id = ?';
      params.push(medicoId);
    }

    const [result] = await pool.query(query, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Turno no encontrado o no asignado a este profesional.' });
    }

    res.json({ status: 'success', message: 'Estado del turno actualizado correctamente.' });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ status: 'error', message: 'Error al actualizar el estado del turno.' });
  }
});

// Obtener estadísticas personales del médico logueado
router.get('/stats', async (req, res) => {
  try {
    const medicoId = req.user.id;
    const [[turnosHoy]] = await pool.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN estado IN ('confirmado', 'asignado') THEN 1 ELSE 0 END) as confirmados,
        SUM(CASE WHEN estado = 'asistio' THEN 1 ELSE 0 END) as asistieron,
        SUM(CASE WHEN estado = 'ausente' THEN 1 ELSE 0 END) as ausentes,
        SUM(CASE WHEN estado = 'cancelado' THEN 1 ELSE 0 END) as cancelados
       FROM turnos WHERE medico_id = ? AND fecha = CURDATE()`,
      [medicoId]
    );

    const [[totales]] = await pool.query(
      `SELECT 
        COUNT(DISTINCT paciente_id) as total_pacientes,
        COUNT(*) as turnos_futuros
       FROM turnos WHERE medico_id = ? AND fecha >= CURDATE() AND estado NOT IN ('cancelado')`,
      [medicoId]
    );

    res.json({
      status: 'success',
      data: {
        hoy: turnosHoy || { total: 0, confirmados: 0, asistieron: 0, ausentes: 0, cancelados: 0 },
        totales: {
          total_pacientes: totales?.total_pacientes || 0,
          turnos_futuros: totales?.turnos_futuros || 0
        }
      }
    });
  } catch (error) {
    console.error('Error en /medico/stats:', error);
    res.status(500).json({ status: 'error', message: 'Error al consultar estadísticas del médico.' });
  }
});

// Obtener perfil del médico logueado
router.get('/perfil', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, nombre, apellido, username, email, dni, matricula, slug, telefono, biografia, direccion,
              foto_perfil, mensaje_paciente, dias_antelacion_agenda, dia_apertura_agenda, acepta_particular,
              honorarios_particular, mostrar_honorarios
       FROM usuarios WHERE id = ? AND rol = 'medico' LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Perfil médico no encontrado.' });
    }

    res.json({ status: 'success', data: rows[0] });
  } catch (error) {
    console.error('Error en GET /medico/perfil:', error);
    res.status(500).json({ status: 'error', message: 'Error al consultar perfil médico.' });
  }
});

// Actualizar perfil completo del médico logueado (CRUD de su propia ficha)
router.put('/perfil', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const medicoId = req.user.id;
    const {
      nombre,
      apellido,
      username,
      email,
      dni,
      matricula,
      password,
      telefono,
      biografia,
      direccion,
      foto_perfil,
      mensaje_paciente,
      acepta_particular,
      honorarios_particular,
      mostrar_honorarios,
      dias_antelacion_agenda,
      dia_apertura_agenda
    } = req.body;

    // Validar nombre y apellido si se envían
    if (nombre !== undefined && !nombre.trim()) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'El nombre no puede estar vacío.' });
    }
    if (apellido !== undefined && !apellido.trim()) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'El apellido no puede estar vacío.' });
    }

    // Validar username único si se actualiza
    let cleanUsername = undefined;
    if (username !== undefined) {
      cleanUsername = username && username.trim() ? username.trim().toLowerCase().replace(/\s+/g, '') : null;
      if (cleanUsername) {
        const [uRows] = await connection.query('SELECT id FROM usuarios WHERE LOWER(username) = ? AND id != ? LIMIT 1', [cleanUsername, medicoId]);
        if (uRows.length > 0) {
          await connection.rollback();
          return res.status(400).json({ status: 'error', message: 'El nombre de usuario ya está en uso por otra cuenta.' });
        }
      }
    }

    // Validar email único si se actualiza
    let cleanEmail = undefined;
    if (email !== undefined) {
      cleanEmail = email && email.trim() ? email.trim().toLowerCase() : null;
      if (cleanEmail) {
        const [eRows] = await connection.query('SELECT id FROM usuarios WHERE LOWER(email) = ? AND id != ? LIMIT 1', [cleanEmail, medicoId]);
        if (eRows.length > 0) {
          await connection.rollback();
          return res.status(400).json({ status: 'error', message: 'El correo electrónico ya está registrado por otra cuenta.' });
        }
      }
    }

    // Validar DNI único si se actualiza
    if (dni !== undefined && dni && String(dni).trim()) {
      const cleanDni = String(dni).trim();
      const [dRows] = await connection.query('SELECT id FROM usuarios WHERE dni = ? AND id != ? LIMIT 1', [cleanDni, medicoId]);
      if (dRows.length > 0) {
        await connection.rollback();
        return res.status(400).json({ status: 'error', message: 'El DNI ya se encuentra registrado por otra cuenta.' });
      }
    }

    let updateSql = `
      UPDATE usuarios SET
        nombre = COALESCE(?, nombre),
        apellido = COALESCE(?, apellido),
        username = (CASE WHEN ? = 1 THEN ? ELSE username END),
        email = (CASE WHEN ? = 1 THEN ? ELSE email END),
        dni = (CASE WHEN ? = 1 THEN ? ELSE dni END),
        matricula = COALESCE(?, matricula),
        telefono = COALESCE(?, telefono),
        biografia = COALESCE(?, biografia),
        direccion = COALESCE(?, direccion),
        mensaje_paciente = (CASE WHEN ? = 1 THEN ? ELSE mensaje_paciente END),
        foto_perfil = (CASE WHEN ? = 1 THEN ? ELSE foto_perfil END),
        acepta_particular = COALESCE(?, acepta_particular),
        honorarios_particular = ?,
        mostrar_honorarios = COALESCE(?, mostrar_honorarios),
        dias_antelacion_agenda = COALESCE(?, dias_antelacion_agenda),
        dia_apertura_agenda = ?
    `;

    const params = [
      nombre ? nombre.trim() : null,
      apellido ? apellido.trim() : null,
      cleanUsername !== undefined ? 1 : 0,
      cleanUsername !== undefined ? cleanUsername : null,
      cleanEmail !== undefined ? 1 : 0,
      cleanEmail !== undefined ? cleanEmail : null,
      dni !== undefined ? 1 : 0,
      dni !== undefined ? (dni ? String(dni).trim() : null) : null,
      matricula !== undefined ? matricula : null,
      telefono !== undefined ? telefono : null,
      biografia !== undefined ? biografia : null,
      direccion !== undefined ? direccion : null,
      mensaje_paciente !== undefined ? 1 : 0,
      mensaje_paciente !== undefined ? (mensaje_paciente ? mensaje_paciente.trim() : null) : null,
      foto_perfil !== undefined ? 1 : 0,
      foto_perfil !== undefined ? (foto_perfil || null) : null,
      acepta_particular !== undefined ? (acepta_particular ? 1 : 0) : null,
      honorarios_particular !== undefined ? (honorarios_particular !== '' && honorarios_particular !== null && !isNaN(Number(honorarios_particular)) ? Number(honorarios_particular) : null) : null,
      mostrar_honorarios !== undefined ? (mostrar_honorarios ? 1 : 0) : null,
      dias_antelacion_agenda !== undefined ? (dias_antelacion_agenda !== '' ? parseInt(dias_antelacion_agenda, 10) : null) : null,
      dia_apertura_agenda !== undefined ? (dia_apertura_agenda !== '' ? parseInt(dia_apertura_agenda, 10) : null) : null
    ];

    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      const passHash = await bcrypt.hash(password.trim(), salt);
      updateSql += ', contrasena = ?';
      params.push(passHash);
    }

    updateSql += ' WHERE id = ? AND rol = "medico"';
    params.push(medicoId);

    await connection.query(updateSql, params);
    await connection.commit();

    // Obtener perfil actualizado para devolverlo al cliente
    const [updatedRows] = await pool.query(
      `SELECT id, nombre, apellido, username, email, dni, matricula, slug, telefono, biografia, direccion,
              foto_perfil, mensaje_paciente, dias_antelacion_agenda, dia_apertura_agenda, acepta_particular,
              honorarios_particular, mostrar_honorarios
       FROM usuarios WHERE id = ? LIMIT 1`,
      [medicoId]
    );

    res.json({
      status: 'success',
      message: 'Ficha profesional y configuración actualizadas correctamente.',
      data: updatedRows[0]
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error en PUT /medico/perfil:', error);
    res.status(500).json({ status: 'error', message: 'Error al actualizar ficha del médico.' });
  } finally {
    connection.release();
  }
});

// Subir o quitar foto de perfil del médico
router.post('/foto', async (req, res) => {
  try {
    const medicoId = req.user.id;
    const { foto } = req.body; // base64 data string o null

    if (!foto) {
      // Eliminar foto de perfil
      await pool.query('UPDATE usuarios SET foto_perfil = NULL WHERE id = ?', [medicoId]);
      return res.json({ status: 'success', message: 'Foto de perfil eliminada.', foto_perfil: null });
    }

    // Si viene en formato data:image/...;base64,...
    const matches = String(foto).match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ status: 'error', message: 'Formato de imagen inválido. Debe ser una imagen en base64.' });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    let ext = 'jpg';
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('jpeg')) ext = 'jpg';

    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `avatar_medico_${medicoId}_${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/turnos/uploads/${filename}`;
    await pool.query('UPDATE usuarios SET foto_perfil = ? WHERE id = ?', [relativeUrl, medicoId]);

    res.json({
      status: 'success',
      message: 'Foto de perfil actualizada exitosamente.',
      foto_perfil: relativeUrl
    });
  } catch (error) {
    console.error('Error al subir foto:', error);
    res.status(500).json({ status: 'error', message: 'Error al procesar la foto de perfil.' });
  }
});

// ==========================================
// SUSPENSIÓN DE TURNOS / ATENCIÓN MÉDICA
// ==========================================

// Listar suspensiones del médico
router.get('/suspensiones', async (req, res) => {
  try {
    const medicoId = req.user.id;
    const [rows] = await pool.query(
      `SELECT s.id, 
              DATE_FORMAT(s.fecha_inicio, '%Y-%m-%d') as fecha_inicio,
              DATE_FORMAT(s.fecha_fin, '%Y-%m-%d') as fecha_fin,
              s.motivo, s.creado_en
       FROM medicos_suspensiones s
       WHERE s.medico_id = ?
       ORDER BY s.fecha_inicio DESC`,
      [medicoId]
    );
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error en GET /medico/suspensiones:', error);
    res.status(500).json({ status: 'error', message: 'Error al consultar suspensiones.' });
  }
});

// Consultar pacientes afectados por un rango de fechas a suspender
router.get('/suspensiones/afectados', async (req, res) => {
  try {
    const medicoId = req.user.id;
    const { desde, hasta } = req.query;

    if (!desde || !hasta) {
      return res.status(400).json({ status: 'error', message: 'Se requieren parámetros desde y hasta (YYYY-MM-DD).' });
    }

    const [rows] = await pool.query(
      `SELECT t.id, 
              DATE_FORMAT(t.fecha, '%Y-%m-%d') as fecha,
              t.hora_inicio, t.hora_fin, t.estado, t.notas,
              p.id as paciente_id, p.nombre as paciente_nombre, p.apellido as paciente_apellido,
              p.dni as paciente_dni, p.telefono as paciente_telefono, p.tiene_whatsapp as paciente_whatsapp,
              p.email as paciente_email,
              os.nombre as obra_social_nombre,
              pl.nombre as plan_nombre,
              m.nombre as medico_nombre, m.apellido as medico_apellido
       FROM turnos t
       JOIN usuarios p ON t.paciente_id = p.id
       JOIN usuarios m ON t.medico_id = m.id
       LEFT JOIN obras_sociales os ON t.obra_social_id = os.id
       LEFT JOIN planes_obras_sociales pl ON t.plan_id = pl.id
       WHERE t.medico_id = ? 
         AND t.fecha BETWEEN ? AND ? 
         AND t.estado NOT IN ('cancelado', 'libre')
       ORDER BY t.fecha ASC, t.hora_inicio ASC`,
      [medicoId, desde, hasta]
    );

    res.json({ status: 'success', data: rows, total: rows.length });
  } catch (error) {
    console.error('Error en GET /medico/suspensiones/afectados:', error);
    res.status(500).json({ status: 'error', message: 'Error al consultar turnos afectados.' });
  }
});

// Crear nueva suspensión de turnos y opcionalmente cancelar/marcar los turnos
router.post('/suspensiones', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const medicoId = req.user.id;
    const { fecha_inicio, fecha_fin, motivo, cancelar_turnos = true } = req.body;

    if (!fecha_inicio || !fecha_fin) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'Fecha de inicio y fin son requeridas.' });
    }

    if (fecha_fin < fecha_inicio) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'La fecha de fin no puede ser anterior a la de inicio.' });
    }

    // Insertar registro de suspensión
    const [result] = await connection.query(
      `INSERT INTO medicos_suspensiones (medico_id, fecha_inicio, fecha_fin, motivo)
       VALUES (?, ?, ?, ?)`,
      [medicoId, fecha_inicio, fecha_fin, motivo || 'Suspensión de atención por el profesional']
    );

    const suspensionId = result.insertId;

    // Obtener turnos afectados
    const [afectados] = await connection.query(
      `SELECT t.id, DATE_FORMAT(t.fecha, '%Y-%m-%d') as fecha, t.hora_inicio, t.hora_fin, t.estado,
              p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.telefono as paciente_telefono
       FROM turnos t
       JOIN usuarios p ON t.paciente_id = p.id
       WHERE t.medico_id = ? 
         AND t.fecha BETWEEN ? AND ? 
         AND t.estado NOT IN ('cancelado', 'libre')`,
      [medicoId, fecha_inicio, fecha_fin]
    );

    // Si se indicó cancelar los turnos automáticamente
    if (cancelar_turnos && afectados.length > 0) {
      const notaCancel = motivo ? `Suspendido por el profesional: ${motivo}` : 'Atención suspendida por el profesional';
      await connection.query(
        `UPDATE turnos 
         SET estado = 'cancelado', notas = CONCAT(COALESCE(notas, ''), ' [', ?, ']')
         WHERE medico_id = ? AND fecha BETWEEN ? AND ? AND estado NOT IN ('cancelado', 'libre')`,
        [notaCancel, medicoId, fecha_inicio, fecha_fin]
      );
    }

    await connection.commit();

    res.status(201).json({
      status: 'success',
      message: `Suspensión registrada exitosamente. Se identificaron ${afectados.length} turno(s) en ese período.`,
      suspension_id: suspensionId,
      afectados_count: afectados.length,
      afectados
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al registrar suspensión:', error);
    res.status(500).json({ status: 'error', message: 'Error al registrar la suspensión.' });
  } finally {
    connection.release();
  }
});

// Eliminar / levantar suspensión de turnos
router.delete('/suspensiones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const medicoId = req.user.id;

    const [result] = await pool.query(
      'DELETE FROM medicos_suspensiones WHERE id = ? AND medico_id = ?',
      [id, medicoId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Suspensión no encontrada o no pertenece a este profesional.' });
    }

    res.json({ status: 'success', message: 'La suspensión fue eliminada. Las fechas vuelven a estar habilitadas en tu agenda.' });
  } catch (error) {
    console.error('Error al eliminar suspensión:', error);
    res.status(500).json({ status: 'error', message: 'Error al eliminar la suspensión.' });
  }
});

// Obtener horarios de atención del médico logueado
router.get('/horarios', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, dia_semana, hora_inicio, hora_fin, duracion_turno_minutos, unidad_id
       FROM horarios_medicos WHERE medico_id = ?
       ORDER BY FIELD(dia_semana, 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'), hora_inicio ASC`,
      [req.user.id]
    );
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error en GET /medico/horarios:', error);
    res.status(500).json({ status: 'error', message: 'Error al consultar horarios.' });
  }
});

// Guardar horarios de atención del médico logueado
router.put('/horarios', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const medicoId = req.user.id;
    const { bloques = [] } = req.body;

    await connection.query('DELETE FROM horarios_medicos WHERE medico_id = ?', [medicoId]);

    if (bloques.length > 0) {
      const values = bloques.map((b) => [
        medicoId,
        b.dia_semana,
        b.hora_inicio,
        b.hora_fin,
        b.duracion_turno_minutos || 30,
        b.unidad_id || null
      ]);

      await connection.query(
        'INSERT INTO horarios_medicos (medico_id, dia_semana, hora_inicio, hora_fin, duracion_turno_minutos, unidad_id) VALUES ?',
        [values]
      );
    }

    await connection.commit();
    res.json({ status: 'success', message: 'Tus horarios de atención fueron guardados correctamente.' });
  } catch (error) {
    await connection.rollback();
    console.error('Error al guardar horarios en /medico/horarios:', error);
    res.status(500).json({ status: 'error', message: 'Error al guardar horarios.' });
  } finally {
    connection.release();
  }
});

// Obtener coberturas (Obras Sociales y Planes) del médico logueado
router.get('/coberturas', async (req, res) => {
  try {
    let [osRows] = await pool.query('SELECT obra_social_id FROM medicos_obras_sociales WHERE usuario_id = ?', [req.user.id]);
    let [planRows] = await pool.query('SELECT plan_id FROM medicos_planes WHERE usuario_id = ?', [req.user.id]);

    // Por default todos los planes y obras sociales marcados si el profesional no tiene guardadas
    if (osRows.length === 0) {
      const [allOs] = await pool.query('SELECT id FROM obras_sociales');
      osRows = allOs.map(r => ({ obra_social_id: r.id }));
    }
    if (planRows.length === 0) {
      const [allPlanes] = await pool.query('SELECT id FROM planes_obras_sociales');
      planRows = allPlanes.map(r => ({ plan_id: r.id }));
    }

    res.json({
      status: 'success',
      data: {
        obras_sociales: osRows.map(r => r.obra_social_id),
        planes: planRows.map(r => r.plan_id)
      }
    });
  } catch (error) {
    console.error('Error en GET /medico/coberturas:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener coberturas médicas.' });
  }
});

// Guardar coberturas del médico logueado
router.put('/coberturas', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const id = req.user.id;
    const { obras_sociales, planes } = req.body;
    await connection.beginTransaction();

    await connection.query('DELETE FROM medicos_planes WHERE usuario_id = ?', [id]);
    await connection.query('DELETE FROM medicos_obras_sociales WHERE usuario_id = ?', [id]);

    const osMap = new Set();
    if (Array.isArray(obras_sociales)) {
      obras_sociales.forEach(osid => {
        const val = parseInt(osid, 10);
        if (val > 0) osMap.add(val);
      });
    }

    if (Array.isArray(planes) && planes.length > 0) {
      const planValues = [];
      for (const pid of planes) {
        const val = parseInt(pid, 10);
        if (val > 0) {
          planValues.push([id, val]);
          const [osRow] = await connection.query('SELECT obra_social_id FROM planes_obras_sociales WHERE id = ?', [val]);
          if (osRow.length > 0) osMap.add(osRow[0].obra_social_id);
        }
      }
      if (planValues.length > 0) {
        await connection.query('INSERT INTO medicos_planes (usuario_id, plan_id) VALUES ?', [planValues]);
      }
    }

    if (osMap.size > 0) {
      const osValues = Array.from(osMap).map(osid => [id, osid]);
      await connection.query('INSERT INTO medicos_obras_sociales (usuario_id, obra_social_id) VALUES ?', [osValues]);
    }

    await connection.commit();
    res.json({ status: 'success', message: 'Coberturas actualizadas exitosamente.' });
  } catch (error) {
    await connection.rollback();
    console.error('Error al actualizar coberturas:', error);
    res.status(500).json({ status: 'error', message: 'Error al actualizar coberturas.' });
  } finally {
    connection.release();
  }
});

module.exports = router;
