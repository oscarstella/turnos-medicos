const pool = require('../db');

async function run() {
  console.log('--- Iniciando Saneamiento y Consolidación Rápida ---');

  // 1. Sedes / Unidades de Atención
  const sedesIniciales = [
    {
      nombre: 'Sede Pasaje Gutiérrez',
      calle: 'Pasaje Gutiérrez',
      numero: '980',
      localidad: 'San Carlos de Bariloche',
      latitud: -41.1415571,
      longitud: -71.3132086
    },
    {
      nombre: 'Consultorios Mitre 124 (4to Piso)',
      calle: 'Bartolomé Mitre',
      numero: '124',
      localidad: 'San Carlos de Bariloche',
      latitud: -41.1336564,
      longitud: -71.3078764
    },
    {
      nombre: 'Consultorios Mitre 124 (3er Piso)',
      calle: 'Bartolomé Mitre',
      numero: '124',
      localidad: 'San Carlos de Bariloche',
      latitud: -41.1336564,
      longitud: -71.3078764
    },
    {
      nombre: 'Centro Médico Frey 111',
      calle: 'Frey',
      numero: '111',
      localidad: 'San Carlos de Bariloche',
      latitud: -41.1345200,
      longitud: -71.3055300
    },
    {
      nombre: 'Sede Km 1 (Av. Bustillo)',
      calle: 'Av. Exequiel Bustillo',
      numero: '1000',
      localidad: 'San Carlos de Bariloche',
      latitud: -41.1310000,
      longitud: -71.3250000
    }
  ];

  for (const s of sedesIniciales) {
    const [exist] = await pool.query(
      'SELECT id FROM unidades_atencion WHERE nombre = ? OR (calle = ? AND numero = ?)',
      [s.nombre, s.calle, s.numero]
    );
    if (exist.length > 0) {
      await pool.query(
        'UPDATE unidades_atencion SET nombre = ?, calle = ?, numero = ?, localidad = ?, latitud = ?, longitud = ?, activa = 1 WHERE id = ?',
        [s.nombre, s.calle, s.numero, s.localidad, s.latitud, s.longitud, exist[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO unidades_atencion (nombre, calle, numero, localidad, latitud, longitud, activa) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [s.nombre, s.calle, s.numero, s.localidad, s.latitud, s.longitud]
      );
    }
  }

  const [allSedes] = await pool.query('SELECT * FROM unidades_atencion WHERE activa = 1');
  console.log(`✅ Unidades de atención actualizadas: ${allSedes.length} sedes disponibles.`);

  const getSedeId = (str) => {
    if (!str) return allSedes[0]?.id || 1;
    const txt = str.toLowerCase();
    if (txt.includes('gutierrez') || txt.includes('gutiérrez')) {
      const f = allSedes.find(s => s.nombre.toLowerCase().includes('gutiérrez') || s.nombre.toLowerCase().includes('gutierrez'));
      if (f) return f.id;
    }
    if (txt.includes('4to') || txt.includes('4 piso')) {
      const f = allSedes.find(s => s.nombre.toLowerCase().includes('4to'));
      if (f) return f.id;
    }
    if (txt.includes('3er') || txt.includes('3 piso')) {
      const f = allSedes.find(s => s.nombre.toLowerCase().includes('3er'));
      if (f) return f.id;
    }
    if (txt.includes('mitre')) {
      const f = allSedes.find(s => s.nombre.toLowerCase().includes('mitre'));
      if (f) return f.id;
    }
    if (txt.includes('frey')) {
      const f = allSedes.find(s => s.nombre.toLowerCase().includes('frey'));
      if (f) return f.id;
    }
    if (txt.includes('km') || txt.includes('bustillo')) {
      const f = allSedes.find(s => s.nombre.toLowerCase().includes('km 1'));
      if (f) return f.id;
    }
    return allSedes[0]?.id || 1;
  };

  // 2. Limpieza de Apellidos y Direcciones de Médicos
  const [medicos] = await pool.query("SELECT id, nombre, apellido, direccion FROM usuarios WHERE rol = 'medico'");
  const [existingHorarios] = await pool.query('SELECT DISTINCT medico_id FROM horarios_medicos');
  const medicoHorariosSet = new Set(existingHorarios.map(h => h.medico_id));

  const nuevosHorarios = [];
  const diasSemana = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

  for (const m of medicos) {
    const rawApellido = m.apellido || '';
    let nuevoApellido = rawApellido;
    let nuevaDireccion = m.direccion;

    if (rawApellido.includes('(')) {
      const match = rawApellido.match(/\((.*?)\)/);
      if (match) {
        const extraida = match[1].trim();
        if (!nuevaDireccion) {
          nuevaDireccion = extraida;
        }
      }
      nuevoApellido = rawApellido.replace(/\s*\(.*?\)/g, '').replace(/\s*–\s*\d+.*$/g, '').trim();
    }

    if (nuevoApellido !== rawApellido || nuevaDireccion !== m.direccion) {
      await pool.query(
        'UPDATE usuarios SET apellido = ?, direccion = ? WHERE id = ?',
        [nuevoApellido, nuevaDireccion, m.id]
      );
    }

    const targetSedeId = getSedeId(nuevaDireccion || rawApellido);

    if (!medicoHorariosSet.has(m.id)) {
      for (const d of diasSemana) {
        nuevosHorarios.push([m.id, d, '09:00:00', '13:00:00', 30, targetSedeId]);
      }
    } else {
      await pool.query(
        'UPDATE horarios_medicos SET unidad_id = ? WHERE medico_id = ? AND (unidad_id IS NULL OR unidad_id = 0)',
        [targetSedeId, m.id]
      );
    }
  }

  if (nuevosHorarios.length > 0) {
    await pool.query(
      `INSERT INTO horarios_medicos (medico_id, dia_semana, hora_inicio, hora_fin, duracion_turno_minutos, unidad_id)
       VALUES ?`,
      [nuevosHorarios]
    );
  }
  console.log(`✅ Horarios configurados para todos los médicos.`);

  // 3. Consolidación de Obras Sociales Principales
  const grupos = [
    {
      oficial: 'Swiss Medical Group',
      alias: ['Swiss Medical Group', 'Swiss Medical', 'SMG'],
      planesIniciales: ['Plan SMG01', 'Plan SMG02', 'Plan SMG20', 'Plan SMG30', 'Plan Advance', 'Plan Classic', 'Plan Global', 'Plan Premium']
    },
    {
      oficial: 'OSDE',
      alias: ['OSDE', 'O.S.D.E.', 'Osde'],
      planesIniciales: ['Plan 210', 'Plan 310', 'Plan 410', 'Plan 450', 'Plan 510', 'Plan FLUX', 'Plan 025']
    },
    {
      oficial: 'Galeno',
      alias: ['Galeno'],
      planesIniciales: ['Plan 220', 'Plan 330', 'Plan 440', 'Plan 550', 'Plan Oro', 'Plan Plata', 'Plan Azul']
    },
    {
      oficial: 'Sancor Salud',
      alias: ['Sancor Salud', 'Sancor', 'SANCOR'],
      planesIniciales: ['Plan 1000', 'Plan 1500', 'Plan 2000', 'Plan 2500', 'Plan 3000', 'Plan 3500', 'Plan 4000', 'Plan 5000']
    },
    {
      oficial: 'Medifé',
      alias: ['Medifé', 'Medife'],
      planesIniciales: ['Plan Bronce', 'Plan Plata', 'Plan Oro', 'Plan Platinum']
    },
    {
      oficial: 'OMINT',
      alias: ['OMINT', 'Omint'],
      planesIniciales: ['Plan 1500', 'Plan 2500', 'Plan 4500', 'Plan 6500', 'Plan 8500', 'Plan O', 'Plan F']
    },
    {
      oficial: 'PAMI',
      alias: ['PAMI', 'Pami'],
      planesIniciales: ['Plan General', 'Plan Ambulatorio', 'Plan Especial']
    },
    {
      oficial: 'IOMA',
      alias: ['IOMA', 'Ioma'],
      planesIniciales: ['Plan Único', 'Plan Ambulatorio']
    }
  ];

  for (const g of grupos) {
    let canonicalId = null;
    const [cand] = await pool.query('SELECT id FROM obras_sociales WHERE nombre = ? LIMIT 1', [g.oficial]);
    if (cand.length > 0) {
      canonicalId = cand[0].id;
    } else {
      const [ins] = await pool.query('INSERT INTO obras_sociales (nombre) VALUES (?)', [g.oficial]);
      canonicalId = ins.insertId;
    }

    for (const pNom of g.planesIniciales) {
      const [chk] = await pool.query('SELECT id FROM planes_obras_sociales WHERE obra_social_id = ? AND nombre = ?', [canonicalId, pNom]);
      if (chk.length === 0) {
        await pool.query('INSERT INTO planes_obras_sociales (obra_social_id, nombre) VALUES (?, ?)', [canonicalId, pNom]);
      }
    }
  }

  // 4. Asegurar que TODAS las obras sociales tengan al menos un Plan
  const [obrasSinPlanes] = await pool.query(`
    SELECT o.id, o.nombre 
    FROM obras_sociales o 
    LEFT JOIN planes_obras_sociales p ON o.id = p.obra_social_id 
    WHERE p.id IS NULL
  `);

  if (obrasSinPlanes.length > 0) {
    console.log(`Asignando Plan General a ${obrasSinPlanes.length} obras sociales sin planes...`);
    const values = obrasSinPlanes.map(o => [o.id, 'Plan General']);
    // Batch in chunks of 500
    for (let i = 0; i < values.length; i += 500) {
      const chunk = values.slice(i, i + 500);
      await pool.query('INSERT INTO planes_obras_sociales (obra_social_id, nombre) VALUES ?', [chunk]);
    }
  }

  // 5. Asegurar que oscarns@gmail.com sea administrador
  await pool.query("UPDATE usuarios SET rol = 'admin' WHERE email = 'oscarns@gmail.com'");

  console.log('--- Limpieza y Consolidación Completada Exitosamente ---');
  process.exit(0);
}

run().catch(err => {
  console.error('Error durante la ejecución:', err);
  process.exit(1);
});
