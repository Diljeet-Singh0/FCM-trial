/**
 * Migration: Create transport_companies table and seed with real company data.
 * Run once: node migrate_companies.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SEED_COMPANIES = [
  {
    id: 'tc-001',
    name: 'Ludhiana Calcutta Transport',
    location: 'West Bengal (Kolkata)',
    rate_per_kg: 6, rate_display: '4-8', rating: 4.5, total_ratings: 420,
    routes: ['West Bengal (Kolkata)'],
    depot_address: 'Ludhiana Calcutta Transport, Transport Nagar, Ludhiana, Punjab 141003',
    description: 'Specialized in Ludhiana-Kolkata corridor with 100-120 ton daily capacity.',
    established: '1974', contact_phone: '9876500001', experience: '50+',
    delivery_time: '7 days', additional_info: '100-120 ton daily capacity',
  },
  {
    id: 'tc-002',
    name: 'Mahindra Translogistics',
    location: 'Maharashtra, Karnataka',
    rate_per_kg: 6, rate_display: '5-7', rating: 4.3, total_ratings: 310,
    routes: ['Maharashtra', 'Karnataka'],
    depot_address: 'Mahindra Translogistics, Transport Nagar, Mumbai, Maharashtra 400001',
    description: 'Covering Maharashtra and Karnataka with a strong fleet.',
    established: '1979', contact_phone: '9876500002', experience: '45+',
    delivery_time: '5-6 days', additional_info: 'Office in Transport Nagar',
  },
  {
    id: 'tc-003',
    name: 'Surjit Goods Carrier Pvt Ltd',
    location: 'Punjab, Haryana, J&K, Delhi, HP',
    rate_per_kg: 3, rate_display: '2-4', rating: 4.7, total_ratings: 580,
    routes: ['Punjab', 'Haryana', 'Jammu & Kashmir', 'Delhi', 'Himachal Pradesh'],
    depot_address: 'Surjit Goods Carrier Pvt Ltd, Transport Nagar, Ludhiana, Punjab 141003',
    description: 'Massive coverage across North India with 1-2 day delivery.',
    established: '1979', contact_phone: '9876500003', experience: '45+',
    delivery_time: '1-2 days', additional_info: 'Different rates per region',
  },
  {
    id: 'tc-004',
    name: 'North Eastern Carrying Corporation (NCC)',
    location: 'Assam, Bihar, West Bengal, Odisha, Jharkhand',
    rate_per_kg: 2.5, rate_display: '2-3', rating: 4.4, total_ratings: 390,
    routes: ['Assam', 'Bihar', 'West Bengal', 'Odisha', 'Jharkhand'],
    depot_address: 'NCC Transport Hub, Transport Nagar, Ludhiana, Punjab 141003',
    description: 'Specialized in North-East India routes. Most trusted for NE cargo.',
    established: '1969', contact_phone: '9876500004', experience: '55+',
    delivery_time: '10-20 days', additional_info: 'Specialized in North-East routes',
  },
];

async function run() {
  console.log('Checking transport_companies table...');

  const { data: existing, error: checkError } = await supabase
    .from('transport_companies').select('id').limit(1);

  if (checkError && checkError.message.includes('does not exist')) {
    console.log('\n Table does not exist. Create it via Supabase SQL Editor:\n');
    console.log(`CREATE TABLE transport_companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  rate_per_kg NUMERIC(10,2) DEFAULT 0,
  rate_display TEXT,
  rating NUMERIC(3,1) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  routes JSONB DEFAULT '[]'::jsonb,
  depot_address TEXT,
  description TEXT,
  established TEXT,
  contact_phone TEXT,
  experience TEXT,
  delivery_time TEXT,
  additional_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE transport_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON transport_companies FOR ALL USING (true) WITH CHECK (true);`);
    console.log('\nThen run this script again to seed data.');
    return;
  }
  if (checkError) { console.error('Error:', checkError.message); return; }

  if (existing && existing.length > 0) {
    console.log('Data already exists. Skipping seed.');
    const { data: all } = await supabase.from('transport_companies').select('id, name');
    if (all) all.forEach(c => console.log(`  - ${c.id}: ${c.name}`));
    return;
  }

  console.log('Seeding companies...');
  const { data: inserted, error: insertError } = await supabase
    .from('transport_companies').insert(SEED_COMPANIES).select('id, name');

  if (insertError) { console.error('Seed error:', insertError.message); return; }
  console.log(`Seeded ${inserted.length} companies:`);
  inserted.forEach(c => console.log(`  - ${c.id}: ${c.name}`));
}

run().catch(console.error);
