/**
 * Migration: Add builty_image column to requests table
 * Run: node migrate_builty.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function migrate() {
  console.log('[Migration] Adding builty_image column to requests table...');

  const { error } = await supabase.rpc('exec_sql', {
    query: 'ALTER TABLE requests ADD COLUMN IF NOT EXISTS builty_image TEXT;'
  });

  if (error) {
    // If rpc doesn't work, try direct approach
    console.warn('[Migration] RPC approach failed, trying direct column check...');
    
    // Test if column already exists by selecting it
    const { error: testError } = await supabase
      .from('requests')
      .select('builty_image')
      .limit(1);
    
    if (testError && testError.message.includes('builty_image')) {
      console.error('[Migration] Column does not exist and cannot be added via API.');
      console.log('[Migration] Please run the following SQL in Supabase Dashboard > SQL Editor:');
      console.log('');
      console.log('  ALTER TABLE requests ADD COLUMN IF NOT EXISTS builty_image TEXT;');
      console.log('');
      process.exit(1);
    } else {
      console.log('[Migration] ✅ Column builty_image already exists or was added successfully!');
    }
  } else {
    console.log('[Migration] ✅ builty_image column added successfully!');
  }
}

migrate().catch((err) => {
  console.error('[Migration] Fatal error:', err);
  process.exit(1);
});
