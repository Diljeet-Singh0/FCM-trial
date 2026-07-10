-- Migration 005: Performance Indexes
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Index on owner_id and created_at in requests table (speeds up history queries)
CREATE INDEX IF NOT EXISTS idx_requests_owner_id_created_at ON requests(owner_id, created_at DESC);

-- 2. Index on transporter_id in requests table (speeds up driver-specific queries)
CREATE INDEX IF NOT EXISTS idx_requests_transporter_id ON requests(transporter_id);

-- 3. Index on status in requests table (speeds up matching/pending search waves)
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

NOTIFY pgrst, 'reload schema';
