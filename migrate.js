require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function migrate() {
  try {
    console.log('Starting migration...');
    // Drop the tables to start fresh
    await pool.query('DROP TABLE IF EXISTS ordenes CASCADE;');
    await pool.query('DROP TABLE IF EXISTS configuracion CASCADE;');
    // We do NOT drop usuarios or reglas to keep existing accounts and rules.
    // Wait, let's keep it simple. If we drop ordenes, it's fine.
    
    // Read database.sql
    const sqlPath = path.join(__dirname, 'backend', 'database.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sql);

    // Insert default config
    await pool.query(`INSERT INTO configuracion (id, modo_asignacion) VALUES (1, 'AUTO_POR_TAREA') ON CONFLICT (id) DO NOTHING;`);

    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    pool.end();
  }
}

migrate();
