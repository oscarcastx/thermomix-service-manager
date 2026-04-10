const db = require('./src/config/db');

async function migrate() {
    try {
        console.log('Adding columns for pause functionality in ordenes...');
        
        await db.query(`ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS tiempo_pausado_segundos INT DEFAULT 0;`);
        console.log('Added tiempo_pausado_segundos');
        
        await db.query(`ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS pausa_inicio TIMESTAMP NULL;`);
        console.log('Added pausa_inicio');

        console.log('Migration done.');
        process.exit(0);
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}

migrate();
