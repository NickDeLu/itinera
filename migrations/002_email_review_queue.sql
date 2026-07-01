-- Migration: Replace parsed boolean with status text + add parsed_data jsonb
-- Run this in the Supabase SQL editor against the live database.

BEGIN;

-- Add new status column (defaults to 'pending' matching parsed=false)
ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Back-fill: rows that were already parsed=true → 'parsed'
UPDATE email_messages
  SET status = 'parsed'
  WHERE parsed = true;

-- Add parsed_data column to store AI-extracted JSON for in_review emails
ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS parsed_data jsonb;

-- Enforce allowed status values
ALTER TABLE email_messages
  ADD CONSTRAINT email_messages_status_check
  CHECK (status IN ('pending', 'in_review', 'parsed'));

-- Drop the old boolean column
ALTER TABLE email_messages DROP COLUMN IF EXISTS parsed;

-- Index for review queue queries
CREATE INDEX IF NOT EXISTS idx_email_messages_status
  ON email_messages(user_id, status);

COMMIT;
