const db = require('./backend/src/config/db');

async function testTechnician4() {
    const tecnicoId = 4;
    const today = new Date().toISOString().split('T')[0];

    try {
        const activeOrder = await db.query("SELECT * FROM ordenes WHERE tecnico_id = $1 AND estado = 'en_proceso'", [tecnicoId]);
        if (activeOrder.rows.length > 0) {
            console.log('Ya tiene activa');
            process.exit(0);
        }

        const ruleResult = await db.query("SELECT modelo, tipo_proceso FROM reglas WHERE tecnico_id = $1 AND fecha = $2 AND activo = true", [tecnicoId, today]);
        if (ruleResult.rows.length === 0) {
            console.log('No rule for today:', today);
            process.exit(0);
        }

        const rule = ruleResult.rows[0];
        console.log("Rule:", rule);

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
        
        if (orderResult.rows.length === 0) {
            console.log("No orders available");
            process.exit(0);
        }

        const orderId = orderResult.rows[0].id;
        console.log("Order found:", orderId);

        const updatedOrder = await db.query(
          `UPDATE ordenes 
           SET tecnico_id = $1, estado = 'en_proceso', fecha_inicio = NOW() 
           WHERE id = $2 
           RETURNING *`,
          [tecnicoId, orderId]
        );

        console.log("Updated:", updatedOrder.rows[0]);
        process.exit(0);

    } catch (e) {
        console.error("CRASH ERROR:", e);
        process.exit(1);
    }
}
testTechnician4();
