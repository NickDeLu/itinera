-- Postgres schema for Itinera travel itinerary management platform

-- Enable UUID generation functions for Supabase/Postgres
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users and authentication profiles
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE, -- user login email
  full_name text, -- optional display name
  password_hash text, -- hashed password for local auth
  avatar_url text, -- optional link to profile image
  preferred_timezone text, -- user's default timezone
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trip management
CREATE TABLE trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- owner of the trip
  name text NOT NULL, -- trip title/name
  destination text, -- main trip destination or location
  start_date date, -- trip start date
  end_date date, -- trip end date
  description text, -- optional trip notes
  status text NOT NULL DEFAULT 'active', -- active, completed, cancelled, etc.
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Supported itinerary item types
CREATE TABLE activity_types (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE, -- internal activity type key
  label text NOT NULL -- human-readable type label
);

INSERT INTO activity_types (slug, label) VALUES
  ('flight', 'Flight'),
  ('hotel', 'Hotel'),
  ('restaurant', 'Restaurant'),
  ('event', 'Activity/Event'),
  ('transportation', 'Transportation')
ON CONFLICT (slug) DO NOTHING;

-- Inbound email metadata used for auto-generated itinerary creation
CREATE TABLE email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- owner of the email and parsed trip
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL, -- optional associated trip
  sender_email text, -- email address that sent the booking/confirmation
  recipient_email text, -- destination inbox or forward address received by the system
  subject text, -- email subject line
  body text, -- plain text body of the email (for AI processing)
  received_at timestamptz, -- timestamp from the inbound email
  parsed boolean NOT NULL DEFAULT false, -- whether AI parsing completed successfully
  parsed_at timestamptz, -- when parsing finished
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Itinerary items associated with trips
CREATE TABLE itinerary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE, -- trip that owns this item
  activity_type_id integer NOT NULL REFERENCES activity_types(id), -- type of itinerary item
  source_email_id uuid REFERENCES email_messages(id) ON DELETE SET NULL, -- optional source email
  title text NOT NULL, -- item title, e.g. "Flight to NYC"
  description text, -- additional details
  location text, -- short location text or venue
  start_timestamp timestamptz, -- planned start time
  end_timestamp timestamptz, -- planned end time
  ordinal integer NOT NULL DEFAULT 0, -- manual ordering within the trip
  status text NOT NULL DEFAULT 'scheduled', -- scheduled, completed, cancelled
  metadata jsonb, -- extensible parsed fields like flight number, hotel address
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_itinerary_items_trip_id ON itinerary_items(trip_id);
CREATE INDEX idx_itinerary_items_start_timestamp ON itinerary_items(start_timestamp);

-- User email whitelist: only trusted senders can auto-create itinerary items
CREATE TABLE user_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_user_emails_email ON user_emails(email);
CREATE INDEX idx_user_emails_user_id ON user_emails(user_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_emails ENABLE ROW LEVEL SECURITY;

-- USERS table policies
-- Allow users to read only their own user record
CREATE POLICY "Users can read their own profile" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Allow authenticated users to insert a new user record (signup)
CREATE POLICY "Users can create their own profile" ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to update only their own user record
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- TRIPS table policies
-- Allow users to select only their own trips
CREATE POLICY "Users can read their own trips" ON trips
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert trips they own
CREATE POLICY "Users can create trips" ON trips
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update only their own trips
CREATE POLICY "Users can update their own trips" ON trips
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete only their own trips
CREATE POLICY "Users can delete their own trips" ON trips
  FOR DELETE
  USING (auth.uid() = user_id);

-- EMAIL_MESSAGES table policies
-- Allow users to read only email messages associated with their trips
CREATE POLICY "Users can read their email messages" ON email_messages
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert email messages
CREATE POLICY "Users can create email messages" ON email_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update only their own email messages
CREATE POLICY "Users can update their email messages" ON email_messages
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete only their own email messages
CREATE POLICY "Users can delete their email messages" ON email_messages
  FOR DELETE
  USING (auth.uid() = user_id);

-- USER_EMAILS table policies
-- Allow users to read only their own trusted emails
CREATE POLICY "Users can read their trusted emails" ON user_emails
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert trusted emails
CREATE POLICY "Users can insert trusted emails" ON user_emails
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete only their own trusted emails
CREATE POLICY "Users can delete their trusted emails" ON user_emails
  FOR DELETE
  USING (auth.uid() = user_id);

-- ITINERARY_ITEMS table policies
-- Allow users to read itinerary items from their own trips
CREATE POLICY "Users can read itinerary items from their trips" ON itinerary_items
  FOR SELECT
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE trips.user_id = auth.uid()
    )
  );

-- Allow users to insert itinerary items into their own trips
CREATE POLICY "Users can create itinerary items in their trips" ON itinerary_items
  FOR INSERT
  WITH CHECK (
    trip_id IN (
      SELECT id FROM trips WHERE trips.user_id = auth.uid()
    )
  );

-- Allow users to update itinerary items in their own trips
CREATE POLICY "Users can update itinerary items in their trips" ON itinerary_items
  FOR UPDATE
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE trips.user_id = auth.uid()
    )
  )
  WITH CHECK (
    trip_id IN (
      SELECT id FROM trips WHERE trips.user_id = auth.uid()
    )
  );

-- Allow users to delete itinerary items from their own trips
CREATE POLICY "Users can delete itinerary items from their trips" ON itinerary_items
  FOR DELETE
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE trips.user_id = auth.uid()
    )
  );
