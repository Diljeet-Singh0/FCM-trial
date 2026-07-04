require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const sql = `
  ALTER TABLE transport_companies ADD COLUMN IF NOT EXISTS routes_v2 JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE transport_companies ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
  `;
  console.log('Calling exec_sql RPC...');
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Success:', data);
  }
}
run();
