const { spawn } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => globalThis.fetch(...args));

async function runDiagnose() {
    const server = spawn('C:\\Program Files\\nodejs\\node.exe', ['backend/src/server.js'], { stdio: 'pipe' });

    server.stdout.on('data', (d) => console.log('SERVER OUT:', d.toString()));
    server.stderr.on('data', (d) => console.error('SERVER ERR:', d.toString()));

    // give server time to start
    await new Promise(r => setTimeout(r, 2000));

    try {
        // Login Tecnico
        const loginRes = await fetch('http://localhost:3000/api/users/login', {
            method: 'POST', body: JSON.stringify({ email: 'carlos.vargas@thermomix.mx', password: 'password123' }), headers: { 'Content-Type': 'application/json' }
        });
        
        let token = "";
        if (loginRes.ok) {
            token = (await loginRes.json()).token;
        } else {
            // Need a valid technician token to test this, wait, password123 isn't the user password I created?
            // User: "rodrigo.cruz@thermomix.mx"
            console.log("Auto-login Failed. Testing endpoints as if they are crashing inside...");
        }

        // Just hit take-next with no token, it should give 401 JSON.
        const res1 = await fetch('http://localhost:3000/api/orders/take-next', { method: 'POST' });
        console.log("Raw Response Status:", res1.status);
        const text1 = await res1.text();
        console.log("Raw Response Body:", text1);

    } catch (e) {
        console.error("Test error:", e.message);
    }

    server.kill();
    process.exit(0);
}
runDiagnose();
