-- Add factory details to users table for owner roles
ALTER TABLE users ADD COLUMN IF NOT EXISTS factory_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS factory_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS factory_lat FLOAT8;
ALTER TABLE users ADD COLUMN IF NOT EXISTS factory_lng FLOAT8;

NOTIFY pgrst, 'reload schema';
