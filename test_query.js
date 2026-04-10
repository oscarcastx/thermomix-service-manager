const db = require('./backend/src/config/db');
async function run() {
  const query = `
        SELECT o.orden_servicio, o.modelo, o.estado as estado_actual, o.tipo_proceso, o.tiempo_pausado_segundos,
               CASE 
                 WHEN h.estado_nuevo = 'DIAGNOSTICO_TERMINADO' THEN 'DIAGNOSTICO'
                 WHEN h.estado_nuevo = 'REPARACION_TERMINADA' THEN 'REPARACION'
                 ELSE h.estado_nuevo
               END as accion,
               (SELECT fecha FROM historial_ordenes 
                WHERE orden_id = o.id 
                  AND estado_nuevo = CASE WHEN h.estado_nuevo = 'DIAGNOSTICO_TERMINADO' THEN 'EN_DIAGNOSTICO' ELSE 'EN_REPARACION' END 
                ORDER BY fecha DESC LIMIT 1) as fecha_inicio_real,
               h.fecha as fecha_fin_real
        FROM historial_ordenes h
        JOIN ordenes o ON h.orden_id = o.id
        WHERE h.usuario_id = $1 
        ORDER BY h.fecha ASC`;
  const result = await db.query(query, [16]);
  console.log(result.rows);
  process.exit(0);
}
run();
