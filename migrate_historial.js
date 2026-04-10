require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function migrate() {
  try {
    console.log('Migrating historial_ordenes...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS historial_ordenes (
        id SERIAL PRIMARY KEY,
        orden_id INT NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
        estado_anterior VARCHAR(30) NULL,
        estado_nuevo VARCHAR(30) NOT NULL,
        usuario_id INT NULL REFERENCES usuarios(id),
        fecha TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    pool.end();
  }
}

migrate();
