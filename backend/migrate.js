require('dotenv').config();
const https = require('https');

// Use Supabase's pg-meta API to run raw SQL via the service role key
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extract the project ref from the URL
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];

const sql = `
ALTER TABLE requests ADD COLUMN IF NOT EXISTS transporter_id UUID REFERENCES users(id);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS accepted_price NUMERIC(10,2);
`;

const postData = JSON.stringify({ query: sql });

const options = {
  hostname: `${projectRef}.supabase.co`,
  path: '/rest/v1/rpc/exec_sql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Length': Buffer.byteLength(postData),
  },
};

// Try the pg-meta approach first
const pgMetaOptions = {
  hostname: `${projectRef}.supabase.co`,
  path: '/pg/query',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Length': Buffer.byteLength(postData),
  },
};

function makeRequest(opts, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('Trying /pg/query endpoint...');
  try {
    const result = await makeRequest(pgMetaOptions, postData);
    console.log(`Status: ${result.status}`);
    console.log(`Response: ${result.body}`);
    if (result.status === 200 || result.status === 201) {
      console.log('SUCCESS via /pg/query');
      return;
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }

  console.log('\nTrying /rest/v1/rpc/exec_sql endpoint...');
  try {
    const result = await makeRequest(options, postData);
    console.log(`Status: ${result.status}`);
    console.log(`Response: ${result.body}`);
  } catch (e) {
    console.log('Failed:', e.message);
  }
}

run();
