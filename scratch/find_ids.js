const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: reqs, error: err1 } = await supabase.from('requests').select('id, status').limit(5);
  console.log('--- Requests ---');
  console.log(reqs);

  const { data: scheds, error: err2 } = await supabase.from('scheduled_rides').select('id, status').limit(5);
  console.log('--- Scheduled Rides ---');
  console.log(scheds);
}

run();
