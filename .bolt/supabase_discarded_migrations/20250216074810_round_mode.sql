/*
  # Activity Logging Schema

  1. New Tables
    - `activity_logs`
      - `id` (uuid, primary key)
      - `user_id` (text) - User ID (can be Telegram ID or Supabase UUID)
      - `event_type` (text) - Type of event (API_CALL, ERROR, etc.)
      - `action` (text) - The action being performed
      - `details` (jsonb) - Additional event details
      - `status` (text) - Success/Error status
      - `created_at` (timestamp)
    
  2. Security
    - Enable RLS on `activity_logs` table
    - Add policy for authenticated users to read their own logs
    - Add policy for service role to insert logs

  3. Changes from Previous Version
    - Changed user_id from bigint to text to support both Telegram IDs and Supabase UUIDs
    - Updated RLS policy to use text comparison
*/

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  event_type text NOT NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own logs
CREATE POLICY "Users can read own logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

-- Policy for service role to insert logs
CREATE POLICY "Service role can insert logs"
  ON activity_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);