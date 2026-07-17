const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  user: 'postgres',
  password: 'root',
  database: 'scaloz_super_admin',
  port: 5432,
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT * FROM products');
  console.log('Products:', res.rows);
  
  // Update FlowTrack URL to local
  await client.query("UPDATE products SET product_url = 'http://localhost:5173' WHERE product_name ILIKE '%FlowTrack%' OR product_name ILIKE '%ScalozFlow%'");
  console.log('Updated URL to http://localhost:5173');
  
  const res2 = await client.query('SELECT * FROM products');
  console.log('Updated Products:', res2.rows);

  await client.end();
}

run().catch(console.error);
