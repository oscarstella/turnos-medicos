const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireRole(['medico', 'admin', 'superadmin']));

// Agenda del médico por fecha
router.get('/agenda', async (req, res) => {
  try {
    const medicoId = req.user.rol === 'medico' ? req.user.id : (req.query.medico_id || req.user.id);
    const { fecha, desde, hasta } = req.query;

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
      // Por defecto hoy en adelante 7 días
      query += ' AND t.fecha >= CURDATE()';
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
              dias_antelacion_agenda, dia_apertura_agenda, acepta_particular, honorarios_particular, mostrar_honorarios
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

// Actualizar perfil / honorarios particulares del médico logueado
router.put('/perfil', async (req, res) => {
  try {
    const {
      matricula,
      telefono,
      biografia,
      direccion,
      acepta_particular,
      honorarios_particular,
      mostrar_honorarios,
      dias_antelacion_agenda,
      dia_apertura_agenda
    } = req.body;

    await pool.query(
      `UPDATE usuarios SET
        matricula = COALESCE(?, matricula),
        telefono = COALESCE(?, telefono),
        biografia = COALESCE(?, biografia),
        direccion = COALESCE(?, direccion),
        acepta_particular = COALESCE(?, acepta_particular),
        honorarios_particular = ?,
        mostrar_honorarios = COALESCE(?, mostrar_honorarios),
        dias_antelacion_agenda = COALESCE(?, dias_antelacion_agenda),
        dia_apertura_agenda = COALESCE(?, dia_apertura_agenda)
       WHERE id = ? AND rol = 'medico'`,
      [
        matricula,
        telefono,
        biografia,
        direccion,
        acepta_particular !== undefined ? (acepta_particular ? 1 : 0) : null,
        honorarios_particular !== undefined ? (honorarios_particular !== '' && honorarios_particular !== null && !isNaN(Number(honorarios_particular)) ? Number(honorarios_particular) : null) : null,
        mostrar_honorarios !== undefined ? (mostrar_honorarios ? 1 : 0) : null,
        dias_antelacion_agenda !== undefined ? (dias_antelacion_agenda !== '' ? parseInt(dias_antelacion_agenda, 10) : null) : null,
        dia_apertura_agenda !== undefined ? (dia_apertura_agenda !== '' ? parseInt(dia_apertura_agenda, 10) : null) : null,
        req.user.id
      ]
    );

    res.json({ status: 'success', message: 'Perfil y honorarios actualizados correctamente.' });
  } catch (error) {
    console.error('Error en PUT /medico/perfil:', error);
    res.status(500).json({ status: 'error', message: 'Error al actualizar perfil médico.' });
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
    const [osRows] = await pool.query('SELECT obra_social_id FROM medicos_obras_sociales WHERE usuario_id = ?', [req.user.id]);
    const [planRows] = await pool.query('SELECT plan_id FROM medicos_planes WHERE usuario_id = ?', [req.user.id]);
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
