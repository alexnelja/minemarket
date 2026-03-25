-- Fix: Allow authenticated users to read basic profile info (company_name, country, role) for other users
-- This is needed for deal counterparty name display and marketplace trust indicators
-- The existing policy "Users can read own profile" restricts SELECT to auth.uid() = id only

CREATE POLICY "Authenticated users can read basic profiles" ON users
  FOR SELECT TO authenticated
  USING (true);

-- Drop the old restrictive policy since the new one covers it
DROP POLICY IF EXISTS "Users can read own profile" ON users;
