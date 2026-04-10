const { spawn } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => globalThis.fetch(...args));

async function run() {
    const server = spawn('C:\\Program Files\\nodejs\\node.exe', ['backend/src/server.js']);

    await new Promise(r => setTimeout(r, 2000));

    try {
        // Login as Rodrigo Cruz, the technician ID 4 we know exists
        const loginRes = await fetch('http://localhost:3000/api/users/login', {
            method: 'POST', body: JSON.stringify({ email: 'rodrigo.cruz@thermomix.mx', password: 'password123' }), headers: { 'Content-Type': 'application/json' }
        });

        // if tests user password wasn't right, try login as admin
        const loginResAdmin = await fetch('http://localhost:3000/api/users/login', {
            method: 'POST', body: JSON.stringify({ email: 'admin@thermomix.com', password: 'admin123' }), headers: { 'Content-Type': 'application/json' }
        });

        let token = (await loginResAdmin.json()).token;

        // Force create a technician so we know exactly the credentials
        const createRes = await fetch('http://localhost:3000/api/users', {
            method: 'POST', body: JSON.stringify({ nombre: 'Test', email: 'test@td.com', password: 'pass', rol: 'tecnico' }),
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        
        // Setup rule for this tech
        const getTechs = await fetch('http://localhost:3000/api/users/tecnicos', { headers: { 'Authorization': `Bearer ${token}` }});
        const techs = await getTechs.json();
        const techId = techs.find(t => t.email === 'test@td.com')?.id;
        
        await fetch('http://localhost:3000/api/rules', {
            method: 'POST', body: JSON.stringify({ tecnico_id: techId, modelo: 'TM6', tipo_proceso: 'diagnostico' }),
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });

        // Now login as that technician explicitly
        const techLogin = await fetch('http://localhost:3000/api/users/login', {
            method: 'POST', body: JSON.stringify({ email: 'test@td.com', password: 'pass' }), headers: { 'Content-Type': 'application/json' }
        });
        const techToken = (await techLogin.json()).token;

        // Try getting rules as tech (should give 403)
        const rulesRes = await fetch('http://localhost:3000/api/rules', { headers: { 'Authorization': `Bearer ${techToken}` }});
        console.log("Rules Fetch Status:", rulesRes.status, await rulesRes.text());

        // Try taking next! (This gave the user the error)
        const takeRes = await fetch('http://localhost:3000/api/orders/take-next', {
            method: 'POST', headers: { 'Authorization': `Bearer ${techToken}` }
        });
        
        console.log("Take Next Status:", takeRes.status);
        console.log("Take Next Body:", await takeRes.text());

    } catch(e) {
        console.error("error", e);
    }
    
    server.kill();
    process.exit(0);
}
run();
