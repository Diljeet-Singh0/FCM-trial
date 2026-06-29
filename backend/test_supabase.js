try {
  const { createClient } = require('@supabase/supabase-js');
  console.log('Supabase client loaded successfully');
} catch (e) {
  console.error('Failed to load:', e.message);
}
