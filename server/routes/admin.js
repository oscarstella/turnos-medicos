const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireRole(['superadmin', 'admin', 'recepcionista']));

// 1. Estadísticas para el Dashboard
router.get('/stats', async (req, res) => {
  try {
    const [[turnosHoy]] = await pool.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN estado IN ('confirmado', 'asignado') THEN 1 ELSE 0 END) as confirmados,
        SUM(CASE WHEN estado = 'asistio' THEN 1 ELSE 0 END) as asistieron,
        SUM(CASE WHEN estado = 'ausente' THEN 1 ELSE 0 END) as ausentes,
        SUM(CASE WHEN estado = 'cancelado' THEN 1 ELSE 0 END) as cancelados
       FROM turnos WHERE fecha = CURDATE()`
    );

    const [[totales]] = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM usuarios WHERE rol = 'medico') as total_medicos,
        (SELECT COUNT(*) FROM usuarios WHERE rol = 'paciente') as total_pacientes,
        (SELECT COUNT(*) FROM turnos WHERE fecha >= CURDATE() AND estado NOT IN ('cancelado')) as turnos_futuros`
    );

    res.json({
      status: 'success',
      data: {
        hoy: turnosHoy,
        totales
      }
    });
  } catch (error) {
    console.error('Error en /admin/stats:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener estadísticas.' });
  }
});

// 2. Listado de Turnos General con filtros
router.get('/turnos', async (req, res) => {
  try {
    const { medico_id, unidad_id, fecha, desde, hasta, estado, q } = req.query;

    let query = `
      SELECT t.id, DATE_FORMAT(t.fecha, '%Y-%m-%d') as fecha, t.hora_inicio, t.hora_fin, t.estado, t.notas, t.creado_en,
             m.id as medico_id, m.nombre as medico_nombre, m.apellido as medico_apellido,
             p.id as paciente_id, p.nombre as paciente_nombre, p.apellido as paciente_apellido,
             p.dni as paciente_dni, p.telefono as paciente_telefono, p.tiene_whatsapp as paciente_whatsapp,
             e.nombre as especialidad_nombre,
             os.nombre as obra_social_nombre,
             pl.nombre as plan_nombre,
             ua.nombre as unidad_nombre
      FROM turnos t
      JOIN usuarios m ON t.medico_id = m.id
      JOIN usuarios p ON t.paciente_id = p.id
      LEFT JOIN especialidades e ON t.especialidad_id = e.id
      LEFT JOIN obras_sociales os ON t.obra_social_id = os.id
      LEFT JOIN planes_obras_sociales pl ON t.plan_id = pl.id
      LEFT JOIN unidades_atencion ua ON t.unidad_id = ua.id
      WHERE 1=1
    `;
    const params = [];

    if (medico_id) {
      query += ' AND t.medico_id = ?';
      params.push(medico_id);
    }
    if (unidad_id) {
      query += ' AND t.unidad_id = ?';
      params.push(unidad_id);
    }
    if (fecha) {
      query += ' AND t.fecha = ?';
      params.push(fecha);
    } else if (desde && hasta) {
      query += ' AND t.fecha BETWEEN ? AND ?';
      params.push(desde, hasta);
    }
    if (estado) {
      query += ' AND t.estado = ?';
      params.push(estado);
    }
    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      query += ' AND (p.nombre LIKE ? OR p.apellido LIKE ? OR p.dni LIKE ? OR p.telefono LIKE ?)';
      params.push(term, term, term, term);
    }

    query += ' ORDER BY t.fecha DESC, t.hora_inicio DESC LIMIT 200';

    const [rows] = await pool.query(query, params);
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error en /admin/turnos:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener turnos.' });
  }
});

// 3. Modificar estado de un turno
router.put('/turnos/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, notas } = req.body;

    const [result] = await pool.query(
      'UPDATE turnos SET estado = ?, notas = COALESCE(?, notas) WHERE id = ?',
      [estado, notas, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Turno no encontrado.' });
    }

    res.json({ status: 'success', message: 'Turno actualizado con éxito.' });
  } catch (error) {
    console.error('Error al actualizar turno:', error);
    res.status(500).json({ status: 'error', message: 'Error al actualizar turno.' });
  }
});

// 4. Gestión de Médicos
router.get('/medicos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.nombre, u.apellido, u.username, u.email, u.dni, u.telefono, u.matricula, u.foto_perfil,
             u.biografia, u.direccion, u.dias_antelacion_agenda, u.dia_apertura_agenda,
             u.acepta_particular, u.honorarios_particular, u.mostrar_honorarios, u.slug,
             GROUP_CONCAT(DISTINCT me.especialidad_id) as especialidades_ids,
             GROUP_CONCAT(DISTINCT e.nombre SEPARATOR ', ') as especialidades_nombres
      FROM usuarios u
      LEFT JOIN medicos_especialidades me ON u.id = me.usuario_id
      LEFT JOIN especialidades e ON me.especialidad_id = e.id
      WHERE u.rol = 'medico'
      GROUP BY u.id
      ORDER BY u.apellido ASC, u.nombre ASC
    `);

    const data = rows.map((r) => ({
      ...r,
      especialidades_ids: r.especialidades_ids ? r.especialidades_ids.split(',').map(Number) : []
    }));

    res.json({ status: 'success', data });
  } catch (error) {
    console.error('Error en /admin/medicos:', error);
    res.status(500).json({ status: 'error', message: 'Error al listar médicos.' });
  }
});

// Guardar o actualizar médico
router.post('/medicos', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

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
      dias_antelacion_agenda = 60,
      dia_apertura_agenda,
      acepta_particular = 1,
      honorarios_particular = null,
      mostrar_honorarios = 0,
      especialidades = [],
      obras_sociales = []
    } = req.body;

    if (!nombre || !apellido || (!email && !username)) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'Nombre, apellido y al menos un correo o nombre de usuario son requeridos.' });
    }

    const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : null;
    const cleanUsername = username && username.trim() ? username.trim().toLowerCase().replace(/\s+/g, '') : null;

    if (cleanEmail) {
      const [emailRows] = await connection.query('SELECT id FROM usuarios WHERE LOWER(email) = ? LIMIT 1', [cleanEmail]);
      if (emailRows.length > 0) {
        await connection.rollback();
        return res.status(400).json({ status: 'error', message: 'El correo electrónico ya está registrado por otra cuenta.' });
      }
    }

    if (cleanUsername) {
      const [usernameRows] = await connection.query('SELECT id FROM usuarios WHERE LOWER(username) = ? LIMIT 1', [cleanUsername]);
      if (usernameRows.length > 0) {
        await connection.rollback();
        return res.status(400).json({ status: 'error', message: 'El nombre de usuario ya está registrado por otra cuenta.' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash(password || 'Medico1234!', salt);

    // Generar slug del médico (ej: bocianjorge)
    let cleanNombre = (nombre || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    let cleanApellido = (apellido || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    let baseSlug = (cleanApellido + cleanNombre) || `medico${Date.now()}`;
    let doctorSlug = baseSlug;
    const [slugRows] = await connection.query('SELECT id FROM usuarios WHERE slug = ? LIMIT 1', [doctorSlug]);
    if (slugRows.length > 0) {
      doctorSlug = `${baseSlug}${Math.floor(100 + Math.random() * 900)}`;
    }

    const [inserted] = await connection.query(
      `INSERT INTO usuarios (nombre, apellido, username, email, dni, matricula, contrasena, slug, telefono, biografia, direccion, dias_antelacion_agenda, dia_apertura_agenda, acepta_particular, honorarios_particular, mostrar_honorarios, rol)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'medico')`,
      [
        nombre.trim(),
        apellido.trim(),
        cleanUsername,
        cleanEmail,
        dni || null,
        matricula || null,
        passHash,
        doctorSlug,
        telefono || null,
        biografia || null,
        direccion || null,
        dias_antelacion_agenda,
        dia_apertura_agenda || null,
        acepta_particular !== false && acepta_particular !== 0 ? 1 : 0,
        honorarios_particular !== '' && honorarios_particular !== null && !isNaN(Number(honorarios_particular)) ? Number(honorarios_particular) : null,
        mostrar_honorarios ? 1 : 0
      ]
    );

    const medicoId = inserted.insertId;

    if (Array.isArray(especialidades) && especialidades.length > 0) {
      const values = especialidades.map((eid) => [medicoId, eid]);
      await connection.query('INSERT INTO medicos_especialidades (usuario_id, especialidad_id) VALUES ?', [values]);
    }

    if (Array.isArray(obras_sociales) && obras_sociales.length > 0) {
      const values = obras_sociales.map((osid) => [medicoId, osid]);
      await connection.query('INSERT INTO medicos_obras_sociales (usuario_id, obra_social_id) VALUES ?', [values]);
    } else {
      // Por defecto todos los planes y obras sociales habilitados para el médico
      await connection.query('INSERT IGNORE INTO medicos_obras_sociales (usuario_id, obra_social_id) SELECT ?, id FROM obras_sociales', [medicoId]);
      await connection.query('INSERT IGNORE INTO medicos_planes (usuario_id, plan_id) SELECT ?, id FROM planes_obras_sociales', [medicoId]);
    }

    await connection.commit();
    res.status(201).json({ status: 'success', message: 'Médico creado con éxito.', id: medicoId, slug: doctorSlug });
  } catch (error) {
    await connection.rollback();
    console.error('Error al crear médico:', error);
    res.status(500).json({ status: 'error', message: 'Error al registrar médico.' });
  } finally {
    connection.release();
  }
});

// Actualizar médico
router.put('/medicos/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
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
      dias_antelacion_agenda,
      dia_apertura_agenda,
      acepta_particular,
      honorarios_particular,
      mostrar_honorarios,
      especialidades,
      obras_sociales
    } = req.body;

    let cleanUsername = undefined;
    if (username !== undefined) {
      cleanUsername = username && username.trim() ? username.trim().toLowerCase().replace(/\s+/g, '') : null;
      if (cleanUsername) {
        const [uRows] = await connection.query('SELECT id FROM usuarios WHERE LOWER(username) = ? AND id != ? LIMIT 1', [cleanUsername, id]);
        if (uRows.length > 0) {
          await connection.rollback();
          return res.status(400).json({ status: 'error', message: 'El nombre de usuario ya está registrado por otra cuenta.' });
        }
      }
    }

    let cleanEmail = undefined;
    if (email !== undefined) {
      cleanEmail = email && email.trim() ? email.trim().toLowerCase() : null;
      if (cleanEmail) {
        const [eRows] = await connection.query('SELECT id FROM usuarios WHERE LOWER(email) = ? AND id != ? LIMIT 1', [cleanEmail, id]);
        if (eRows.length > 0) {
          await connection.rollback();
          return res.status(400).json({ status: 'error', message: 'El correo electrónico ya está registrado por otra cuenta.' });
        }
      }
    }

    let updateSql = `UPDATE usuarios SET 
        nombre = COALESCE(?, nombre),
        apellido = COALESCE(?, apellido),
        username = (CASE WHEN ? = 1 THEN ? ELSE username END),
        email = (CASE WHEN ? = 1 THEN ? ELSE email END),
        dni = COALESCE(?, dni),
        matricula = COALESCE(?, matricula),
        telefono = COALESCE(?, telefono),
        biografia = COALESCE(?, biografia),
        direccion = COALESCE(?, direccion),
        dias_antelacion_agenda = COALESCE(?, dias_antelacion_agenda),
        dia_apertura_agenda = ?,
        acepta_particular = COALESCE(?, acepta_particular),
        honorarios_particular = ?,
        mostrar_honorarios = COALESCE(?, mostrar_honorarios)`;

    const params = [
      nombre,
      apellido,
      cleanUsername !== undefined ? 1 : 0,
      cleanUsername !== undefined ? cleanUsername : null,
      cleanEmail !== undefined ? 1 : 0,
      cleanEmail !== undefined ? cleanEmail : null,
      dni,
      matricula,
      telefono,
      biografia,
      direccion,
      dias_antelacion_agenda,
      dia_apertura_agenda || null,
      acepta_particular !== undefined ? (acepta_particular ? 1 : 0) : null,
      honorarios_particular !== undefined ? (honorarios_particular !== '' && honorarios_particular !== null && !isNaN(Number(honorarios_particular)) ? Number(honorarios_particular) : null) : null,
      mostrar_honorarios !== undefined ? (mostrar_honorarios ? 1 : 0) : null
    ];

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const passHash = await bcrypt.hash(password.trim(), salt);
      updateSql += `, contrasena = ?`;
      params.push(passHash);
    }

    updateSql += ` WHERE id = ? AND rol = 'medico'`;
    params.push(id);

    await connection.query(updateSql, params);

    if (Array.isArray(especialidades)) {
      await connection.query('DELETE FROM medicos_especialidades WHERE usuario_id = ?', [id]);
      if (especialidades.length > 0) {
        const values = especialidades.map((eid) => [id, eid]);
        await connection.query('INSERT INTO medicos_especialidades (usuario_id, especialidad_id) VALUES ?', [values]);
      }
    }

    if (Array.isArray(obras_sociales)) {
      await connection.query('DELETE FROM medicos_obras_sociales WHERE usuario_id = ?', [id]);
      if (obras_sociales.length > 0) {
        const values = obras_sociales.map((osid) => [id, osid]);
        await connection.query('INSERT INTO medicos_obras_sociales (usuario_id, obra_social_id) VALUES ?', [values]);
      }
    }

    await connection.commit();
    res.json({ status: 'success', message: 'Médico actualizado exitosamente.' });
  } catch (error) {
    await connection.rollback();
    console.error('Error al actualizar médico:', error);
    res.status(500).json({ status: 'error', message: 'Error al actualizar médico.' });
  } finally {
    connection.release();
  }
});

// Asignar o cambiar credenciales de acceso de un médico (usuario, email y/o contraseña)
router.put('/medicos/:id/credenciales', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password } = req.body;

    const cleanUsername = username && username.trim() ? username.trim().toLowerCase().replace(/\s+/g, '') : null;
    const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : null;

    if (!cleanUsername && !cleanEmail) {
      return res.status(400).json({ status: 'error', message: 'Debes indicar al menos un nombre de usuario o un correo electrónico.' });
    }

    if (cleanUsername) {
      const [existingUser] = await pool.query('SELECT id FROM usuarios WHERE LOWER(username) = ? AND id != ?', [cleanUsername, id]);
      if (existingUser.length > 0) {
        return res.status(400).json({ status: 'error', message: 'El nombre de usuario simple ya está registrado por otra cuenta.' });
      }
    }

    if (cleanEmail) {
      const [existingEmail] = await pool.query('SELECT id FROM usuarios WHERE LOWER(email) = ? AND id != ?', [cleanEmail, id]);
      if (existingEmail.length > 0) {
        return res.status(400).json({ status: 'error', message: 'El correo electrónico ya está registrado por otra cuenta.' });
      }
    }

    let updateSql = 'UPDATE usuarios SET ';
    const params = [];

    // Si se envía username (o explícitamente vacío para limpiar), actualizarlo
    if (username !== undefined) {
      updateSql += 'username = ?, ';
      params.push(cleanUsername);
    }

    // Si se envía email, actualizarlo
    if (email !== undefined) {
      updateSql += 'email = ?, ';
      params.push(cleanEmail);
    }

    if (password && password.trim() !== '') {
      if (password.trim().length < 6) {
        return res.status(400).json({ status: 'error', message: 'La contraseña debe contener al menos 6 caracteres.' });
      }
      const salt = await bcrypt.genSalt(10);
      const passHash = await bcrypt.hash(password.trim(), salt);
      updateSql += 'contrasena = ?, ';
      params.push(passHash);
    }

    // Quitar última coma y espacio
    updateSql = updateSql.replace(/, $/, '');
    updateSql += " WHERE id = ? AND rol = 'medico'";
    params.push(id);

    const [result] = await pool.query(updateSql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Médico no encontrado.' });
    }

    res.json({ status: 'success', message: 'Credenciales del médico (usuario, email y/o contraseña) actualizadas correctamente.' });
  } catch (error) {
    console.error('Error al actualizar credenciales de médico:', error);
    res.status(500).json({ status: 'error', message: 'Error interno al actualizar credenciales.' });
  }
});

// 4b. Coberturas (Obras Sociales y Planes) de un médico
router.get('/medicos/:id/coberturas', async (req, res) => {
  try {
    const { id } = req.params;
    let [osRows] = await pool.query('SELECT obra_social_id FROM medicos_obras_sociales WHERE usuario_id = ?', [id]);
    let [planRows] = await pool.query('SELECT plan_id FROM medicos_planes WHERE usuario_id = ?', [id]);

    // Por default todos los planes y obras sociales marcados si no tiene guardadas
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
    console.error('Error en GET /medicos/:id/coberturas:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener coberturas.' });
  }
});

router.put('/medicos/:id/coberturas', requireRole(['superadmin', 'admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
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

// 5. Horarios de un médico (obtener y actualizar por bloques semanales)
router.get('/horarios/:medicoId', async (req, res) => {
  try {
    const { medicoId } = req.params;
    const [rows] = await pool.query(
      `SELECT id, dia_semana, hora_inicio, hora_fin, duracion_turno_minutos, unidad_id, consultorio
       FROM horarios_medicos WHERE medico_id = ?
       ORDER BY FIELD(dia_semana, 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'), hora_inicio ASC`,
      [medicoId]
    );
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error en /horarios:', error);
    res.status(500).json({ status: 'error', message: 'Error al consultar horarios.' });
  }
});

router.put('/horarios/:medicoId', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { medicoId } = req.params;
    const { bloques = [] } = req.body;

    // Eliminar horarios anteriores del médico
    await connection.query('DELETE FROM horarios_medicos WHERE medico_id = ?', [medicoId]);

    if (bloques.length > 0) {
      const values = bloques.map((b) => [
        medicoId,
        b.dia_semana,
        b.hora_inicio,
        b.hora_fin,
        b.duracion_turno_minutos || 30,
        b.unidad_id || null,
        b.consultorio ? String(b.consultorio).trim().slice(0, 10) : null
      ]);

      await connection.query(
        'INSERT INTO horarios_medicos (medico_id, dia_semana, hora_inicio, hora_fin, duracion_turno_minutos, unidad_id, consultorio) VALUES ?',
        [values]
      );
    }

    await connection.commit();
    res.json({ status: 'success', message: 'Horarios guardados correctamente.' });
  } catch (error) {
    await connection.rollback();
    console.error('Error al guardar horarios:', error);
    res.status(500).json({ status: 'error', message: 'Error al guardar horarios.' });
  } finally {
    connection.release();
  }
});

// 6. CRUD Especialidades
router.get('/especialidades', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM especialidades ORDER BY nombre ASC');
    res.json({ status: 'success', data: rows });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error al obtener especialidades.' });
  }
});

router.post('/especialidades', async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre) return res.status(400).json({ status: 'error', message: 'Nombre requerido.' });
    await pool.query('INSERT INTO especialidades (nombre, descripcion) VALUES (?, ?)', [nombre.trim(), descripcion || null]);
    res.status(201).json({ status: 'success', message: 'Especialidad creada.' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error al crear especialidad.' });
  }
});

// 7. CRUD Unidades de Atención
router.get('/unidades', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM unidades_atencion ORDER BY nombre ASC');
    res.json({ status: 'success', data: rows });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error al obtener unidades de atención.' });
  }
});

router.post('/unidades', async (req, res) => {
  try {
    const { nombre, calle, numero, localidad } = req.body;
    if (!nombre) return res.status(400).json({ status: 'error', message: 'Nombre de sede requerido.' });
    await pool.query(
      'INSERT INTO unidades_atencion (nombre, calle, numero, localidad, activa) VALUES (?, ?, ?, ?, 1)',
      [nombre.trim(), calle || null, numero || null, localidad || 'San Carlos de Bariloche']
    );
    res.status(201).json({ status: 'success', message: 'Sede creada exitosamente.' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error al crear sede.' });
  }
});

// 8. Gestión de Usuarios y Roles
router.get('/usuarios', async (req, res) => {
  try {
    const { rol, q } = req.query;
    let query = `
      SELECT id, email, username, nombre, apellido, dni, telefono, rol, creado_en 
      FROM usuarios WHERE 1=1
    `;
    const params = [];
    if (rol) {
      query += ' AND rol = ?';
      params.push(rol);
    }
    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      query += ' AND (nombre LIKE ? OR apellido LIKE ? OR email LIKE ? OR username LIKE ? OR dni LIKE ?)';
      params.push(term, term, term, term, term);
    }
    query += ' ORDER BY id DESC LIMIT 150';

    const [rows] = await pool.query(query, params);
    res.json({ status: 'success', data: rows });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error al consultar usuarios.' });
  }
});

router.put('/usuarios/:id/rol', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { rol } = req.body;
    const allowed = ['superadmin', 'admin', 'recepcionista', 'medico', 'paciente'];
    if (!allowed.includes(rol)) return res.status(400).json({ status: 'error', message: 'Rol inválido.' });

    await pool.query('UPDATE usuarios SET rol = ? WHERE id = ?', [rol, id]);
    res.json({ status: 'success', message: 'Rol actualizado exitosamente.' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error al actualizar rol.' });
  }
});

// 9. Configuración del Sistema (Límite / Tope de Agenda general)
router.get('/config', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT clave, valor FROM configuracion');
    const config = {};
    rows.forEach((r) => {
      config[r.clave] = r.valor;
    });
    if (!config.meses_agenda) config.meses_agenda = '3';
    res.json({ status: 'success', data: config });
  } catch (error) {
    console.error('Error al obtener config en admin:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener configuración.' });
  }
});

router.post('/config', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ status: 'error', message: 'Datos de configuración inválidos.' });
    }

    for (const [clave, valor] of Object.entries(data)) {
      await pool.query(
        'INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
        [clave, String(valor)]
      );
    }

    res.json({ status: 'success', message: 'Configuración guardada exitosamente.' });
  } catch (error) {
    console.error('Error al guardar config en admin:', error);
    res.status(500).json({ status: 'error', message: 'Error al guardar configuración.' });
  }
});

// 10. CRUD Obras Sociales y Planes (Panel Administrativo)
router.get('/obras-sociales', async (req, res) => {
  try {
    const { q, limit, offset } = req.query;
    let query = `
      SELECT o.id, o.nombre, COUNT(p.id) as total_planes
      FROM obras_sociales o
      LEFT JOIN planes_obras_sociales p ON o.id = p.obra_social_id
      WHERE 1=1
    `;
    const params = [];

    if (q && q.trim()) {
      query += ' AND o.nombre LIKE ?';
      params.push(`%${q.trim()}%`);
    }

    query += ' GROUP BY o.id, o.nombre ORDER BY o.nombre ASC';

    if (limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit, 10), parseInt(offset || 0, 10));
    }

    const [rows] = await pool.query(query, params);
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error al obtener obras sociales en admin:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener obras sociales.' });
  }
});

router.post('/obras-sociales', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { nombre, planes } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ status: 'error', message: 'El nombre de la obra social es obligatorio.' });
    }

    const cleanNombre = nombre.trim();
    const [exist] = await pool.query('SELECT id FROM obras_sociales WHERE LOWER(nombre) = LOWER(?) LIMIT 1', [cleanNombre]);
    if (exist.length > 0) {
      return res.status(409).json({ status: 'error', message: 'Ya existe una obra social con ese nombre.' });
    }

    const [result] = await pool.query('INSERT INTO obras_sociales (nombre) VALUES (?)', [cleanNombre]);
    const obraSocialId = result.insertId;

    if (Array.isArray(planes) && planes.length > 0) {
      const planValues = planes
        .map(p => typeof p === 'string' ? p.trim() : (p.nombre || '').trim())
        .filter(Boolean)
        .map(pNom => [obraSocialId, pNom]);
      
      if (planValues.length > 0) {
        await pool.query('INSERT INTO planes_obras_sociales (obra_social_id, nombre) VALUES ?', [planValues]);
      }
    } else {
      await pool.query('INSERT INTO planes_obras_sociales (obra_social_id, nombre) VALUES (?, "Plan General")', [obraSocialId]);
    }

    res.status(201).json({ status: 'success', message: 'Obra social creada exitosamente.', id: obraSocialId });
  } catch (error) {
    console.error('Error al crear obra social:', error);
    res.status(500).json({ status: 'error', message: 'Error al crear obra social.' });
  }
});

router.put('/obras-sociales/:id', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ status: 'error', message: 'El nombre es obligatorio.' });
    }

    await pool.query('UPDATE obras_sociales SET nombre = ? WHERE id = ?', [nombre.trim(), id]);
    res.json({ status: 'success', message: 'Obra social actualizada.' });
  } catch (error) {
    console.error('Error al actualizar obra social:', error);
    res.status(500).json({ status: 'error', message: 'Error al actualizar obra social.' });
  }
});

router.delete('/obras-sociales/:id', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM planes_obras_sociales WHERE obra_social_id = ?', [id]);
    await pool.query('DELETE FROM medicos_obras_sociales WHERE obra_social_id = ?', [id]);
    await pool.query('DELETE FROM obras_sociales WHERE id = ?', [id]);
    res.json({ status: 'success', message: 'Obra social y sus planes eliminados.' });
  } catch (error) {
    console.error('Error al eliminar obra social:', error);
    res.status(500).json({ status: 'error', message: 'Error al eliminar obra social.' });
  }
});

router.get('/obras-sociales/:id/planes', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT id, nombre FROM planes_obras_sociales WHERE obra_social_id = ? ORDER BY nombre ASC', [id]);
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error al obtener planes:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener planes.' });
  }
});

router.post('/obras-sociales/:id/planes', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ status: 'error', message: 'Nombre del plan requerido.' });
    }

    const [result] = await pool.query('INSERT INTO planes_obras_sociales (obra_social_id, nombre) VALUES (?, ?)', [id, nombre.trim()]);
    res.status(201).json({ status: 'success', message: 'Plan agregado.', id: result.insertId });
  } catch (error) {
    console.error('Error al agregar plan:', error);
    res.status(500).json({ status: 'error', message: 'Error al agregar plan.' });
  }
});

router.delete('/planes/:id', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM planes_obras_sociales WHERE id = ?', [id]);
    res.json({ status: 'success', message: 'Plan eliminado.' });
  } catch (error) {
    console.error('Error al eliminar plan:', error);
    res.status(500).json({ status: 'error', message: 'Error al eliminar plan.' });
  }
});

// =========================================================================
// CRUD: Preguntas y Respuestas del Bot de WhatsApp
// =========================================================================

// Listar todas las respuestas y preguntas del bot
router.get('/bot-respuestas', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, clave, titulo, descripcion, disparador, mensaje, activo, creado_en, actualizado_en FROM bot_respuestas ORDER BY id ASC'
    );
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error al obtener respuestas del bot:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener mensajes del bot.' });
  }
});

// Obtener una respuesta por ID
router.get('/bot-respuestas/:id', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM bot_respuestas WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Mensaje no encontrado.' });
    }
    res.json({ status: 'success', data: rows[0] });
  } catch (error) {
    console.error('Error al obtener mensaje del bot:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener mensaje del bot.' });
  }
});

// Crear nueva respuesta / pregunta del bot
router.post('/bot-respuestas', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { clave, titulo, descripcion, disparador, mensaje, activo = 1 } = req.body;
    if (!clave || !titulo || !mensaje) {
      return res.status(400).json({ status: 'error', message: 'Clave identificadora, título y mensaje son obligatorios.' });
    }

    const cleanClave = clave.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const [existing] = await pool.query('SELECT id FROM bot_respuestas WHERE clave = ? LIMIT 1', [cleanClave]);
    if (existing.length > 0) {
      return res.status(409).json({ status: 'error', message: 'Ya existe una respuesta o pregunta con esa clave.' });
    }

    const [result] = await pool.query(
      `INSERT INTO bot_respuestas (clave, titulo, descripcion, disparador, mensaje, activo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cleanClave, titulo.trim(), descripcion?.trim() || null, disparador?.trim() || null, mensaje.trim(), activo ? 1 : 0]
    );

    res.status(201).json({
      status: 'success',
      message: 'Mensaje del bot creado exitosamente.',
      id: result.insertId
    });
  } catch (error) {
    console.error('Error al crear mensaje del bot:', error);
    res.status(500).json({ status: 'error', message: 'Error al crear mensaje del bot.' });
  }
});

// Actualizar respuesta / pregunta del bot
router.put('/bot-respuestas/:id', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { clave, titulo, descripcion, disparador, mensaje, activo } = req.body;

    if (!titulo || !mensaje) {
      return res.status(400).json({ status: 'error', message: 'Título y mensaje son obligatorios.' });
    }

    const cleanClave = clave ? clave.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') : null;

    if (cleanClave) {
      const [existing] = await pool.query('SELECT id FROM bot_respuestas WHERE clave = ? AND id != ? LIMIT 1', [cleanClave, id]);
      if (existing.length > 0) {
        return res.status(409).json({ status: 'error', message: 'Otra respuesta ya utiliza esa clave.' });
      }
    }

    await pool.query(
      `UPDATE bot_respuestas SET 
         clave = COALESCE(?, clave),
         titulo = ?,
         descripcion = ?,
         disparador = ?,
         mensaje = ?,
         activo = ?
       WHERE id = ?`,
      [
        cleanClave,
        titulo.trim(),
        descripcion !== undefined ? (descripcion?.trim() || null) : null,
        disparador !== undefined ? (disparador?.trim() || null) : null,
        mensaje.trim(),
        activo !== undefined ? (activo ? 1 : 0) : 1,
        id
      ]
    );

    res.json({ status: 'success', message: 'Mensaje del bot actualizado exitosamente.' });
  } catch (error) {
    console.error('Error al actualizar mensaje del bot:', error);
    res.status(500).json({ status: 'error', message: 'Error al actualizar mensaje del bot.' });
  }
});

// Eliminar respuesta del bot
router.delete('/bot-respuestas/:id', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM bot_respuestas WHERE id = ?', [id]);
    res.json({ status: 'success', message: 'Mensaje del bot eliminado exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar mensaje del bot:', error);
    res.status(500).json({ status: 'error', message: 'Error al eliminar mensaje del bot.' });
  }
});

module.exports = router;
