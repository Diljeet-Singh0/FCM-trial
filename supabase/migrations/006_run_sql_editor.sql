-- 1. Create the helper function to execute SQL DDL statements (if it doesn't exist)
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- 2. Add the routes_v2 and images columns to the transport_companies table
ALTER TABLE transport_companies ADD COLUMN IF NOT EXISTS routes_v2 JSONB DEFAULT '[]'::jsonb;
ALTER TABLE transport_companies ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- 3. Add the city column to the users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;

-- 4. Reload PostgREST schema cache to make sure the API immediately picks up the new columns
NOTIFY pgrst, 'reload schema';
