const bcrypt = require('bcrypt');
async function run() {
    const hash = await bcrypt.hash('admin123', 10);
    console.log(hash);
    
    // Auto-update the DB 
    const { Pool } = require('pg');
    require('dotenv').config();
    const pool = new Pool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
    });
    
    await pool.query('UPDATE usuarios SET password = $1 WHERE email = $2', [hash, 'admin@thermomix.com']);
    console.log("DB Updated");
    process.exit(0);
}
run();
