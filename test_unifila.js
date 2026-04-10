const db = require('./backend/src/config/db');

async function testTakeOrder() {
    const tecnicoId = 3; // Assuming user ID 3 is the technician the user created
    const today = new Date().toISOString().split('T')[0];

    try {
        // 1. Verify if technician already has an active order
        const activeOrder = await db.query(
            "SELECT * FROM ordenes WHERE tecnico_id = $1 AND estado = 'en_proceso'",
            [tecnicoId]
        );
        console.log('Active check passed');

        // 2. Get technician's rule for today
        const ruleResult = await db.query(
            "SELECT modelo, tipo_proceso FROM reglas WHERE tecnico_id = $1 AND fecha = $2 AND activo = true",
            [tecnicoId, today]
        );
        console.log('Rule check passed', ruleResult.rows);

        if (ruleResult.rows.length === 0) {
            console.log('No rule found - insert a mockup rule');
            await db.query(`INSERT INTO reglas (fecha, tecnico_id, modelo, tipo_proceso, activo) VALUES ($1, $2, 'TM6', 'diagnostico', true)`, [today, tecnicoId]);
        }

        // Just use TM6 diagnostico
        const rule = { modelo: 'TM6', tipo_proceso: 'diagnostico' };

        // mock an order
        await db.query(`INSERT INTO ordenes (orden_servicio, modelo, tipo_proceso, estado) VALUES ('99999', 'TM6', 'diagnostico', 'pendiente_diagnostico') ON CONFLICT DO NOTHING`);

        const validStates = rule.tipo_proceso === 'diagnostico' 
        ? "('pendiente_diagnostico')" 
        : "('pendiente_reparacion')";

        const query = `
        SELECT id FROM ordenes 
        WHERE modelo = $1 
            AND tipo_proceso = $2 
            AND estado IN ${validStates}
            AND tecnico_id IS NULL 
        ORDER BY prioridad DESC, fecha_ingreso ASC 
        LIMIT 1
        `;

        const orderResult = await db.query(query, [rule.modelo, rule.tipo_proceso]);
        console.log('Order found:', orderResult.rows);

        process.exit(0);
    } catch (e) {
        console.error("RAW ERROR:", e.message);
        process.exit(1);
    }
}

testTakeOrder();
