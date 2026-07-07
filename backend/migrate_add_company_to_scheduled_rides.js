/**
 * Add company_id to scheduled_rides table
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SQL_ADD_COMPANY = `
ALTER TABLE scheduled_rides ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES transport_companies(id) ON DELETE SET NULL;
`;

async function run() {
  console.log('[Migration] Adding company_id to scheduled_rides table...');
  const { error } = await supabase.rpc('exec_sql', { sql: SQL_ADD_COMPANY });
  if (error) {
    console.error('[Migration] Error:', error.message);
  } else {
    console.log('[Migration] company_id column — OK');
  }
  process.exit(0);
}

run();
