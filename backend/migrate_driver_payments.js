/**
 * Migration: Create driver_payments table
 *
 * This table tracks payments made by drivers to GoZo (debt settlements).
 * It is required by the Admin App's "Earnings & Debt" section.
 *
 * Run: node migrate_driver_payments.js
 *
 * If the RPC approach fails (exec_sql not available), the script prints
 * the exact SQL to run manually in the Supabase SQL editor.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS driver_payments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     NUMERIC(10,2) NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_payments_driver_id
  ON driver_payments(driver_id);
`.trim();

async function run() {
  console.log('[Migration] Checking driver_payments table...\n');

  // Step 1: Check if the table already exists
  const { error: checkError } = await supabase
    .from('driver_payments')
    .select('id')
    .limit(1);

  if (!checkError) {
    console.log('✅ driver_payments table already exists — nothing to do.');
    return;
  }

  const isMissing =
    checkError.message.includes('does not exist') ||
    checkError.code === '42P01' ||
    // Supabase schema cache error phrasing
    checkError.message.toLowerCase().includes('schema cache');

  if (!isMissing) {
    console.error('❌ Unexpected error checking driver_payments:', checkError.message);
    process.exit(1);
  }

  console.log('[Migration] Table driver_payments is missing. Attempting to create via RPC...');

  // Step 2: Try creating via exec_sql RPC
  const { error: rpcError } = await supabase
    .rpc('exec_sql', { sql: CREATE_TABLE_SQL })
    .maybeSingle();

  if (!rpcError) {
    console.log('✅ driver_payments table created successfully via RPC.\n');
    console.log('[Migration] Done!');
    return;
  }

  // Step 3: RPC failed — print manual SQL for the user
  console.warn('\n⚠️  RPC exec_sql is not available (this is normal).');
  console.log('──────────────────────────────────────────────────────');
  console.log('Please run the following SQL manually in the Supabase SQL editor:');
  console.log('  https://supabase.com/dashboard/project/_/sql/new');
  console.log('──────────────────────────────────────────────────────\n');
  console.log(CREATE_TABLE_SQL);
  console.log('\n──────────────────────────────────────────────────────');
  console.log('After running the SQL, restart the backend server.');
}

run().catch(err => {
  console.error('Migration crashed:', err.message);
  process.exit(1);
});
