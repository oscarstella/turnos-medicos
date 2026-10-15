const pool = require('../db');

/**
 * Obtiene los feriados de un año desde la base de datos
 */
async function getFeriados(year = new Date().getFullYear()) {
  const [rows] = await pool.query(
    `SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') as fecha, nombre, tipo, activo, creado_en
     FROM feriados
     WHERE YEAR(fecha) = ?
     ORDER BY fecha ASC`,
    [year]
  );
  return rows;
}

/**
 * Sincroniza los feriados oficiales de Argentina para un año desde la API pública de ArgentinaDatos
 */
async function sincronizarFeriados(year = new Date().getFullYear()) {
  try {
    const url = `https://api.argentinadatos.com/v1/feriados/${year}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error en API ArgentinaDatos: ${response.statusText}`);
    }
    const feriadosApi = await response.json();

    if (!Array.isArray(feriadosApi) || feriadosApi.length === 0) {
      return { total: 0, insertados: 0, mensaje: 'No se encontraron feriados para este año.' };
    }

    let insertados = 0;
    for (const f of feriadosApi) {
      if (!f.fecha || !f.nombre) continue;
      // Usar INSERT IGNORE para no sobreescribir si el admin ya lo configuró manualmente
      const [res] = await pool.query(
        `INSERT INTO feriados (fecha, nombre, tipo, activo)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE 
           nombre = COALESCE(nombre, VALUES(nombre)),
           tipo = COALESCE(tipo, VALUES(tipo))`,
        [f.fecha, f.nombre, f.tipo || 'nacional']
      );
      if (res.affectedRows > 0) insertados++;
    }

    return {
      total: feriadosApi.length,
      insertados,
      mensaje: `Sincronizados ${feriadosApi.length} feriados para el año ${year}.`
    };
  } catch (error) {
    console.error(`Error sincronizando feriados para ${year}:`, error);
    throw error;
  }
}

/**
 * Agrega un feriado o día no laborable manualmente
 */
async function crearFeriado({ fecha, nombre, tipo = 'manual' }) {
  if (!fecha || !nombre) {
    throw new Error('Fecha y motivo son obligatorios.');
  }
  const [res] = await pool.query(
    `INSERT INTO feriados (fecha, nombre, tipo, activo)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE 
       nombre = VALUES(nombre),
       tipo = VALUES(tipo),
       activo = 1`,
    [fecha, nombre.trim(), tipo]
  );
  return { id: res.insertId, fecha, nombre, tipo, activo: 1 };
}

/**
 * Activa o desactiva (bloquea o desbloquea) un feriado
 */
async function toggleFeriado(id, activo) {
  await pool.query('UPDATE feriados SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]);
  return { id, activo: Boolean(activo) };
}

/**
 * Elimina un feriado
 */
async function eliminarFeriado(id) {
  await pool.query('DELETE FROM feriados WHERE id = ?', [id]);
  return { id, eliminado: true };
}

/**
 * Verifica si una fecha puntual (YYYY-MM-DD) es feriado activo
 */
async function esFeriado(fechaYmd) {
  const [rows] = await pool.query(
    'SELECT id, nombre, tipo FROM feriados WHERE fecha = ? AND activo = 1 LIMIT 1',
    [fechaYmd]
  );
  if (rows.length > 0) {
    return { esFeriado: true, feriado: rows[0] };
  }
  return { esFeriado: false, feriado: null };
}

/**
 * Obtiene un Set de fechas feriadas (YYYY-MM-DD) para un rango
 */
async function getFeriadosActivosMap(desdeYmd, hastaYmd) {
  let sql = 'SELECT DATE_FORMAT(fecha, \'%Y-%m-%d\') as fecha, nombre FROM feriados WHERE activo = 1';
  const params = [];
  if (desdeYmd && hastaYmd) {
    sql += ' AND fecha BETWEEN ? AND ?';
    params.push(desdeYmd, hastaYmd);
  }
  const [rows] = await pool.query(sql, params);
  const map = new Map();
  for (const r of rows) {
    map.set(r.fecha, r.nombre);
  }
  return map;
}

module.exports = {
  getFeriados,
  sincronizarFeriados,
  crearFeriado,
  toggleFeriado,
  eliminarFeriado,
  esFeriado,
  getFeriadosActivosMap
};
