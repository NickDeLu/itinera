-- Migration 001: Add body column to email_messages + create user_emails table
-- Run this in your Supabase SQL editor or via psql

-- 1. Add body column for storing email plain text (used for AI processing)
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS body text;

-- 2. Create user_emails whitelist table (trusted sender addresses)
CREATE TABLE IF NOT EXISTS user_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_emails_email ON user_emails(email);
CREATE INDEX IF NOT EXISTS idx_user_emails_user_id ON user_emails(user_id);

-- 3. Enable RLS
ALTER TABLE user_emails ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY IF NOT EXISTS "Users can read their trusted emails" ON user_emails
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert trusted emails" ON user_emails
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their trusted emails" ON user_emails
  FOR DELETE USING (auth.uid() = user_id);