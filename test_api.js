const http = require('http');
const db = require('./backend/src/config/db');

const request = (method, path, body, token) => new Promise((resolve, reject) => {
  const req = http.request({
    hostname: 'localhost', port: 3000, path, method,
    headers: { 'Content-Type': 'application/json', ...(token ? {'Authorization': 'Bearer ' + token} : {}) }
  }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => { 
      try { resolve({ status: res.statusCode, body: JSON.parse(data || '{}') }); } 
      catch(e) { resolve({ status: res.statusCode, text: data }); } 
    });
  });
  req.on('error', reject);
  if (body) req.write(JSON.stringify(body));
  req.end();
});

(async () => {
  try {
    // 1. Get any executive and technician from DB
    const execRes = await db.query("SELECT * FROM usuarios WHERE rol='ejecutivo' LIMIT 1");
    const tecRes = await db.query("SELECT * FROM usuarios WHERE rol='tecnico' LIMIT 1");
    
    if (execRes.rows.length === 0 || tecRes.rows.length === 0) {
        console.log("Not enough users to test.");
        process.exit(1);
    }
    const emailEx = execRes.rows[0].email;
    const emailTc = tecRes.rows[0].email;
    
    // Login
    console.log(`Logging in Exec: ${emailEx}`);
    const r1 = await request('POST', '/api/users/login', { email: emailEx, password: 'password123' });
    const tokenEx = r1.body.token;
    
    console.log(`Logging in Tech: ${emailTc}`);
    const r2 = await request('POST', '/api/users/login', { email: emailTc, password: 'password123' });
    const tokenTc = r2.body.token;

    // Fetch Orders as Exec
    const ord1 = await request('GET', '/api/orders', null, tokenEx);
    console.log(`Exec fetching /orders: STATUS ${ord1.status}`);
    if (ord1.status === 200) console.log(`Orders found: ${ord1.body.length}`);

    // Fetch Orders as Tech
    const ord2 = await request('GET', '/api/orders', null, tokenTc);
    console.log(`Tech fetching /orders: STATUS ${ord2.status}`);
    
    const notifs = await request('GET', '/api/users/notifications', null, tokenEx);
    console.log(`Exec notifications: STATUS ${notifs.status}, count: ${notifs.body && notifs.body.length ? notifs.body.length : 0}`);

    process.exit(0);
  } catch(e) { 
    console.error(e);
    process.exit(1);
  }
})();
