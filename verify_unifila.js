const { spawn } = require('child_process');
const crypto = require('crypto');

async function run() {
    console.log("Iniciando servidor API...");
    const server = spawn('node', ['backend/src/server.js'], { stdio: 'pipe' });
    server.stdout.on('data', d => console.log('SERVER:', d.toString().trimEnd()));
    server.stderr.on('data', d => console.error('SERVER ERR:', d.toString().trimEnd()));
    
    await new Promise(r => setTimeout(r, 2000));
    
    const apiCall = async (method, endpoint, body = null, token = null) => {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        try {
            const res = await fetch(`http://localhost:3000/api${endpoint}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined
            });
            const text = await res.text();
            try { return { status: res.status, data: JSON.parse(text) }; }
            catch (e) { return { status: res.status, data: text }; }
        } catch (e) {
            return { status: 500, data: { error: e.message } };
        }
    };

    try {
        console.log("=== INICIANDO VERIFICACIÓN ===");
        const loginResAdmin = await apiCall('POST', '/users/login', { email: 'admin@thermomix.com', password: 'admin123' });
        console.log("Admin login res:", loginResAdmin);
        const adminToken = loginResAdmin.data.token;
        if (!adminToken) throw new Error("Could not login as admin");

        const pwd = 'password123';
        const rnd = crypto.randomBytes(4).toString('hex');
        
        const execRes = await apiCall('POST', '/users', { nombre: 'Ejeco', email: `ejec_${rnd}@td.com`, password: pwd, rol: 'ejecutivo' }, adminToken);
        const t1Res = await apiCall('POST', '/users', { nombre: 'TechDiag', email: `t1_${rnd}@td.com`, password: pwd, rol: 'tecnico' }, adminToken);
        const t2Res = await apiCall('POST', '/users', { nombre: 'TechRep', email: `t2_${rnd}@td.com`, password: pwd, rol: 'tecnico' }, adminToken);
        
        const t1Id = t1Res.data.user.id;
        const t2Id = t2Res.data.user.id;

        const execToken = (await apiCall('POST', '/users/login', { email: `ejec_${rnd}@td.com`, password: pwd })).data.token;
        const t1Token = (await apiCall('POST', '/users/login', { email: `t1_${rnd}@td.com`, password: pwd })).data.token;
        const t2Token = (await apiCall('POST', '/users/login', { email: `t2_${rnd}@td.com`, password: pwd })).data.token;

        await apiCall('POST', '/rules', { tecnico_id: t1Id, modelo: 'TM6', tipo_proceso: 'diagnostico' }, adminToken);
        await apiCall('POST', '/rules', { tecnico_id: t2Id, modelo: 'TM6', tipo_proceso: 'reparacion' }, adminToken);

        console.log("\n--- ESCENARIO 1: AUTO_POR_TAREA ---");
        await apiCall('PUT', '/config', { modo_asignacion: 'AUTO_POR_TAREA' }, adminToken);

        let orderRes = await apiCall('POST', '/orders', { orden_servicio: `OS_AUTO_${rnd}`, modelo: 'TM6', comentarios: 'Falla intermitente' }, execToken);
        let orderId = orderRes.data.orden.id;
        console.log("Orden Creada:", orderRes.data.orden.estado);

        let takeRes = await apiCall('POST', '/orders/take-next', null, t1Token);
        console.log("Tech1 Toma:", takeRes.data?.orden?.estado, "Asignado a:", takeRes.data?.orden?.tecnico_diagnostico_id);

        let finRes = await apiCall('POST', `/orders/${orderId}/finish`, null, t1Token);
        console.log("Tech1 Finaliza:", finRes.data?.orden?.estado);

        let payRes = await apiCall('POST', `/orders/${orderId}/pay`, null, execToken);
        console.log("Ejecutivo Pago:", payRes.data?.orden?.estado);

        takeRes = await apiCall('POST', '/orders/take-next', null, t2Token);
        console.log("Tech2 Toma:", takeRes.data?.orden?.estado, "Asignado a:", takeRes.data?.orden?.tecnico_reparacion_id);

        finRes = await apiCall('POST', `/orders/${orderId}/finish`, null, t2Token);
        console.log("Tech2 Finaliza:", finRes.data?.orden?.estado);

        let closeRes = await apiCall('POST', `/orders/${orderId}/finish-order`, null, execToken);
        console.log("Ejecutivo Cierra:", closeRes.data?.orden?.estado);

        console.log("\n--- ESCENARIO 2: MISMO_TECNICO ---");
        await apiCall('PUT', '/config', { modo_asignacion: 'MISMO_TECNICO' }, adminToken);

        orderRes = await apiCall('POST', '/orders', { orden_servicio: `OS_MISMO_${rnd}`, modelo: 'TM6', comentarios: 'No enciende' }, execToken);
        orderId = orderRes.data.orden.id;
        
        takeRes = await apiCall('POST', '/orders/take-next', null, t1Token);
        console.log("Tech1 Toma:", takeRes.data?.orden?.estado);

        finRes = await apiCall('POST', `/orders/${orderId}/finish`, null, t1Token);
        console.log("Tech1 Finaliza:", finRes.data?.orden?.estado);

        payRes = await apiCall('POST', `/orders/${orderId}/pay`, null, execToken);
        console.log("Ejecutivo Pago:", payRes.data?.orden?.estado, "- Reparador id pre-asignado:", payRes.data?.orden?.tecnico_reparacion_id);

        takeRes = await apiCall('POST', '/orders/take-next', null, t1Token);
        console.log("Tech1 Recupera Reparación:", takeRes.data?.orden?.estado, "- Msg:", takeRes.data.message);

        finRes = await apiCall('POST', `/orders/${orderId}/finish`, null, t1Token);
        console.log("Tech1 Finaliza:", finRes.data?.orden?.estado);

        const t2TakeRes = await apiCall('POST', '/orders/take-next', null, t2Token);
        console.log("Tech2 Fallo Toma Esperado:", t2TakeRes.data.error);

    } catch (e) {
        console.error("ERROR CRITICO:", e);
    }

    server.kill();
    process.exit(0);
}

run();
