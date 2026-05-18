require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log('[Migration] Adding driver location columns to requests table...');

  // Test that we can reach the table
  const { data, error } = await supabase.from('requests').select('id').limit(1);
  if (error) {
    console.error('[Migration] Cannot access requests table:', error.message);
    process.exit(1);
  }
  console.log('[Migration] Connected to requests table OK');

  // Try to update a non-existent row to test if columns exist
  // If they don't exist, Supabase will return an error
  const testUpdate = await supabase
    .from('requests')
    .update({ driver_lat: 0, driver_lng: 0, driver_heading: 0 })
    .eq('id', '00000000-0000-0000-0000-000000000000');

  if (testUpdate.error && testUpdate.error.message.includes('column')) {
    console.log('[Migration] Columns do not exist yet. You need to add them via Supabase SQL Editor:');
    console.log('');
    console.log('  ALTER TABLE requests ADD COLUMN IF NOT EXISTS driver_lat DOUBLE PRECISION;');
    console.log('  ALTER TABLE requests ADD COLUMN IF NOT EXISTS driver_lng DOUBLE PRECISION;');
    console.log('  ALTER TABLE requests ADD COLUMN IF NOT EXISTS driver_heading DOUBLE PRECISION DEFAULT 0;');
    console.log('');
    console.log('Run the above SQL in your Supabase Dashboard → SQL Editor');
  } else {
    console.log('[Migration] ✅ Columns already exist or update succeeded. No migration needed.');
  }
}

migrate().catch(console.error);
