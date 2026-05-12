require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // 1. Check existing users
  const { data: users, error: usersErr } = await supabase.from('users').select('id, name, role').limit(5);
  if (usersErr) { console.error('Users error:', usersErr); return; }
  console.log('USERS:', JSON.stringify(users, null, 2));

  // 2. Check pending requests
  const { data: requests, error: reqErr } = await supabase.from('requests').select('*').eq('status', 'pending').limit(3);
  if (reqErr) { console.error('Requests error:', reqErr); return; }
  console.log('PENDING REQUESTS:', JSON.stringify(requests, null, 2));

  // 3. Try updating a request with the new columns to see if they exist
  if (requests && requests.length > 0) {
    const testReq = requests[0];
    const transporter = users.find(u => u.role === 'transporter');
    if (transporter) {
      const { error: updateErr } = await supabase
        .from('requests')
        .update({ transporter_id: transporter.id, accepted_price: 999 })
        .eq('id', testReq.id);
      
      if (updateErr) {
        console.log('COLUMN TEST FAILED (columns need to be added):', updateErr.message);
      } else {
        // Revert the test
        await supabase.from('requests').update({ transporter_id: null, accepted_price: null, status: 'pending' }).eq('id', testReq.id);
        console.log('COLUMN TEST PASSED — columns exist');
      }
    } else {
      console.log('No transporter found to test with');
    }
  } else {
    console.log('No pending requests to test with');
  }
}

run().catch(console.error);
