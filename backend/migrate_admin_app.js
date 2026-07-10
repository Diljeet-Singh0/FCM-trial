/**
 * Migration script for GoZo Admin App (Phase 1)
 * 
 * Adds:
 * 1. `status` column to `users` table (for driver online/offline/in_ride)
 * 2. `admin_fcm_tokens` table (for admin app push notifications)
 * 
 * Run: node migrate_admin_app.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function runMigration() {
  console.log('[Migration] Starting Admin App migration...\n');

  // 1. Add status column to users table
  console.log('[1/2] Adding status column to users table...');
  try {
    // Check if column already exists
    const { data: testRow, error: testError } = await supabase
      .from('users')
      .select('status')
      .limit(1);

    if (testError && testError.message.includes('does not exist')) {
      // Column doesn't exist — try to add it via RPC
      const { error: ddlError } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline';`
      });
      if (ddlError) {
        console.error('  DDL via RPC failed:', ddlError.message);
        console.log('  Please run this SQL manually in Supabase SQL editor:');
        console.log("  ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline';");
      } else {
        console.log('  ✅ status column added successfully');
      }
    } else {
      console.log('  ✅ status column already exists');
    }
  } catch (err) {
    console.error('  Error checking status column:', err.message);
  }

  // 2. Create admin_fcm_tokens table
  console.log('[2/2] Creating admin_fcm_tokens table...');
  try {
    // Check if table exists by trying to query it
    const { error: tableError } = await supabase
      .from('admin_fcm_tokens')
      .select('id')
      .limit(1);

    if (tableError && (tableError.message.includes('does not exist') || tableError.code === '42P01')) {
      // Table doesn't exist — try to create via RPC
      const { error: ddlError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS admin_fcm_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            token TEXT NOT NULL UNIQUE,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
          );
        `
      });
      if (ddlError) {
        console.error('  DDL via RPC failed:', ddlError.message);
        console.log('  Please run this SQL manually in Supabase SQL editor:');
        console.log(`  CREATE TABLE IF NOT EXISTS admin_fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );`);
      } else {
        console.log('  ✅ admin_fcm_tokens table created successfully');
      }
    } else {
      console.log('  ✅ admin_fcm_tokens table already exists');
    }
  } catch (err) {
    console.error('  Error checking admin_fcm_tokens table:', err.message);
  }

  console.log('\n[Migration] Done! If any steps failed, run the SQL manually in Supabase SQL editor.');
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
