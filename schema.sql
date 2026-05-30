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
