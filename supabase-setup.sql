-- Run this in your Supabase SQL Editor (https://eawfhchyytnsewgnbznm.supabase.co)

-- 1. Create the deployments table
CREATE TABLE deployments (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  commit_message TEXT NOT NULL,
  branch TEXT NOT NULL,
  hash TEXT NOT NULL,
  env TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  author TEXT NOT NULL
);

-- 2. Enable Row Level Security
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

-- 3. Allow public read access (using anon key)
CREATE POLICY "Allow public read" ON deployments
  FOR SELECT USING (true);

-- 4. Seed with the 12 mock entries
INSERT INTO deployments (id, status, commit_message, branch, hash, env, created_at, author) VALUES
  ('dpl_1a',  'Ready',     'Update landing page hero section',           'main',              'a3f8c2d', 'Production', now() - INTERVAL '2 minutes',  'AN'),
  ('dpl_2b',  'Ready',     'Fix authentication redirect loop',           'main',              'e7b1d4f', 'Production', now() - INTERVAL '45 minutes', 'SK'),
  ('dpl_3c',  'Building',  'Add dark mode toggle to settings',           'feat/dark-mode',    'c9a2e8b', 'Preview',    now() - INTERVAL '1 minute',   'JL'),
  ('dpl_4d',  'Error',     'Migrate user table to new schema',           'feat/db-migration', 'f4d6a1c', 'Preview',    now() - INTERVAL '12 minutes', 'TM'),
  ('dpl_5e',  'Ready',     'Bump dependencies to latest versions',       'main',              'b8e3f7a', 'Production', now() - INTERVAL '1 hour',     'AN'),
  ('dpl_6f',  'Cancelled', 'WIP: Experiment with new layout grid',       'feat/grid-v2',      'd2c5b9e', 'Preview',    now() - INTERVAL '2 hours',    'SK'),
  ('dpl_7g',  'Ready',     'Add rate limiting to API endpoints',         'main',              'a1f4c8d', 'Production', now() - INTERVAL '3 hours',    'JL'),
  ('dpl_8h',  'Ready',     'Optimize image loading with blur placeholders', 'feat/image-opt', 'e6b2d5f', 'Preview',    now() - INTERVAL '4 hours',    'TM'),
  ('dpl_9i',  'Error',     'Add Stripe webhook handler',                 'feat/payments',     'c3a7e1b', 'Preview',    now() - INTERVAL '5 hours',    'AN'),
  ('dpl_10j', 'Ready',     'Refactor middleware chain for clarity',       'main',              'f9d1a4c', 'Production', now() - INTERVAL '6 hours',    'SK'),
  ('dpl_11k', 'Ready',     'Add team invitation email templates',        'main',              'b5e8f2a', 'Production', now() - INTERVAL '8 hours',    'JL'),
  ('dpl_12l', 'Cancelled', 'Test: canary deploy pipeline',               'test/canary',       'd7c0b3e', 'Preview',    now() - INTERVAL '1 day',      'TM');
