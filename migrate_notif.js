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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id SERIAL PRIMARY KEY,
        usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        mensaje TEXT NOT NULL,
        leida BOOLEAN DEFAULT false,
        fecha TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Migration notifications successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    pool.end();
  }
}
migrate();
