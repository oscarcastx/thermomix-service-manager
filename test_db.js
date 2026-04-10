const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

async function test() {
    try {
        const res = await pool.query('SELECT * FROM usuarios');
        console.log('Usuarios en la BD:', res.rows);
        process.exit(0);
    } catch (err) {
        console.error('Error connecting to DB:', err.message);
        process.exit(1);
    }
}

test();
