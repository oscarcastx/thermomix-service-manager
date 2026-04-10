const db = require('../config/db');

const logHistory = async (orderId, estadoAnterior, estadoNuevo, usuarioId) => {
  try {
    await db.query(
      `INSERT INTO historial_ordenes (orden_id, estado_anterior, estado_nuevo, usuario_id) VALUES ($1, $2, $3, $4)`,
      [orderId, estadoAnterior, estadoNuevo, usuarioId]
    );
  } catch (error) {
    console.error('Error logging history:', error);
  }
};

const createOrder = async (req, res) => {
  const { orden_servicio, modelo, comentarios, prioridad } = req.body;
  const ejecutivoId = req.user.id;

  if (!orden_servicio || !modelo) {
    return res.status(400).json({ error: 'Número de orden y modelo son requeridos.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO ordenes (orden_servicio, modelo, comentarios, prioridad, estado, tipo_proceso, ejecutivo_id) 
       VALUES ($1, $2, $3, $4, 'CREADA', 'diagnostico', $5) 
       RETURNING *`,
      [orden_servicio, modelo, comentarios || '', prioridad || false, ejecutivoId]
    );

    res.status(201).json({ message: 'Orden creada exitosamente.', orden: result.rows[0] });
    await logHistory(result.rows[0].id, null, 'CREADA', req.user.id);
  } catch (error) {
    console.error('Error al crear orden:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El número de orden ya existe.' });
    }
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const getOrders = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.*, 
       u1.nombre as ejecutivo_nombre, 
       u2.nombre as tecnico_diagnostico_nombre,
       u3.nombre as tecnico_reparacion_nombre
       FROM ordenes o 
       LEFT JOIN usuarios u1 ON o.ejecutivo_id = u1.id 
       LEFT JOIN usuarios u2 ON o.tecnico_diagnostico_id = u2.id
       LEFT JOIN usuarios u3 ON o.tecnico_reparacion_id = u3.id
       ORDER BY o.fecha_creacion DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener órdenes:', error);
    res.status(500).json({ error: 'Error interno.' });
  }
};

const takeNextOrder = async (req, res) => {
  const tecnicoId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. Verify if technician already has an active order
    const activeOrder = await db.query(
      "SELECT * FROM ordenes WHERE (tecnico_diagnostico_id = $1 AND estado = 'EN_DIAGNOSTICO') OR (tecnico_reparacion_id = $1 AND estado = 'EN_REPARACION')",
      [tecnicoId]
    );

    if (activeOrder.rows.length > 0) {
      return res.status(400).json({ error: 'Ya tienes una orden en proceso. Finalízala antes de tomar otra.' });
    }

    // Read config
    const configResult = await db.query('SELECT modo_asignacion FROM configuracion WHERE id = 1');
    const modoAsignacion = configResult.rows[0].modo_asignacion;

    // Check if MISMO_TECNICO and has pending repairs assigned to him
    if (modoAsignacion === 'MISMO_TECNICO') {
      const pendingRepair = await db.query(
        "SELECT id FROM ordenes WHERE estado = 'PAGADO' AND tecnico_reparacion_id = $1 ORDER BY prioridad DESC, fecha_pago ASC LIMIT 1",
        [tecnicoId]
      );
      
      if (pendingRepair.rows.length > 0) {
         const updatedOrder = await db.query(
          `UPDATE ordenes 
           SET estado = 'EN_REPARACION', fecha_inicio = NOW(), tiempo_pausado_segundos = 0 
           WHERE id = $1 
           RETURNING *`,
          [pendingRepair.rows[0].id]
        );
        await logHistory(updatedOrder.rows[0].id, 'PAGADO', 'EN_REPARACION', req.user.id);
        return res.json({ message: 'Orden de reparación continuada (MISMO_TECNICO).', orden: updatedOrder.rows[0] });
      }
    }

    // 2. Get technician's rule for today
    const ruleResult = await db.query(
      "SELECT modelo, tipo_proceso FROM reglas WHERE tecnico_id = $1 AND fecha = $2 AND activo = true",
      [tecnicoId, today]
    );

    if (ruleResult.rows.length === 0) {
      return res.status(404).json({ error: 'No tienes una regla asignada para hoy. Contacta a un supervisor.' });
    }

    const rule = ruleResult.rows[0];

    // 3. Find next available order matching the rule (UNIFILA LOGIC)
    let query, params;

    if (rule.tipo_proceso === 'diagnostico') {
      query = `
        SELECT id FROM ordenes 
        WHERE modelo = $1 
          AND estado = 'CREADA' 
          AND tecnico_diagnostico_id IS NULL 
        ORDER BY prioridad DESC, fecha_creacion ASC 
        LIMIT 1
      `;
      params = [rule.modelo];
    } else if (rule.tipo_proceso === 'reparacion') {
      if (modoAsignacion === 'AUTO_POR_TAREA') {
        query = `
          SELECT id FROM ordenes 
          WHERE modelo = $1 
            AND estado = 'PAGADO' 
            AND tecnico_reparacion_id IS NULL 
          ORDER BY prioridad DESC, fecha_pago ASC 
          LIMIT 1
        `;
        params = [rule.modelo];
      } else {
        return res.status(400).json({ error: 'Tu regla es de reparación, pero estamos en modo MISMO_TECNICO. La asignación es automática a quien diagnosticó.' });
      }
    }

    const orderResult = await db.query(query, params);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'No hay órdenes disponibles para tu configuración actual en este momento.' });
    }

    const orderId = orderResult.rows[0].id;

    // 4. Assign the order
    let updateQuery;
    if (rule.tipo_proceso === 'diagnostico') {
      updateQuery = `UPDATE ordenes SET tecnico_diagnostico_id = $1, estado = 'EN_DIAGNOSTICO', fecha_inicio = NOW(), tiempo_pausado_segundos = 0 WHERE id = $2 RETURNING *`;
    } else {
      updateQuery = `UPDATE ordenes SET tecnico_reparacion_id = $1, estado = 'EN_REPARACION', fecha_inicio = NOW(), tiempo_pausado_segundos = 0 WHERE id = $2 RETURNING *`;
    }

    const updatedOrder = await db.query(updateQuery, [tecnicoId, orderId]);

    const estNuevo = rule.tipo_proceso === 'diagnostico' ? 'EN_DIAGNOSTICO' : 'EN_REPARACION';
    const estViejo = rule.tipo_proceso === 'diagnostico' ? 'CREADA' : 'PAGADO';
    await logHistory(orderId, estViejo, estNuevo, req.user.id);

    res.json({ message: 'Orden asignada con éxito.', orden: updatedOrder.rows[0] });

  } catch (error) {
    console.error('Error en unifila:', error);
    res.status(500).json({ error: `Error interno procesando la asignación. Detalle técnico: ${error.message}` });
  }
};

const finishTask = async (req, res) => {
  const { id } = req.params;
  const tecnicoId = req.user.id;

  try {
    const orderReq = await db.query(
      "SELECT * FROM ordenes WHERE id = $1 AND ((tecnico_diagnostico_id = $2 AND estado = 'EN_DIAGNOSTICO') OR (tecnico_reparacion_id = $2 AND estado = 'EN_REPARACION'))", 
      [id, tecnicoId]
    );
    if (orderReq.rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada o no asignada a ti.' });
    }

    const order = orderReq.rows[0];
    if (order.pausa_inicio !== null) {
       return res.status(400).json({ error: 'La orden está pausada. Reanúdala antes de finalizarla.' });
    }
    
    let query, params;

    if (order.estado === 'EN_DIAGNOSTICO') {
      query = "UPDATE ordenes SET estado = 'DIAGNOSTICO_TERMINADO' WHERE id = $1 RETURNING *";
      params = [id];
      await db.query(`INSERT INTO notificaciones (usuario_id, mensaje) VALUES ($1, $2)`, 
        [order.ejecutivo_id, `El diagnóstico de la orden ${order.orden_servicio} ha finalizado y está lista para cobro.`]);
    } else if (order.estado === 'EN_REPARACION') {
      query = "UPDATE ordenes SET estado = 'REPARACION_TERMINADA', fecha_fin = CASE WHEN fecha_fin IS NULL THEN NOW() ELSE fecha_fin END WHERE id = $1 RETURNING *";
      params = [id];
      await db.query(`INSERT INTO notificaciones (usuario_id, mensaje) VALUES ($1, $2)`, 
        [order.ejecutivo_id, `La reparación de la orden ${order.orden_servicio} ha sido completada.`]);
    }

    const updated = await db.query(query, params);
    await logHistory(id, order.estado, order.estado === 'EN_DIAGNOSTICO' ? 'DIAGNOSTICO_TERMINADO' : 'REPARACION_TERMINADA', req.user.id);
    res.json({ message: 'Proceso finalizado.', orden: updated.rows[0] });

  } catch (error) {
    console.error('Error finalizando tarea:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const registerPayment = async (req, res) => {
  const { id } = req.params;

  try {
    const orderReq = await db.query("SELECT * FROM ordenes WHERE id = $1", [id]);
    if (orderReq.rows.length === 0) return res.status(404).json({ error: 'Orden no encontrada.' });
    const order = orderReq.rows[0];

    if (!['DIAGNOSTICO_TERMINADO', 'ESPERANDO_PAGO'].includes(order.estado)) {
      return res.status(400).json({ error: 'La orden no se encuentra en un estado válido para registrar pago.' });
    }

    const configResult = await db.query('SELECT modo_asignacion FROM configuracion WHERE id = 1');
    const modoAsignacion = configResult.rows[0].modo_asignacion;

    let updateQuery;
    let params;

    if (modoAsignacion === 'MISMO_TECNICO') {
      updateQuery = `
        UPDATE ordenes 
        SET estado = 'PAGADO', 
            tecnico_reparacion_id = $2, 
            tipo_proceso = 'reparacion',
            fecha_pago = NOW() 
        WHERE id = $1 
        RETURNING *`;
      params = [id, order.tecnico_diagnostico_id];
    } else {
      updateQuery = `
        UPDATE ordenes 
        SET estado = 'PAGADO', 
            tipo_proceso = 'reparacion',
            fecha_pago = NOW() 
        WHERE id = $1 
        RETURNING *`;
      params = [id];
    }

    const updated = await db.query(updateQuery, params);
    await logHistory(id, order.estado, 'PAGADO', req.user.id);
    res.json({ message: 'Pago registrado exitosamente. Orden enrutada a fila de reparación.', orden: updated.rows[0] });

  } catch (error) {
    console.error('Error registrando pago:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const markFinished = async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await db.query(
      `UPDATE ordenes SET estado = 'FINALIZADA' WHERE id = $1 AND estado = 'REPARACION_TERMINADA' RETURNING *`,
      [id]
    );

    if (updated.rows.length === 0) {
      return res.status(400).json({ error: 'La orden no se encuentra en estado REPARACION_TERMINADA.' });
    }

    await logHistory(id, 'REPARACION_TERMINADA', 'FINALIZADA', req.user.id);
    res.json({ message: 'Orden finalizada completamente.', orden: updated.rows[0] });
  } catch (error) {
    console.error('Error finalizando orden:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const pauseTask = async (req, res) => {
  const { id } = req.params;
  const tecnicoId = req.user.id;

  try {
    const orderReq = await db.query(
      "SELECT * FROM ordenes WHERE id = $1 AND ((tecnico_diagnostico_id = $2 AND estado = 'EN_DIAGNOSTICO') OR (tecnico_reparacion_id = $2 AND estado = 'EN_REPARACION'))", 
      [id, tecnicoId]
    );
    if (orderReq.rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada o no asignada a ti.' });
    }

    const order = orderReq.rows[0];
    if (order.pausa_inicio !== null) {
      return res.status(400).json({ error: 'La orden ya está pausada.' });
    }

    const updated = await db.query(
      "UPDATE ordenes SET pausa_inicio = NOW() WHERE id = $1 RETURNING *",
      [id]
    );

    res.json({ message: 'Temporizador pausado.', orden: updated.rows[0] });
  } catch (error) {
    console.error('Error pausando tarea:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const resumeTask = async (req, res) => {
  const { id } = req.params;
  const tecnicoId = req.user.id;

  try {
    const orderReq = await db.query(
      "SELECT * FROM ordenes WHERE id = $1 AND ((tecnico_diagnostico_id = $2 AND estado = 'EN_DIAGNOSTICO') OR (tecnico_reparacion_id = $2 AND estado = 'EN_REPARACION'))", 
      [id, tecnicoId]
    );
    if (orderReq.rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada o no asignada a ti.' });
    }

    const order = orderReq.rows[0];
    if (order.pausa_inicio === null) {
      return res.status(400).json({ error: 'La orden no está pausada.' });
    }

    const updated = await db.query(
      `UPDATE ordenes 
       SET tiempo_pausado_segundos = tiempo_pausado_segundos + FLOOR(EXTRACT(EPOCH FROM (NOW() - pausa_inicio))),
           pausa_inicio = NULL 
       WHERE id = $1 RETURNING *`,
      [id]
    );

    res.json({ message: 'Temporizador reanudado.', orden: updated.rows[0] });
  } catch (error) {
    console.error('Error reanudando tarea:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const getMyActiveOrder = async (req, res) => {
  const tecnicoId = req.user.id;
  try {
    const result = await db.query(
      "SELECT * FROM ordenes WHERE (tecnico_diagnostico_id = $1 AND estado = 'EN_DIAGNOSTICO') OR (tecnico_reparacion_id = $1 AND estado = 'EN_REPARACION')",
      [tecnicoId]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

module.exports = { createOrder, getOrders, takeNextOrder, finishTask, registerPayment, markFinished, getMyActiveOrder, pauseTask, resumeTask };
