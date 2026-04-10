const { Client } = require('pg'); 
const client = new Client({ connectionString: 'postgresql://postgres:admin@localhost:5432/thermomix_db'});
client.connect();

async function run() {
  try {
    const res = await client.query("INSERT INTO notificaciones (usuario_id, mensaje) VALUES (3, 'Mensaje de Test') RETURNING *");
    console.log("Success:", res.rows);
  } catch (err) {
    console.error("Query Error:", err);
  } finally {
    client.end();
  }
}
run();
