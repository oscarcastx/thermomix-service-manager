const { spawn } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => globalThis.fetch(...args));

async function runDiagnose() {
    console.log("Starting server...");
    const server = spawn('C:\\Program Files\\nodejs\\node.exe', ['backend/src/server.js']);

    server.stdout.on('data', d => console.log('STDOUT:', d.toString()));
    server.stderr.on('data', d => console.error('STDERR:', d.toString()));

    await new Promise(r => setTimeout(r, 2000));

    try {
        const loginRes = await fetch('http://localhost:3000/api/users/login', {
            method: 'POST', body: JSON.stringify({ email: 'carlos.vargas@thermomix.mx', password: 'password123' }), headers: { 'Content-Type': 'application/json' }
        });
        
        let token = "";
        if (loginRes.ok) {
            token = (await loginRes.json()).token;
        } else {
            const admin = await fetch('http://localhost:3000/api/users/login', {
                method: 'POST', body: JSON.stringify({ email: 'admin@thermomix.com', password: 'admin123' }), headers: { 'Content-Type': 'application/json' }
            });
            token = (await admin.json()).token;
            console.log("Using Admin Token:", token.substring(0, 10));
        }

        console.log("--- Testing /api/rules/my-rule ---");
        const r1 = await fetch('http://localhost:3000/api/rules/my-rule', { headers: { 'Authorization': `Bearer ${token}` } });
        console.log("Status:", r1.status);
        console.log("Body:", await r1.text());

        console.log("--- Testing /api/orders/take-next ---");
        const r2 = await fetch('http://localhost:3000/api/orders/take-next', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        console.log("Status:", r2.status);
        console.log("Body:", await r2.text());

    } catch (e) {
        console.error("Test error:", e);
    }

    server.kill();
    process.exit(0);
}
runDiagnose();
