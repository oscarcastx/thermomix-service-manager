const URL = 'http://localhost:3000';

async function fetchApi(path, options = {}) {
    const res = await fetch(`${URL}/api${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API Error');
    return data;
}

const db = require('./backend/src/config/db');
const bcrypt = require('bcrypt');

async function ensureUsers() {
    console.log('Ensuring users exist...');
    const hp = await bcrypt.hash('password123', 10);
    await db.query(`INSERT INTO usuarios (nombre, email, password, rol) VALUES ('Juan', 'juan.ejecutivo@thermomix.com', $1, 'ejecutivo') ON CONFLICT DO NOTHING`, [hp]);
    await db.query(`INSERT INTO usuarios (nombre, email, password, rol) VALUES ('Carlos', 'carlos.tecnico@thermomix.com', $1, 'tecnico') ON CONFLICT DO NOTHING`, [hp]);
    const techReq = await db.query(`SELECT id FROM usuarios WHERE email = 'carlos.tecnico@thermomix.com'`);
    const today = new Date().toISOString().split('T')[0];
    await db.query(`INSERT INTO reglas (fecha, tecnico_id, modelo, tipo_proceso) VALUES ($1, $2, 'TM6', 'diagnostico') ON CONFLICT (fecha, tecnico_id) DO UPDATE SET activo = true, modelo = 'TM6', tipo_proceso = 'diagnostico'`, [today, techReq.rows[0].id]);
}

async function testTimer() {
    await ensureUsers();
    try {
        console.log('Login as executive to create order...');
        const execData = await fetchApi('/users/login', { 
            method: 'POST', 
            body: JSON.stringify({ email: 'juan.ejecutivo@thermomix.com', password: 'password123' }) 
        });
        const execAuth = { Authorization: `Bearer ${execData.token}` };

        const orderData = await fetchApi('/orders', {
            method: 'POST',
            body: JSON.stringify({
                orden_servicio: Math.floor(Math.random() * 1000000).toString(),
                modelo: 'TM6',
                comentarios: 'Test pause resume',
                prioridad: false
            }),
            headers: execAuth
        });
        const orderInfo = orderData.orden;
        console.log('Order created:', orderInfo.orden_servicio);

        console.log('Login as technician to take order...');
        const techData = await fetchApi('/users/login', { 
            method: 'POST', 
            body: JSON.stringify({ email: 'carlos.tecnico@thermomix.com', password: 'password123' }) 
        });
        const techAuth = { Authorization: `Bearer ${techData.token}` };

        console.log('Technician taking next task...');
        const takeData = await fetchApi('/orders/take-next', { method: 'POST', headers: techAuth });
        const activeOrder = takeData.orden;
        console.log('Took order:', activeOrder.id);
        
        console.log(`Initial time paused: ${activeOrder.tiempo_pausado_segundos}. Pause start: ${activeOrder.pausa_inicio}`);

        console.log('Pausing task...');
        const pauseData = await fetchApi(`/orders/${activeOrder.id}/pause`, { method: 'POST', headers: techAuth });
        console.log('Pause response:', pauseData.message);
        
        console.log('Waiting 2 seconds...');
        await new Promise(r => setTimeout(r, 2000));

        console.log('Resuming task...');
        const resumeData = await fetchApi(`/orders/${activeOrder.id}/resume`, { method: 'POST', headers: techAuth });
        console.log('Resume response:', resumeData.message, 'Paused time tracking:', resumeData.orden.tiempo_pausado_segundos);

        console.log('Finishing task...');
        await fetchApi(`/orders/${activeOrder.id}/finish`, { method: 'POST', headers: techAuth });
        console.log('Task finished successfully.');

        console.log('Getting daily report for technician...');
        const reportData = await fetchApi('/users/daily-report', { headers: techAuth });
        console.log('Report fetched! Rows count:', reportData.length);
        if (reportData.length > 0) {
            console.log('Sample row:', reportData[0]);
        }

    } catch (e) {
        console.error('Test failed:', e.message);
    }
}

testTimer();
