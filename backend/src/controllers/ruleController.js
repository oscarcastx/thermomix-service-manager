const db = require('../config/db');

const createRule = async (req, res) => {
  const { tecnico_id, modelo, tipo_proceso, fecha } = req.body;
  const dateStr = fecha || new Date().toISOString().split('T')[0];

  if (!tecnico_id || !modelo || !tipo_proceso) {
    return res.status(400).json({ error: 'Faltan campos requeridos.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO reglas (fecha, tecnico_id, modelo, tipo_proceso, activo) 
       VALUES ($1, $2, $3, $4, true) 
       ON CONFLICT (fecha, tecnico_id) 
       DO UPDATE SET modelo = EXCLUDED.modelo, tipo_proceso = EXCLUDED.tipo_proceso, activo = true
       RETURNING *`,
      [dateStr, tecnico_id, modelo, tipo_proceso]
    );

    res.status(201).json({ message: 'Regla configurada correctamente.', regla: result.rows[0] });
  } catch (error) {
    console.error('Error al crear regla:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const getRulesByDate = async (req, res) => {
  const { fecha } = req.query;
  const dateStr = fecha || new Date().toISOString().split('T')[0];

  try {
    const result = await db.query(
      `SELECT r.*, u.nombre as tecnico_nombre 
       FROM reglas r 
       JOIN usuarios u ON r.tecnico_id = u.id 
       WHERE r.fecha = $1 AND r.activo = true`,
      [dateStr]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener reglas:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const deleteRule = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('UPDATE reglas SET activo = false WHERE id = $1', [id]);
    res.json({ message: 'Regla desactivada.' });
  } catch (error) {
    console.error('Error al eliminar regla:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const getMyRule = async (req, res) => {
  const tecnicoId = req.user.id;
  const today = new Date().toISOString().split('T')[0];
  try {
    const result = await db.query(
      "SELECT modelo, tipo_proceso FROM reglas WHERE tecnico_id = $1 AND fecha = $2 AND activo = true",
      [tecnicoId, today]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

module.exports = { createRule, getRulesByDate, deleteRule, getMyRule };
