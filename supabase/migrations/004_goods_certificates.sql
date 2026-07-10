-- Migration 004: Goods Responsibility Certificates
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

CREATE TABLE IF NOT EXISTS goods_certificates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id      TEXT UNIQUE NOT NULL,          -- GZC-YYYYMMDD-XXXXXX
  trip_id             UUID REFERENCES requests(id) UNIQUE NOT NULL,  -- one cert per trip
  factory_name        TEXT,
  factory_owner_name  TEXT,
  driver_name         TEXT,
  vehicle_number      TEXT,
  goods_description   TEXT,
  pickup_location     TEXT,
  drop_location       TEXT,
  pickup_timestamp    TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by trip_id
CREATE INDEX IF NOT EXISTS idx_goods_certificates_trip_id ON goods_certificates(trip_id);

NOTIFY pgrst, 'reload schema';
