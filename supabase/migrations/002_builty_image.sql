-- Add builty_image column to store base64-encoded photo of builty receipt
ALTER TABLE requests ADD COLUMN IF NOT EXISTS builty_image TEXT;
