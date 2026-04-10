const db = require('../config/db');

const getConfig = async (req, res) => {
  try {
    const result = await db.query('SELECT modo_asignacion FROM configuracion WHERE id = 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Configuración no encontrada.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const updateConfig = async (req, res) => {
  const { modo_asignacion } = req.body;
  if (!modo_asignacion || !['AUTO_POR_TAREA', 'MISMO_TECNICO'].includes(modo_asignacion)) {
    return res.status(400).json({ error: 'Modo de asignación inválido.' });
  }

  try {
    const result = await db.query(
      'UPDATE configuracion SET modo_asignacion = $1 WHERE id = 1 RETURNING modo_asignacion',
      [modo_asignacion]
    );

    if (modo_asignacion === 'AUTO_POR_TAREA') {
      await db.query("UPDATE ordenes SET tecnico_reparacion_id = NULL WHERE estado = 'PAGADO'");
    }

    res.json({ message: 'Configuración actualizada con éxito.', modo_asignacion: result.rows[0].modo_asignacion });
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

module.exports = { getConfig, updateConfig };
