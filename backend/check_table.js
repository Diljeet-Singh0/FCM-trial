require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Connecting to Supabase...');
  const { data, error } = await supabase.from('transport_companies').select('id').limit(1);
  if (error) {
    console.log('Error selecting from table:', error.message);
  } else {
    console.log('Successfully connected. Rows found:', data.length);
  }
}
run();
