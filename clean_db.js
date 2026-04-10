require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function clean() {
  try {
    console.log('Limpiando base de datos de los registros de prueba...');
    // Primero, limpiamos todas las órdenes, reglas e historial (ya que referencian a los usuarios)
    await pool.query("DELETE FROM historial_ordenes;");
    await pool.query("DELETE FROM ordenes;");
    await pool.query("DELETE FROM reglas;");
    
    // Ahora borramos los usuarios creados por el bot en las pruebas (Ejeco, TechDiag, TechRep, Test)
    const result = await pool.query("DELETE FROM usuarios WHERE email LIKE '%@td.com' OR nombre LIKE 'Tech%' OR nombre = 'Test' OR nombre = 'Ejeco';");
    console.log(`Se eliminaron ${result.rowCount} usuarios de prueba.`);
    console.log('¡Limpieza completada! El sistema está listo y en blanco para datos reales.');
  } catch (err) {
    console.error('Error limpiando DB:', err);
  } finally {
    pool.end();
  }
}

clean();
