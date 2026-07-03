/**
 * Migration: Add routes_v2, images columns to transport_companies,
 *            add city column to users table,
 *            and seed detailed route data from transporters.ts into routes_v2.
 *
 * Run once: node migrate_routes_v2.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ─── Detailed routes data from transporters.ts ───
// This is the authoritative city-level data that the DB's simple routes column lacks.
const DETAILED_ROUTES_V2 = {
  'tc-001': [
    {
      state: 'West Bengal',
      cities: [{ name: 'Kolkata' }],
      price_min: 4,
      price_max: 8,
      delivery_days_min: 5,
      delivery_days_max: 7,
    },
  ],
  'tc-002': [
    {
      state: 'Maharashtra',
      cities: [
        { name: 'Mumbai' },
        { name: 'Pune' },
        { name: 'Nagpur' },
      ],
      price_min: 5,
      price_max: 7,
      delivery_days_min: 5,
      delivery_days_max: 6,
    },
    {
      state: 'Karnataka',
      cities: [
        { name: 'Bangalore' },
        { name: 'Mysore' },
        { name: 'Hubli' },
      ],
      price_min: 5,
      price_max: 7,
      delivery_days_min: 5,
      delivery_days_max: 6,
    },
  ],
  'tc-003': [
    {
      state: 'Punjab',
      cities: [
        { name: 'Amritsar', price_min: 2, price_max: 3, delivery_days_min: 1, delivery_days_max: 2 },
        { name: 'Ajnala' }, { name: 'Batala' }, { name: 'Gurdaspur' },
        { name: 'Pathankot', price_min: 2, price_max: 3 },
        { name: 'Hoshiarpur' }, { name: 'Jalandhar', price_min: 2, price_max: 3, delivery_days_min: 1, delivery_days_max: 1 },
        { name: 'Phagwara' }, { name: 'Nakodar' }, { name: 'Kapurthala' },
        { name: 'Sultanpur Lodhi' }, { name: 'Nawanshahr' }, { name: 'Balachaur' },
        { name: 'Ludhiana', price_min: 2, price_max: 2.5, delivery_days_min: 1, delivery_days_max: 1 },
        { name: 'Doraha' }, { name: 'Khanna' }, { name: 'Samrala' },
        { name: 'Mandi Gobindgarh' }, { name: 'Sirhind' }, { name: 'Rajpura' },
        { name: 'Patiala', price_min: 2, price_max: 3 },
        { name: 'Nabha' }, { name: 'Malerkotla' }, { name: 'Ahmedgarh' },
        { name: 'Barnala' }, { name: 'Sangrur' }, { name: 'Sunam' },
        { name: 'Lehragaga' }, { name: 'Dhuri' }, { name: 'Raikot' },
        { name: 'Jagraon' }, { name: 'Moga' }, { name: 'Kotkapura' },
        { name: 'Faridkot' }, { name: 'Ferozepur' }, { name: 'Fazilka' },
        { name: 'Zira' }, { name: 'Jalalabad' }, { name: 'Muktsar' },
        { name: 'Abohar' }, { name: 'Tarn Taran' }, { name: 'Patti' },
        { name: 'Khemkaran' }, { name: 'Dasuya' }, { name: 'Mukerian' },
      ],
      price_min: 2,
      price_max: 4,
      delivery_days_min: 1,
      delivery_days_max: 2,
    },
    {
      state: 'Haryana',
      cities: [
        { name: 'Ambala' }, { name: 'Ambala City' }, { name: 'Ambala Cantt' },
        { name: 'Shahbad' }, { name: 'Kurukshetra' }, { name: 'Karnal' },
        { name: 'Panipat' }, { name: 'Sonipat' },
      ],
      price_min: 2,
      price_max: 4,
      delivery_days_min: 1,
      delivery_days_max: 2,
    },
    {
      state: 'Jammu & Kashmir',
      cities: [
        { name: 'Jammu' }, { name: 'Kathua' }, { name: 'Samba' },
        { name: 'Dori Brahmana' }, { name: 'Vijaypur' },
      ],
      price_min: 3,
      price_max: 4,
      delivery_days_min: 2,
      delivery_days_max: 3,
    },
    {
      state: 'Delhi',
      cities: [{ name: 'Delhi', price_min: 2.5, price_max: 3.5, delivery_days_min: 1, delivery_days_max: 2 }],
      price_min: 2.5,
      price_max: 3.5,
      delivery_days_min: 1,
      delivery_days_max: 2,
    },
    {
      state: 'Himachal Pradesh',
      cities: [{ name: 'Baddi' }, { name: 'Damtal' }],
      price_min: 3,
      price_max: 4,
      delivery_days_min: 2,
      delivery_days_max: 3,
    },
  ],
  'tc-004': [
    {
      state: 'Assam',
      cities: [
        { name: 'Guwahati' }, { name: 'Shillong' }, { name: 'Jorhat' },
        { name: 'Dibrugarh' }, { name: 'Tinsukia' }, { name: 'Silchar' },
        { name: 'Karimganj' }, { name: 'Agartala' }, { name: 'Lalabazar' },
        { name: 'Aizawl' }, { name: 'Hailakandi' }, { name: 'Dharmanagar' },
        { name: 'Imphal' }, { name: 'Dimapur' }, { name: 'Nagaon' },
        { name: 'Lanka' }, { name: 'Gola Ghat' }, { name: 'Hojai' },
      ],
      price_min: 2,
      price_max: 3,
      delivery_days_min: 10,
      delivery_days_max: 20,
    },
    {
      state: 'Bihar',
      cities: [
        { name: 'Patna Jn' }, { name: 'Patna City' }, { name: 'Gaya' },
        { name: 'Siwan' }, { name: 'Chapra' }, { name: 'Muzaffarpur' },
        { name: 'Darbhanga' }, { name: 'Sitamarhi' }, { name: 'Samastipur' },
        { name: 'Raxaul' }, { name: 'Purnea' }, { name: 'Forbesganj' },
        { name: 'Katihar' }, { name: 'Jogbani' }, { name: 'Bhagalpur' },
        { name: 'Araria' },
      ],
      price_min: 2,
      price_max: 3,
      delivery_days_min: 7,
      delivery_days_max: 14,
    },
    {
      state: 'West Bengal',
      cities: [
        { name: 'Kolkata' }, { name: 'Siliguri' }, { name: 'Darjeeling' },
        { name: 'Cooch Behar' }, { name: 'Jaigaon' }, { name: 'Dinhata' },
      ],
      price_min: 2,
      price_max: 3,
      delivery_days_min: 7,
      delivery_days_max: 12,
    },
    {
      state: 'Odisha',
      cities: [
        { name: 'Cuttack' }, { name: 'Bhubaneswar' }, { name: 'Puri' },
        { name: 'Sambalpur' }, { name: 'Rourkela' }, { name: 'Berhampur' },
        { name: 'Jharsuguda' },
      ],
      price_min: 2,
      price_max: 3,
      delivery_days_min: 10,
      delivery_days_max: 15,
    },
    {
      state: 'Jharkhand',
      cities: [
        { name: 'Ranchi' }, { name: 'Dhanbad' }, { name: 'Jamshedpur' },
        { name: 'Tatanagar' }, { name: 'Asansol' }, { name: 'Chas' },
        { name: 'Giridih' },
      ],
      price_min: 2,
      price_max: 3,
      delivery_days_min: 7,
      delivery_days_max: 12,
    },
  ],
};

async function run() {
  console.log('=== Routes V2 + Images Migration ===\n');

  // ─── Step 1: Add columns via RPC (SQL) ───
  console.log('1. Adding routes_v2, images columns to transport_companies...');
  const { error: colErr1 } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE transport_companies ADD COLUMN IF NOT EXISTS routes_v2 JSONB DEFAULT '[]'::jsonb;`
  }).maybeSingle();

  // If RPC doesn't exist, try a direct approach: just try inserting and check if column is missing
  if (colErr1) {
    console.log('   RPC not available, trying direct column test...');
    // Try to select routes_v2 - if it fails, we'll know the column doesn't exist
    const { error: testErr } = await supabase.from('transport_companies').select('routes_v2').limit(1);
    if (testErr && testErr.message.includes('does not exist')) {
      console.log('\n   ⚠️  Column routes_v2 does not exist. Please run this SQL in Supabase SQL Editor:\n');
      console.log(`   ALTER TABLE transport_companies ADD COLUMN IF NOT EXISTS routes_v2 JSONB DEFAULT '[]'::jsonb;`);
      console.log(`   ALTER TABLE transport_companies ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;`);
      console.log(`   ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;`);
      console.log('\n   Then run this script again.');
      return;
    }
    console.log('   routes_v2 column already exists ✓');
  } else {
    console.log('   routes_v2 column created ✓');
  }

  // Check images column
  const { error: imgTestErr } = await supabase.from('transport_companies').select('images').limit(1);
  if (imgTestErr && imgTestErr.message.includes('does not exist')) {
    console.log('\n   ⚠️  Column images does not exist. Please run this SQL in Supabase SQL Editor:\n');
    console.log(`   ALTER TABLE transport_companies ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;`);
    console.log('\n   Then run this script again.');
    return;
  }
  console.log('   images column exists ✓');

  // Check city column on users
  const { error: cityTestErr } = await supabase.from('users').select('city').limit(1);
  if (cityTestErr && cityTestErr.message.includes('does not exist')) {
    console.log('\n   ⚠️  Column city does not exist on users table. Please run this SQL in Supabase SQL Editor:\n');
    console.log(`   ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;`);
    console.log('\n   Then run this script again.');
    return;
  }
  console.log('   users.city column exists ✓');

  // ─── Step 2: Read existing companies ───
  console.log('\n2. Reading existing companies...');
  const { data: companies, error: readErr } = await supabase
    .from('transport_companies')
    .select('id, name, routes, routes_v2');

  if (readErr) {
    console.error('   Error reading companies:', readErr.message);
    return;
  }

  console.log(`   Found ${companies.length} companies`);

  // ─── Step 3: Migrate routes → routes_v2 using detailed data ───
  console.log('\n3. Migrating routes to routes_v2...');

  for (const company of companies) {
    // Skip if already has routes_v2 data
    if (company.routes_v2 && company.routes_v2.length > 0) {
      console.log(`   ${company.id} (${company.name}): Already has routes_v2, skipping`);
      continue;
    }

    // Use detailed data if available, otherwise parse from existing routes
    let routesV2;
    if (DETAILED_ROUTES_V2[company.id]) {
      routesV2 = DETAILED_ROUTES_V2[company.id];
      console.log(`   ${company.id} (${company.name}): Using detailed data (${routesV2.length} route groups)`);
    } else {
      // Parse from existing routes column
      routesV2 = parseExistingRoutes(company.routes || []);
      console.log(`   ${company.id} (${company.name}): Parsed from routes column (${routesV2.length} route groups)`);
    }

    const { error: updateErr } = await supabase
      .from('transport_companies')
      .update({ routes_v2: routesV2 })
      .eq('id', company.id);

    if (updateErr) {
      console.error(`   ✗ Failed to update ${company.id}:`, updateErr.message);
    } else {
      console.log(`   ✓ Updated ${company.id}`);
    }
  }

  // ─── Step 4: Extract city from factory_address for existing users ───
  console.log('\n4. Extracting city from factory_address for existing users...');
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, factory_address, city')
    .is('city', null)
    .not('factory_address', 'is', null);

  if (usersErr) {
    console.warn('   Could not read users:', usersErr.message);
  } else if (users && users.length > 0) {
    for (const user of users) {
      const city = extractCityFromAddress(user.factory_address);
      if (city) {
        const { error: uErr } = await supabase
          .from('users')
          .update({ city })
          .eq('id', user.id);
        if (!uErr) {
          console.log(`   ✓ User ${user.id}: city = "${city}"`);
        }
      }
    }
  } else {
    console.log('   No users need city extraction');
  }

  console.log('\n=== Migration Complete ===');
}

/**
 * Parse existing flat routes array into routes_v2 format.
 * Handles:
 *  - "Punjab" → { state: "Punjab", cities: [] }
 *  - "West Bengal (Kolkata)" → { state: "West Bengal", cities: [{ name: "Kolkata" }] }
 *  - "Punjab (Amritsar, Jalandhar, ...)" → { state: "Punjab", cities: [{ name: "Amritsar" }, ...] }
 */
function parseExistingRoutes(routes) {
  return routes.map(route => {
    const match = route.match(/^(.+?)\s*\((.+)\)\s*$/);
    if (match) {
      const state = match[1].trim();
      const citiesStr = match[2];
      const cities = citiesStr.split(',').map(c => ({ name: c.trim() })).filter(c => c.name);
      return { state, cities };
    }
    // Plain state name
    return { state: route.trim(), cities: [] };
  });
}

/**
 * Extract city from a full address string.
 * Heuristic: take the second-to-last comma-separated segment.
 * e.g., "123 Industrial Area, Ludhiana, Punjab 141003" → "Ludhiana"
 */
function extractCityFromAddress(address) {
  if (!address) return null;
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    // Second-to-last segment is typically the city
    return parts[parts.length - 2].replace(/\d+/g, '').trim();
  }
  return parts[0] || null;
}

run().catch(console.error);
