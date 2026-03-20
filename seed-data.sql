-- Seed Data for Mining Materials Aggregator Platform
-- Run AFTER supabase-setup.sql
-- Note: User records are created via Supabase Auth signup.
-- These seeds assume test users already exist in auth.users.
-- For dev, create test users via Supabase dashboard first, then update UUIDs below.

-- Harbours (South African loading ports + key global destinations)
INSERT INTO harbours (id, name, location, country, type) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Richards Bay', ST_MakePoint(32.0383, -28.7830)::geography, 'ZA', 'loading'),
  ('a0000000-0000-0000-0000-000000000002', 'Saldanha Bay', ST_MakePoint(17.9318, -33.0046)::geography, 'ZA', 'loading'),
  ('a0000000-0000-0000-0000-000000000003', 'Durban', ST_MakePoint(31.0218, -29.8587)::geography, 'ZA', 'loading'),
  ('a0000000-0000-0000-0000-000000000004', 'Maputo', ST_MakePoint(32.5732, -25.9655)::geography, 'MZ', 'loading'),
  ('a0000000-0000-0000-0000-000000000005', 'Shanghai', ST_MakePoint(121.4737, 31.2304)::geography, 'CN', 'destination'),
  ('a0000000-0000-0000-0000-000000000006', 'Mersin', ST_MakePoint(34.6415, 36.7996)::geography, 'TR', 'destination'),
  ('a0000000-0000-0000-0000-000000000007', 'Tianjin', ST_MakePoint(117.3616, 39.3434)::geography, 'CN', 'destination'),
  ('a0000000-0000-0000-0000-000000000008', 'Vizag', ST_MakePoint(83.2185, 17.6868)::geography, 'IN', 'destination');

-- Mines (South African mines — no owner_id until test users are created)
INSERT INTO mines (id, name, location, country, region, commodities, nearest_harbour_id) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Tharisa Mine', ST_MakePoint(27.5820, -25.7460)::geography, 'ZA', 'North West', '{chrome}', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'Dwarsrivier Mine', ST_MakePoint(30.1050, -24.8830)::geography, 'ZA', 'Limpopo', '{chrome}', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000003', 'Hotazel Mine', ST_MakePoint(22.9670, -27.2830)::geography, 'ZA', 'Northern Cape', '{manganese}', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000004', 'Sishen Mine', ST_MakePoint(22.8140, -27.7330)::geography, 'ZA', 'Northern Cape', '{iron_ore}', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000005', 'Grootegeluk Mine', ST_MakePoint(27.7740, -23.6560)::geography, 'ZA', 'Limpopo', '{coal}', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000006', 'AfriSam Quarry', ST_MakePoint(28.2500, -26.2000)::geography, 'ZA', 'Gauteng', '{aggregates}', 'a0000000-0000-0000-0000-000000000003');

-- Routes (mine to nearest harbour)
INSERT INTO routes (id, origin_mine_id, harbour_id, distance_km, transport_mode) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 520, 'road'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 380, 'rail'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 640, 'rail'),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 580, 'rail'),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 350, 'rail'),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 60, 'road');
