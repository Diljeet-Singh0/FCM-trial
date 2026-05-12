-- Users table (both roles)
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT UNIQUE NOT NULL,
  role       TEXT CHECK (role IN ('owner', 'transporter')) NOT NULL,
  fcm_token  TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Shipment requests created by owners
CREATE TABLE requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID REFERENCES users(id) NOT NULL,
  goods_type     TEXT NOT NULL,
  weight_kg      FLOAT NOT NULL,
  pickup_address TEXT NOT NULL,
  drop_address   TEXT NOT NULL,
  status         TEXT CHECK (status IN (
                   'pending', 'matched', 'cancelled'
                 )) DEFAULT 'pending',
  transporter_id UUID REFERENCES users(id),
  accepted_price NUMERIC(10,2),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Bids submitted by transporters
CREATE TABLE bids (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     UUID REFERENCES requests(id) NOT NULL,
  transporter_id UUID REFERENCES users(id) NOT NULL,
  price_inr      NUMERIC(10,2) NOT NULL,
  status         TEXT CHECK (status IN (
                   'pending', 'accepted', 'rejected'
                 )) DEFAULT 'pending',
  created_at     TIMESTAMPTZ DEFAULT now()
);
