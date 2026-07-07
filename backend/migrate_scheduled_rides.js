/**
 * Scheduled Rides — Database Migration
 *
 * Creates the `scheduled_rides` table and adds `vehicle_number` to `users`.
 * Run once:  node migrate_scheduled_rides.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SQL_CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS scheduled_rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  pickup_location TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  drop_location TEXT NOT NULL,
  drop_lat DOUBLE PRECISION,
  drop_lng DOUBLE PRECISION,
  goods_description TEXT,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  cancelled_by TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  fare NUMERIC,
  unassigned_alert_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
`;

const SQL_ADD_VEHICLE = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_number TEXT;
`;

async function run() {
  console.log('[Migration] Creating scheduled_rides table...');
  const { error: e1 } = await supabase.rpc('exec_sql', { sql: SQL_CREATE_TABLE });
  if (e1) {
    console.error('[Migration] scheduled_rides table error:', e1.message);
  } else {
    console.log('[Migration] scheduled_rides table — OK');
  }

  console.log('[Migration] Adding vehicle_number to users...');
  const { error: e2 } = await supabase.rpc('exec_sql', { sql: SQL_ADD_VEHICLE });
  if (e2) {
    console.error('[Migration] vehicle_number error:', e2.message);
  } else {
    console.log('[Migration] vehicle_number — OK');
  }

  console.log('[Migration] Done.');
  process.exit(0);
}

run();
