/**
 * Migration: Create goods_certificates table
 * Run: node migrate_certificates.js
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
  console.log('[Migration] Creating goods_certificates table...');

  // Try RPC approach first
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS goods_certificates (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      certificate_id      TEXT UNIQUE NOT NULL,
      trip_id             UUID REFERENCES requests(id) UNIQUE NOT NULL,
      factory_name        TEXT,
      factory_owner_name  TEXT,
      driver_name         TEXT,
      vehicle_number      TEXT,
      goods_description   TEXT,
      pickup_location     TEXT,
      drop_location       TEXT,
      pickup_timestamp    TIMESTAMPTZ NOT NULL,
      created_at          TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_goods_certificates_trip_id ON goods_certificates(trip_id);
  `;

  const { error } = await supabase.rpc('exec_sql', { query: createTableSQL });

  if (error) {
    console.warn('[Migration] RPC approach failed:', error.message);
    console.log('[Migration] Checking if table already exists...');

    // Test if table already exists
    const { error: testError } = await supabase
      .from('goods_certificates')
      .select('id')
      .limit(1);

    if (testError && testError.message.includes('goods_certificates')) {
      console.error('[Migration] ❌ Table does not exist and cannot be created via API.');
      console.log('');
      console.log('  ╔══════════════════════════════════════════════════════════════╗');
      console.log('  ║  Please run this SQL in Supabase Dashboard > SQL Editor:    ║');
      console.log('  ╚══════════════════════════════════════════════════════════════╝');
      console.log('');
      console.log(`  ${createTableSQL.trim().replace(/\n/g, '\n  ')}`);
      console.log('');
      process.exit(1);
    } else {
      console.log('[Migration] ✅ Table goods_certificates already exists!');
    }
  } else {
    console.log('[Migration] ✅ goods_certificates table created successfully!');
  }
}

migrate().catch((err) => {
  console.error('[Migration] Fatal error:', err);
  process.exit(1);
});
