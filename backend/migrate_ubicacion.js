const db = require('./src/config/db');

async function migrate() {
    try {
        console.log('Adding ubicacion column to ordenes...');

        await db.query(`ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS ubicacion TEXT;`);
        console.log('Added ubicacion');

        console.log('Migration done.');
        process.exit(0);
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    } finally {
        db.pool.end();
    }
}

migrate();
