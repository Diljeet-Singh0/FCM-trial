-- Migration 002: Trip tracking, driver info, and rating
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Extend request status to support full trip lifecycle
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE requests ADD CONSTRAINT requests_status_check
  CHECK (status IN ('pending', 'matched', 'picked_up', 'on_the_way', 'completed', 'cancelled'));

-- 2. Add driver info columns (populated when a transporter accepts)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS driver_vehicle TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS driver_phone TEXT;

-- 3. Add rating column (1-5 stars, set by owner after completion)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5);

-- 4. Add company booking fields
ALTER TABLE requests ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS company_charge NUMERIC(10,2);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS auto_charge NUMERIC(10,2);
