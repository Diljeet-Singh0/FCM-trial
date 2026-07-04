const fs = require('fs');
const path = require('path');
require('dotenv').config();
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];

const sql = `
ALTER TABLE transport_companies ADD COLUMN IF NOT EXISTS routes_v2 JSONB DEFAULT '[]'::jsonb;
ALTER TABLE transport_companies ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
`;

const postData = JSON.stringify({ query: sql });

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
  console.log('Trying /pg/query...');
  try {
    const res = await makeRequest(pgMetaOptions, postData);
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${res.body}`);
    if (res.status === 200 || res.status === 201) {
      console.log('SUCCESS');
      return;
    }
  } catch (e) {
    console.error('pg query failed:', e.message);
  }
}

run();
