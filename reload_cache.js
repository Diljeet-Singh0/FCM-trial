require('dotenv').config({ path: 'backend/.env' });
const https = require('https');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.log('Missing env vars'); process.exit(1); }

const projectRef = new URL(url).hostname.split('.')[0];
const postData = JSON.stringify({ query: "NOTIFY pgrst, 'reload schema';" });

const options = {
  hostname: `${projectRef}.supabase.co`,
  path: '/pg/query',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Length': Buffer.byteLength(postData),
  },
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Schema cache reload requested. Status:', res.statusCode));
});
req.on('error', console.error);
req.write(postData);
req.end();
