const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Mis Turnos (próximos e históricos)
router.get('/turnos', async (req, res) => {
  try {
    const pacienteId = req.user.id;
    const [rows] = await pool.query(
      `SELECT t.id, DATE_FORMAT(t.fecha, '%Y-%m-%d') as fecha, t.hora_inicio, t.hora_fin, t.estado, t.notas, t.creado_en,
              m.id as medico_id, m.nombre as medico_nombre, m.apellido as medico_apellido, m.foto_perfil, m.matricula,
              e.id as especialidad_id, e.nombre as especialidad_nombre,
              os.nombre as obra_social_nombre,
              p.nombre as plan_nombre,
              ua.nombre as unidad_nombre, ua.calle, ua.numero, ua.localidad
       FROM turnos t
       JOIN usuarios m ON t.medico_id = m.id
       LEFT JOIN especialidades e ON t.especialidad_id = e.id
       LEFT JOIN obras_sociales os ON t.obra_social_id = os.id
       LEFT JOIN planes_obras_sociales p ON t.plan_id = p.id
       LEFT JOIN unidades_atencion ua ON t.unidad_id = ua.id
       WHERE t.paciente_id = ?
       ORDER BY t.fecha DESC, t.hora_inicio DESC`,
      [pacienteId]
    );

    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error en /paciente/turnos:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener tus turnos.' });
  }
});

// Cancelar mi turno
router.put('/turnos/:id/cancelar', async (req, res) => {
  try {
    const { id } = req.params;
    const pacienteId = req.user.id;

    const [rows] = await pool.query(
      'SELECT id, estado, fecha FROM turnos WHERE id = ? AND paciente_id = ? LIMIT 1',
      [id, pacienteId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Turno no encontrado o no pertenece a tu cuenta.' });
    }

    const turno = rows[0];
    if (turno.estado === 'cancelado') {
      return res.status(400).json({ status: 'error', message: 'El turno ya se encuentra cancelado.' });
    }

    await pool.query('UPDATE turnos SET estado = "cancelado" WHERE id = ?', [id]);

    res.json({ status: 'success', message: 'Tu turno ha sido cancelado con éxito.' });
  } catch (error) {
    console.error('Error al cancelar turno:', error);
    res.status(500).json({ status: 'error', message: 'Error al procesar la cancelación.' });
  }
});

module.exports = router;
