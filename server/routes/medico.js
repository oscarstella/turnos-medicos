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
      SELECT t.id, t.fecha, t.hora_inicio, t.hora_fin, t.estado, t.notas, t.creado_en,
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

module.exports = router;
