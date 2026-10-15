const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'oscarsoft_turnos',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  charset: 'utf8mb4'
});

async function ensureSchema() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'username'`
    );
    if (!cols || cols.length === 0) {
      console.log('🔄 Agregando columna username a tabla usuarios...');
      await pool.query(
        `ALTER TABLE usuarios ADD COLUMN username VARCHAR(60) NULL DEFAULT NULL, ADD UNIQUE KEY idx_usuario_username (username)`
      );
      console.log('✅ Columna username agregada a usuarios exitosamente.');
    }

    const [turnoCols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'turnos' AND COLUMN_NAME IN ('aviso_retraso', 'mensaje_medico')`
    );
    const existingTurnoCols = turnoCols.map(c => c.COLUMN_NAME);
    if (!existingTurnoCols.includes('aviso_retraso')) {
      await pool.query(`ALTER TABLE turnos ADD COLUMN aviso_retraso VARCHAR(255) NULL DEFAULT NULL AFTER notas`);
    }
    if (!existingTurnoCols.includes('mensaje_medico')) {
      await pool.query(`ALTER TABLE turnos ADD COLUMN mensaje_medico VARCHAR(255) NULL DEFAULT NULL AFTER aviso_retraso`);
    }
  } catch (err) {
    console.warn('ℹ️ Inicialización schema:', err.message);
  }
}

pool.getConnection()
  .then(async (conn) => {
    console.log(`✅ Conexión exitosa a MySQL: ${process.env.DB_NAME} en ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`);
    conn.release();
    await ensureSchema();
  })
  .catch((err) => {
    console.error('❌ Error conectando a MySQL:', err.message);
  });

module.exports = pool;
