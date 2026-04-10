const db = require('../config/db');

const getStats = async (req, res) => {
  try {
    const statusCounts = await db.query(
      `SELECT estado, COUNT(*) as cantidad FROM ordenes GROUP BY estado`
    );

    const techLoad = await db.query(
      `SELECT u.nombre as tecnico, COUNT(o.id) as ordenes_activas 
       FROM usuarios u 
       LEFT JOIN ordenes o ON ((o.tecnico_diagnostico_id = u.id AND o.estado = 'EN_DIAGNOSTICO') OR (o.tecnico_reparacion_id = u.id AND o.estado = 'EN_REPARACION'))
       WHERE u.rol = 'tecnico' AND u.activo = true
       GROUP BY u.id, u.nombre`
    );

    res.json({
      ordersByStatus: statusCounts.rows,
      technicianLoad: techLoad.rows
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Error fetching stats' });
  }
};

const getTechnicians = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const result = await db.query(
      `SELECT u.id, u.nombre, u.email, r.modelo, r.tipo_proceso as tarea_hoy
       FROM usuarios u
       LEFT JOIN reglas r ON r.tecnico_id = u.id AND r.fecha = $1 AND r.activo = true
       WHERE u.rol = 'tecnico' AND u.activo = true`,
      [today]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching technicians:', error);
    res.status(500).json({ error: 'Error fetching technicians' });
  }
};

const getOrderHistory = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT h.id, h.estado_anterior, h.estado_nuevo, h.fecha, u.nombre as responsable, u.rol
       FROM historial_ordenes h
       LEFT JOIN usuarios u ON h.usuario_id = u.id
       WHERE h.orden_id = $1
       ORDER BY h.fecha ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching order history:', error);
    res.status(500).json({ error: 'Error fetching order history' });
  }
};

const getActivity = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT h.id, o.orden_servicio, h.estado_anterior, h.estado_nuevo, h.fecha, u.nombre as responsable
       FROM historial_ordenes h
       JOIN ordenes o ON h.orden_id = o.id
       LEFT JOIN usuarios u ON h.usuario_id = u.id
       ORDER BY h.fecha DESC
       LIMIT 30`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Error fetching activity' });
  }
};

const getReport = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.id, o.orden_servicio, o.modelo, o.prioridad, o.estado, o.tipo_proceso, 
              o.fecha_creacion, o.fecha_pago, o.fecha_fin,
              ue.nombre AS ejecutivo, 
              ud.nombre AS tecnico_diagnostico, 
              ur.nombre AS tecnico_reparacion
       FROM ordenes o
       LEFT JOIN usuarios ue ON o.ejecutivo_id = ue.id
       LEFT JOIN usuarios ud ON o.tecnico_diagnostico_id = ud.id
       LEFT JOIN usuarios ur ON o.tecnico_reparacion_id = ur.id
       ORDER BY o.fecha_creacion DESC`
    );

    const rows = result.rows;
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No orders found for the report' });
    }

    const headers = Object.keys(rows[0]).join(',');
    const csvContent = [
      headers,
      ...rows.map(row => 
        Object.values(row).map(val => {
          if (val === null || val === undefined) return '';
          if (val instanceof Date) {
            const dateStr = val.toLocaleString('es-MX', { timeZone: 'America/Mexico_City', hour12: false });
            return `"${dateStr}"`;
          }
          const str = String(val);
          return str.includes(',') ? `"${str}"` : str;
        }).join(',')
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte_ordenes.csv');
    res.send(csvContent);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Error generating report' });
  }
};

module.exports = { getStats, getTechnicians, getOrderHistory, getReport, getActivity };
