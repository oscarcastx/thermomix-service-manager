const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await db.query('SELECT * FROM usuarios WHERE email = $1 AND activo = true', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const unUsuario = result.rows[0];
    const match = await bcrypt.compare(password, unUsuario.password);

    if (!match) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const token = jwt.sign(
      { id: unUsuario.id, rol: unUsuario.rol, nombre: unUsuario.nombre },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, user: { id: unUsuario.id, rol: unUsuario.rol, nombre: unUsuario.nombre } });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const createUser = async (req, res) => {
  const { nombre, email, password, rol } = req.body;

  if (!['supervisor', 'ejecutivo', 'tecnico'].includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido.' });
  }

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await db.query(
      'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, rol',
      [nombre, email, hashedPassword, rol]
    );

    res.status(201).json({ message: 'Usuario creado exitosamente', user: result.rows[0] });
  } catch (error) {
    console.error('Error en createUser:', error);
    if (error.code === '23505') { // unique_violation postgres
      return res.status(400).json({ error: 'El email ya está registrado.' });
    }
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const getTechnicians = async (req, res) => {
  try {
    const result = await db.query("SELECT id, nombre, email FROM usuarios WHERE rol = 'tecnico' AND activo = true");
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo técnicos:', error);
    res.status(500).json({ error: 'Error obteniendo técnicos' });
  }
};

const getUsers = async (req, res) => {
  try {
    const result = await db.query("SELECT id, nombre, email, rol, activo FROM usuarios ORDER BY rol, nombre");
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query("DELETE FROM usuarios WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    if (error.code === '23503') { // foreign key 
      await db.query("UPDATE usuarios SET activo = false WHERE id = $1", [id]);
      return res.json({ message: "Usuario deshabilitado (tiene operaciones)."});
    }
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Error del servidor. ' + error.message });
  }
};

const getNotifications = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await db.query(
      "SELECT * FROM notificaciones WHERE usuario_id = $1 AND leida = false ORDER BY fecha DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const markNotificationRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const result = await db.query(
      "UPDATE notificaciones SET leida = true WHERE id = $1 AND usuario_id = $2 RETURNING *",
      [id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json({ message: 'Notificación leída' });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const getDailyReport = async (req, res) => {
  const { id, rol } = req.user;
  const targetDate = req.query.date || new Date().toISOString().split('T')[0];
  
  try {
    let query, params;

    if (rol === 'ejecutivo') {
      query = `
        SELECT o.orden_servicio, o.modelo, o.estado as estado_actual, o.tipo_proceso, o.tiempo_pausado_segundos,
               'GESTION_EJECUTIVA' as accion,
               o.fecha_creacion as fecha_inicio_real,
               COALESCE(o.fecha_pago, o.fecha_creacion) as fecha_fin_real
        FROM ordenes o
        WHERE o.ejecutivo_id = $1 
          AND (o.fecha_creacion::date = $2::date OR o.fecha_pago::date = $2::date)
        ORDER BY o.fecha_creacion ASC`;
      params = [id, targetDate];
    } else if (rol === 'tecnico') {
      query = `
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
          AND h.estado_nuevo IN ('DIAGNOSTICO_TERMINADO', 'REPARACION_TERMINADA')
          AND h.fecha::date = $2::date
        ORDER BY h.fecha ASC`;
      params = [id, targetDate];
    } else if (rol === 'supervisor') {
      // Supervisor can see everyone's report for the day
      query = `
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
        WHERE h.estado_nuevo IN ('DIAGNOSTICO_TERMINADO', 'REPARACION_TERMINADA')
          AND h.fecha::date = $1::date
        ORDER BY h.fecha ASC`;
      params = [targetDate];
    } else {
      return res.status(403).json({ error: 'Rol no soportado para este reporte' });
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error generating daily report:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { login, createUser, getTechnicians, getUsers, deleteUser, getNotifications, markNotificationRead, getDailyReport };