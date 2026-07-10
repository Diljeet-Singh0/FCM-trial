require('dotenv').config({ path: '../backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  const { data: companies, error } = await supabase
    .from('transport_companies')
    .select('id, name, location, routes, routes_v2');
  if (error) {
    console.error('Error fetching companies:', error.message);
  } else {
    console.log(JSON.stringify(companies, null, 2));
  }
}
inspect();
