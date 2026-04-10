const db = require('./backend/src/config/db');

async function snapshot() {
    try {
        const u = await db.query('SELECT * FROM usuarios');
        console.log('--- USUARIOS ---');
        console.table(u.rows);

        const r = await db.query('SELECT * FROM reglas');
        console.log('--- REGLAS ---');
        console.table(r.rows);

        const o = await db.query('SELECT * FROM ordenes');
        console.log('--- ORDENES ---');
        console.table(o.rows);

        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
snapshot();
