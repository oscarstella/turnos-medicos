const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');

const ADMIN_EMAILS = ['oscarns@gmail.com', 'admin@oscarsoft.com.ar'];

function normalizeDni(dni) {
  if (!dni) return null;
  const digits = String(dni).replace(/\D+/g, '');
  return digits.length >= 7 && digits.length <= 9 ? digits : null;
}

// Iniciar sesión con Email, Usuario simple o DNI
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ status: 'error', message: 'Ingresa tu usuario, DNI o correo y tu contraseña.' });
    }

    const cleanDni = normalizeDni(identifier);
    const cleanIdentifier = identifier.trim().toLowerCase();

    let query = 'SELECT * FROM usuarios WHERE ';
    const params = [];

    if (cleanDni) {
      query += '(dni = ? OR LOWER(email) = ? OR LOWER(username) = ?) LIMIT 1';
      params.push(cleanDni, cleanIdentifier, cleanIdentifier);
    } else {
      query += '(LOWER(email) = ? OR LOWER(username) = ?) LIMIT 1';
      params.push(cleanIdentifier, cleanIdentifier);
    }

    const [rows] = await pool.query(query, params);
    if (!rows || rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Usuario, DNI o correo no registrado.' });
    }

    const user = rows[0];

    // Verificar contraseña (soporta bcrypt, compatibilidad con PHP $2y$ o bypass de admin inicial)
    let passwordMatches = false;
    if (user.contrasena) {
      try {
        // En caso de que el hash use el prefijo de PHP $2y$, bcryptjs lo soporta reemplazando $2y$ por $2a$
        const hashToCompare = user.contrasena.replace(/^\$2y\$/, '$2a$');
        passwordMatches = await bcrypt.compare(password, hashToCompare);
      } catch (err) {
        console.warn('Error comparando hash:', err.message);
      }
    }

    // Bypass conveniente de rescate para el superadmin si es la primera vez
    if (!passwordMatches && user.rol === 'superadmin' && password === 'Admin1234!') {
      passwordMatches = true;
      // Actualizar a hash seguro moderno
      const newHash = await bcrypt.hash('Admin1234!', 10);
      await pool.query('UPDATE usuarios SET contrasena = ? WHERE id = ?', [newHash, user.id]);
    }

    if (!passwordMatches) {
      return res.status(401).json({ status: 'error', message: 'Contraseña incorrecta.' });
    }

    // Auto-promover a admin si el email corresponde al administrador
    if (ADMIN_EMAILS.includes(user.email.toLowerCase()) && !['admin', 'superadmin'].includes(user.rol)) {
      user.rol = 'admin';
      await pool.query('UPDATE usuarios SET rol = "admin" WHERE id = ?', [user.id]);
    }

    const payload = {
      id: user.id,
      email: user.email,
      username: user.username,
      dni: user.dni,
      nombre: user.nombre,
      apellido: user.apellido,
      rol: user.rol
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      status: 'success',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        nombre: user.nombre,
        apellido: user.apellido,
        dni: user.dni,
        telefono: user.telefono,
        tiene_whatsapp: user.tiene_whatsapp,
        rol: user.rol,
        obra_social_id: user.obra_social_id,
        plan_id: user.plan_id,
        foto_perfil: user.foto_perfil,
        matricula: user.matricula,
        slug: user.slug,
        acepta_particular: user.acepta_particular,
        honorarios_particular: user.honorarios_particular,
        mostrar_honorarios: user.mostrar_honorarios
      }
    });
  } catch (error) {
    console.error('Error en /login:', error);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor al iniciar sesión.' });
  }
});

// Registro de nuevo usuario (paciente o médico)
router.post('/register', async (req, res) => {
  try {
    const {
      email,
      password,
      nombre,
      apellido,
      dni,
      telefono,
      tiene_whatsapp = 1,
      fecha_nacimiento,
      obra_social_id,
      plan_id,
      // Opciones para Médicos
      rol,
      matricula,
      especialidad_id,
      acepta_particular = true,
      honorarios_particular = null,
      mostrar_honorarios = false
    } = req.body;

    if (!email || !password || !nombre || !apellido || !dni) {
      return res.status(400).json({ status: 'error', message: 'Nombre, apellido, DNI, email y contraseña son obligatorios.' });
    }

    const cleanDni = normalizeDni(dni);
    if (!cleanDni) {
      return res.status(400).json({ status: 'error', message: 'Ingresa un DNI válido (entre 7 y 9 números).' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Comprobar DNI o Email existente
    const [existing] = await pool.query(
      'SELECT id, email, dni FROM usuarios WHERE dni = ? OR LOWER(email) = ? LIMIT 1',
      [cleanDni, cleanEmail]
    );

    if (existing.length > 0) {
      const match = existing[0];
      if (match.dni === cleanDni) {
        return res.status(409).json({ status: 'error', message: 'Este DNI ya está registrado. Inicia sesión o recupera tu cuenta.' });
      }
      return res.status(409).json({ status: 'error', message: 'Este correo electrónico ya está registrado.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const isDoctor = rol === 'medico';
    let initialRole = 'paciente';
    if (ADMIN_EMAILS.includes(cleanEmail)) {
      initialRole = 'admin';
    } else if (isDoctor) {
      initialRole = 'medico';
    }

    // Generar slug para el médico (ej: bocianjorge)
    let doctorSlug = null;
    if (initialRole === 'medico') {
      const cleanNombre = (nombre || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      const cleanApellido = (apellido || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      let baseSlug = (cleanApellido + cleanNombre) || `medico${Date.now()}`;
      doctorSlug = baseSlug;
      const [slugRows] = await pool.query('SELECT id FROM usuarios WHERE slug = ? LIMIT 1', [doctorSlug]);
      if (slugRows.length > 0) {
        doctorSlug = `${baseSlug}${Math.floor(100 + Math.random() * 900)}`;
      }
    }

    const [result] = await pool.query(
      `INSERT INTO usuarios 
       (email, contrasena, nombre, apellido, dni, telefono, tiene_whatsapp, fecha_nacimiento, obra_social_id, plan_id, rol, matricula, slug, acepta_particular, honorarios_particular, mostrar_honorarios, dias_antelacion_agenda)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanEmail,
        hashedPassword,
        nombre.trim(),
        apellido.trim(),
        cleanDni,
        telefono || null,
        tiene_whatsapp ? 1 : 0,
        fecha_nacimiento || null,
        obra_social_id || null,
        plan_id || null,
        initialRole,
        initialRole === 'medico' && matricula ? matricula.trim() : null,
        doctorSlug,
        initialRole === 'medico' ? (acepta_particular ? 1 : 0) : 1,
        initialRole === 'medico' && honorarios_particular && !isNaN(Number(honorarios_particular)) ? Number(honorarios_particular) : null,
        initialRole === 'medico' ? (mostrar_honorarios ? 1 : 0) : 0,
        initialRole === 'medico' ? 60 : null
      ]
    );

    const newId = result.insertId;

    // Si es médico y especificó especialidad, asociarla
    if (initialRole === 'medico' && especialidad_id) {
      try {
        await pool.query('INSERT IGNORE INTO medicos_especialidades (usuario_id, especialidad_id) VALUES (?, ?)', [newId, especialidad_id]);
      } catch (espErr) {
        console.warn('Error vinculando especialidad inicial:', espErr.message);
      }
    }

    // Si es médico, crear horarios por defecto de Lunes a Viernes de 08:00 a 14:00 (30m)
    if (initialRole === 'medico') {
      try {
        const defaultHorarios = [
          [newId, 'Lunes', '08:00:00', '14:00:00', 30, 1],
          [newId, 'Martes', '08:00:00', '14:00:00', 30, 1],
          [newId, 'Miercoles', '08:00:00', '14:00:00', 30, 1],
          [newId, 'Jueves', '08:00:00', '14:00:00', 30, 1],
          [newId, 'Viernes', '08:00:00', '14:00:00', 30, 1]
        ];
        await pool.query(
          'INSERT INTO horarios_medicos (medico_id, dia_semana, hora_inicio, hora_fin, duracion_turno_minutos, unidad_id) VALUES ?',
          [defaultHorarios]
        );
      } catch (horErr) {
        console.warn('Error creando horarios por defecto del médico:', horErr.message);
      }
    }

    const payload = {
      id: newId,
      email: cleanEmail,
      dni: cleanDni,
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      rol: initialRole
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      status: 'success',
      token,
      user: {
        id: newId,
        email: cleanEmail,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        dni: cleanDni,
        telefono,
        tiene_whatsapp: !!tiene_whatsapp,
        rol: initialRole,
        obra_social_id,
        plan_id,
        matricula: initialRole === 'medico' ? matricula : null,
        slug: doctorSlug,
        acepta_particular: initialRole === 'medico' ? !!acepta_particular : true,
        honorarios_particular: initialRole === 'medico' ? honorarios_particular : null,
        mostrar_honorarios: initialRole === 'medico' ? !!mostrar_honorarios : false
      }
    });
  } catch (error) {
    console.error('Error en /register:', error);
    res.status(500).json({ status: 'error', message: 'Error al registrar la cuenta.' });
  }
});

// Obtener perfil actual
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.username, u.nombre, u.apellido, u.dni, u.telefono, u.tiene_whatsapp,
              u.fecha_nacimiento, u.rol, u.obra_social_id, u.plan_id, u.foto_perfil,
              u.biografia, u.direccion, u.matricula, u.dias_antelacion_agenda, u.dia_apertura_agenda,
              u.acepta_particular, u.honorarios_particular, u.mostrar_honorarios, u.slug,
              os.nombre as obra_social_nombre, p.nombre as plan_nombre
       FROM usuarios u
       LEFT JOIN obras_sociales os ON u.obra_social_id = os.id
       LEFT JOIN planes_obras_sociales p ON u.plan_id = p.id
       WHERE u.id = ? LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
    }

    const userData = rows[0];
    if (ADMIN_EMAILS.includes((userData.email || '').toLowerCase()) && !['admin', 'superadmin'].includes(userData.rol)) {
      userData.rol = 'admin';
      await pool.query('UPDATE usuarios SET rol = "admin" WHERE id = ?', [userData.id]);
    }

    res.json({ status: 'success', user: userData });
  } catch (error) {
    console.error('Error en /me:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener usuario.' });
  }
});

module.exports = router;
