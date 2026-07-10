const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // 1. Get auth token
  const authRes = await fetch('http://localhost:3000/admin/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: 'GoZo_2026' })
  });
  const authData = await authRes.json();
  const token = authData.token;

  // Find a valid factory owner
  const { data: users } = await supabase.from('users').select('id').eq('role', 'owner').limit(1);
  if (!users || users.length === 0) {
    console.error('No owners found in database.');
    return;
  }
  const ownerId = users[0].id;
  console.log('Using owner_id:', ownerId);

  // 2. Create a dummy normal ride and delete it
  const dummyRideId = '99999999-9999-9999-9999-999999999999';
  await supabase.from('requests').delete().eq('id', dummyRideId);
  const { error: insertError } = await supabase.from('requests').insert({
    id: dummyRideId,
    owner_id: ownerId,
    pickup_address: 'Test normal pickup',
    drop_address: 'Test normal drop',
    goods_type: 'Test type',
    weight_kg: 500,
    status: 'pending'
  });
  if (insertError) {
    console.error('Error inserting dummy request:', insertError);
    return;
  }
  console.log('Inserted dummy ride request.');

  // Try deleting it via API
  const delRes = await fetch(`http://localhost:3000/admin/rides/${dummyRideId}`, {
    method: 'DELETE',
    headers: { 'x-admin-token': token }
  });
  console.log('Delete dummy ride request status:', delRes.status);
  console.log('Delete dummy ride request body:', await delRes.json());

  // Verify it's gone from DB
  const { data: found } = await supabase.from('requests').select('id').eq('id', dummyRideId).maybeSingle();
  console.log('Found in DB after deletion:', found);
}

run();
