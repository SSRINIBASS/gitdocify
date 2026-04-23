
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://gitdocify:gitdocify_dev@localhost:5432/gitdocify',
  connectionTimeoutMillis: 2000,
});

async function test() {
  try {
    console.log('Testing connection...');
    const client = await pool.connect();
    console.log('Connected!');
    const res = await client.query('SELECT NOW()');
    console.log('Result:', res.rows[0]);
    client.release();
  } catch (err) {
    console.error('Connection failed:', err.message);
  } finally {
    await pool.end();
  }
}

test();
