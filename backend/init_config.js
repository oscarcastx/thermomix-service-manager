/**
 * init_config.js
 *
 * Initializes the `configuracion` table with the required default record.
 *
 * Run this script once after database creation if the configuracion table is
 * empty (e.g. after test data was wiped). Without this record the application
 * will crash with "Cannot read properties of undefined (reading
 * 'modo_asignacion')" whenever it tries to assign orders.
 *
 * Usage:
 *   node backend/init_config.js
 */

const db = require('./src/config/db');

async function initConfig() {
    try {
        console.log('Checking configuracion table...');

        const result = await db.query('SELECT id FROM configuracion WHERE id = 1');

        if (result.rows.length > 0) {
            console.log('Configuration record already exists (id=1). Nothing to do.');
        } else {
            await db.query(
                "INSERT INTO configuracion (id, modo_asignacion) VALUES (1, 'AUTO_POR_TAREA')"
            );
            console.log("Configuration record inserted: id=1, modo_asignacion='AUTO_POR_TAREA'.");
        }

        process.exit(0);
    } catch (err) {
        console.error('Failed to initialize configuration:', err);
        process.exit(1);
    } finally {
        db.pool.end();
    }
}

initConfig();
