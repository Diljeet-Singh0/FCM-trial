require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('=== Checking Users and their request references ===');
  
  // Get all users
  const { data: users } = await supabase.from('users').select('*');
  
  // Get all requests
  const { data: requests } = await supabase.from('requests').select('*');
  
  // Look for any request where owner_id matches a transporter
  const transporters = users.filter(u => u.role === 'transporter');
  const transporterIds = new Set(transporters.map(u => u.id));
  
  console.log('\nChecking if any transporter is used as owner_id in requests:');
  let foundOwnerRef = false;
  requests.forEach(r => {
    if (transporterIds.has(r.owner_id)) {
      const user = transporters.find(u => u.id === r.owner_id);
      console.log(`⚠️ Request ${r.id} has owner_id=${r.owner_id} which belongs to transporter: ${user.name} (${user.phone})`);
      foundOwnerRef = true;
    }
  });
  if (!foundOwnerRef) {
    console.log('No transporters are referenced as owner_id in requests.');
  }

  console.log('\nChecking if any transporter is used as transporter_id in requests:');
  let foundTransporterRef = false;
  requests.forEach(r => {
    if (transporterIds.has(r.transporter_id)) {
      const user = transporters.find(u => u.id === r.transporter_id);
      console.log(`⚠️ Request ${r.id} has transporter_id=${r.transporter_id} which belongs to transporter: ${user.name} (${user.phone})`);
      foundTransporterRef = true;
    }
  });
  if (!foundTransporterRef) {
    console.log('No transporters are referenced as transporter_id in requests.');
  }
}

run().catch(console.error);
