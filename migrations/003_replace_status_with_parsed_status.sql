-- Migration: Replace status column with parsed_status (in_review | verified)
-- Run this in the Supabase SQL editor after 002_email_review_queue.sql

BEGIN;

ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS parsed_status text;

-- Back-fill from old status values
UPDATE email_messages SET parsed_status = 'in_review' WHERE status IN ('pending', 'in_review');
UPDATE email_messages SET parsed_status = 'verified'  WHERE status = 'parsed';

-- Ensure emails with no parsed_data get an empty structure so the review form works
UPDATE email_messages
  SET parsed_data = '{"trip_id": null, "trip": {}, "items": [], "review_reasons": ["No data was extracted — please fill in manually"]}'::jsonb
  WHERE parsed_status = 'in_review' AND parsed_data IS NULL;

ALTER TABLE email_messages
  ADD CONSTRAINT email_messages_parsed_status_check
  CHECK (parsed_status IN ('in_review', 'verified'));

ALTER TABLE email_messages DROP COLUMN IF EXISTS status;
DROP INDEX IF EXISTS idx_email_messages_status;

CREATE INDEX IF NOT EXISTS idx_email_messages_parsed_status
  ON email_messages(user_id, parsed_status);

COMMIT;
