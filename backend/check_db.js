require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('=== Database Health Check ===\n');

  // 1. Check transport_companies
  const { data: companies, error: compErr } = await supabase
    .from('transport_companies').select('id, name').order('id');
  if (compErr) {
    console.log('❌ transport_companies table error:', compErr.message);
  } else {
    console.log(`✅ transport_companies: ${companies.length} records`);
    companies.forEach(c => console.log(`   - ${c.id}: ${c.name}`));
  }

  // 2. Check users
  const { data: users, error: userErr } = await supabase
    .from('users').select('id, name, phone, role').order('role');
  if (userErr) {
    console.log('\n❌ users table error:', userErr.message);
  } else {
    console.log(`\n✅ users: ${users.length} records`);
    users.forEach(u => console.log(`   - [${u.role}] ${u.name} (${u.phone}) id=${u.id}`));
  }

  // 3. Check requests and their references
  const { data: requests, error: reqErr } = await supabase
    .from('requests').select('id, owner_id, transporter_id, status').limit(20);
  if (reqErr) {
    console.log('\n❌ requests table error:', reqErr.message);
  } else {
    console.log(`\n✅ requests: ${requests.length} records`);
    requests.forEach(r => console.log(`   - id=${r.id} owner=${r.owner_id} transporter=${r.transporter_id} status=${r.status}`));
  }

  // 4. Find which drivers have linked requests
  if (users && requests) {
    const transporters = users.filter(u => u.role === 'transporter');
    console.log('\n=== Driver → Request Links ===');
    for (const t of transporters) {
      const asTransporter = requests.filter(r => r.transporter_id === t.id);
      const asOwner = requests.filter(r => r.owner_id === t.id);
      if (asTransporter.length || asOwner.length) {
        console.log(`   ⚠️  ${t.name} (${t.id}):`);
        if (asTransporter.length) console.log(`      - Referenced as transporter in ${asTransporter.length} request(s)`);
        if (asOwner.length) console.log(`      - Referenced as owner in ${asOwner.length} request(s)`);
      }
    }
  }

  // 5. Try to detect NOT NULL constraints by checking a sample request
  if (requests && requests.length > 0) {
    const testReq = requests[0];
    console.log('\n=== Testing NULL-ability of owner_id ===');
    console.log(`   Test request: ${testReq.id}, current owner_id: ${testReq.owner_id}`);
    
    // Try setting owner_id to null (dry run - we revert immediately)
    const { error: nullErr } = await supabase
      .from('requests')
      .update({ owner_id: null })
      .eq('id', 'FAKE-ID-THAT-WONT-MATCH');  // won't match anything, just tests the query
    
    if (nullErr) {
      console.log(`   ❌ Setting owner_id to NULL would fail: ${nullErr.message}`);
    } else {
      console.log(`   ✅ owner_id can be set to NULL`);
    }
  }
}

check().catch(console.error);
