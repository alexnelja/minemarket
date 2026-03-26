CREATE OR REPLACE FUNCTION increment_listing_views(listing_id UUID)
RETURNS void AS $$
  UPDATE listings SET view_count = COALESCE(view_count, 0) + 1 WHERE id = listing_id;
$$ LANGUAGE sql SECURITY DEFINER;
