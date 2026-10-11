const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const families = [
  { canonical: 'Accord salud', prefixes: ['accord salud', 'accord'] },
  { canonical: 'OSDE', prefixes: ['osde', 'o.s.d.e.'] },
  { canonical: 'Swiss Medical Group', prefixes: ['swiss medical group', 'swiss medical', 'smg', 'art swiss medical'] },
  { canonical: 'Galeno', prefixes: ['galeno', 'art galeno'] },
  { canonical: 'Sancor Salud', prefixes: ['sancor salud', 'sancor'] },
  { canonical: 'Medifé', prefixes: ['medifé', 'medife'] },
  { canonical: 'OMINT', prefixes: ['omint'] },
  { canonical: 'Medicus', prefixes: ['medicus'] },
  { canonical: 'Activa Salud', prefixes: ['activa salud'] },
  { canonical: 'ACA Salud', prefixes: ['aca salud'] },
  { canonical: 'A.M.B.A.R. (Asociación Mutual Bancarios Roca)', prefixes: ['a.m.b.a.r.', 'ambar'] },
  { canonical: 'Bristol Medicine', prefixes: ['bristol medicine'] },
  { canonical: 'Federada Salud', prefixes: ['federada salud'] },
  { canonical: 'IOMA', prefixes: ['ioma'] },
  { canonical: 'PAMI', prefixes: ['pami'] },
  { canonical: 'Luis Pasteur', prefixes: ['luis pasteur'] },
  { canonical: 'Jerárquicos Salud', prefixes: ['jerárquicos salud', 'jerarquicos salud', 'jerarquicos'] },
  { canonical: 'Prevención Salud', prefixes: ['prevencion salud', 'prevención salud'] },
  { canonical: 'OSDEL (Locutores)', prefixes: ['osdel (locutores)', 'osdel'] },
  { canonical: 'Osdepym', prefixes: ['osdepym'] },
  { canonical: 'OSECAC', prefixes: ['osecac'] },
  { canonical: 'Unión Personal', prefixes: ['union personal', 'unión personal', 'up '] }
];

function cleanPlanName(raw, prefixList) {
  let p = raw;
  for (const pr of prefixList) {
    if (p.toLowerCase().startsWith(pr)) {
      p = p.substring(pr.length).trim();
      break;
    }
  }
  p = p.replace(/^[-–—/:]+\s*/, '').trim();
  p = p.replace(/^accord\s+/i, '').trim();
  p = p.replace(/^docthos\s+/i, '').trim();
  p = p.replace(/^plan\s+/i, '').trim();
  p = p.replace(/^planes\s+/i, '').trim();
  if (!p || p.toLowerCase() === 'único' || p.toLowerCase() === 'unico') return null;
  return 'Plan ' + p;
}

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'oscarsoft_turnos'
  });

  console.log('=== CONSOLIDACIÓN MASIVA Y RÁPIDA DE PLANES DE OBRAS SOCIALES ===');

  // 1. Cargar archivo docturno_obras_sociales.sql
  const sqlFile = path.join(__dirname, '../../docturno_obras_sociales.sql');
  let rawEntries = [];
  if (fs.existsSync(sqlFile)) {
    const content = fs.readFileSync(sqlFile, 'utf8');
    const lines = content.split('\n').filter(l => l.includes('('));
    rawEntries = lines.map(l => {
      const m = l.match(/\('([^']+)'\)/);
      return m ? m[1].trim() : null;
    }).filter(Boolean);
    console.log(`Leídas ${rawEntries.length} entradas de docturno_obras_sociales.sql`);
  }

  // 2. Traer en memoria todas las obras sociales y todos los planes
  const [allOS] = await pool.query('SELECT id, nombre FROM obras_sociales');
  console.log(`Obras sociales en DB: ${allOS.length}`);

  const [allPlanes] = await pool.query('SELECT id, obra_social_id, nombre FROM planes_obras_sociales');
  console.log(`Planes existentes en DB: ${allPlanes.length}`);

  // Mapa de planes existentes por obra_social_id: { [osId]: Set(planNamesLower) }
  const planesByOS = new Map();
  // Mapa de plan id por (osId + planNameLower)
  const planIdMap = new Map();
  for (const p of allPlanes) {
    if (!planesByOS.has(p.obra_social_id)) planesByOS.set(p.obra_social_id, new Set());
    planesByOS.get(p.obra_social_id).add(p.nombre.toLowerCase().trim());
    planIdMap.set(`${p.obra_social_id}_${p.nombre.toLowerCase().trim()}`, p.id);
  }

  const toInsert = []; // [[obra_social_id, nombre]]
  const toUpdate = []; // [{ id, nombre }]

  for (const fam of families) {
    // Buscar la OS canónica
    let canonicalOS = allOS.find(o => o.nombre.toLowerCase() === fam.canonical.toLowerCase());
    if (!canonicalOS) {
      const candidates = allOS.filter(o => fam.prefixes.some(pr => o.nombre.toLowerCase().startsWith(pr)));
      candidates.sort((a, b) => a.nombre.length - b.nombre.length);
      if (candidates.length > 0) canonicalOS = candidates[0];
    }

    if (!canonicalOS) {
      const [insRes] = await pool.query('INSERT INTO obras_sociales (nombre) VALUES (?)', [fam.canonical]);
      canonicalOS = { id: insRes.insertId, nombre: fam.canonical };
      allOS.push(canonicalOS);
    }

    if (!planesByOS.has(canonicalOS.id)) planesByOS.set(canonicalOS.id, new Set());
    const canonicalSet = planesByOS.get(canonicalOS.id);

    // Extraer de docturno_obras_sociales.sql
    for (const raw of rawEntries) {
      const lower = raw.toLowerCase();
      if (fam.prefixes.some(pr => lower.startsWith(pr))) {
        const clean = cleanPlanName(raw, fam.prefixes);
        if (clean && !canonicalSet.has(clean.toLowerCase())) {
          toInsert.push([canonicalOS.id, clean]);
          canonicalSet.add(clean.toLowerCase());
        }
      }
    }

    // Extraer de las variantes
    const variantOS = allOS.filter(o => fam.prefixes.some(pr => o.nombre.toLowerCase().startsWith(pr)));
    for (const v of variantOS) {
      const clean = cleanPlanName(v.nombre, fam.prefixes);
      if (clean && !canonicalSet.has(clean.toLowerCase())) {
        toInsert.push([canonicalOS.id, clean]);
        canonicalSet.add(clean.toLowerCase());
      }

      // Si la variante tiene "Plan Único", actualizarla
      if (clean && v.id !== canonicalOS.id) {
        const vSet = planesByOS.get(v.id);
        if (vSet && (vSet.has('plan único') || vSet.has('plan unico'))) {
          const unicoKey = vSet.has('plan único') ? `${v.id}_plan único` : `${v.id}_plan unico`;
          const pId = planIdMap.get(unicoKey);
          if (pId) {
            toUpdate.push({ id: pId, nombre: clean });
          }
        }
      }
    }
  }

  // 3. Procesar las demás entradas con "Plan "
  for (const raw of rawEntries) {
    if (raw.toLowerCase().includes(' plan ')) {
      const parts = raw.split(/ plan /i);
      if (parts.length === 2) {
        const osNom = parts[0].trim();
        const planNom = 'Plan ' + parts[1].trim();

        const matchedOS = allOS.find(o => o.nombre.toLowerCase() === osNom.toLowerCase());
        if (matchedOS) {
          if (!planesByOS.has(matchedOS.id)) planesByOS.set(matchedOS.id, new Set());
          const set = planesByOS.get(matchedOS.id);
          if (!set.has(planNom.toLowerCase())) {
            toInsert.push([matchedOS.id, planNom]);
            set.add(planNom.toLowerCase());
          }
        }
      }
    }
  }

  // 4. Asegurar que las obras sociales que queden con 0 planes tengan "Plan General"
  for (const o of allOS) {
    const set = planesByOS.get(o.id);
    if (!set || set.size === 0) {
      toInsert.push([o.id, 'Plan General']);
      if (!planesByOS.has(o.id)) planesByOS.set(o.id, new Set());
      planesByOS.get(o.id).add('plan general');
    }
  }

  console.log(`Planes a insertar: ${toInsert.length}`);
  console.log(`Planes a actualizar (de Plan Único a nombre real): ${toUpdate.length}`);

  // Ejecutar inserts por lotes de 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    await pool.query('INSERT INTO planes_obras_sociales (obra_social_id, nombre) VALUES ?', [batch]);
  }

  // Ejecutar updates
  for (const u of toUpdate) {
    await pool.query('UPDATE planes_obras_sociales SET nombre = ? WHERE id = ?', [u.nombre, u.id]);
  }

  const [finalPlanesCount] = await pool.query('SELECT COUNT(*) as c FROM planes_obras_sociales');
  console.log(`\n=== CONSOLIDACIÓN COMPLETADA EXITOSAMENTE ===`);
  console.log(`Total de planes ahora en la base de datos: ${finalPlanesCount[0].c}`);

  await pool.end();
}

run().catch(console.error);
