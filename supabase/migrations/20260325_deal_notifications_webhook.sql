-- Enable pg_net extension for HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a function that sends the webhook payload to our Edge Function
CREATE OR REPLACE FUNCTION notify_deal_change()
RETURNS trigger AS $$
DECLARE
  payload jsonb;
  edge_function_url text;
BEGIN
  -- Build the webhook payload matching Supabase webhook format
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
  );

  -- Edge Function URL (uses project ref from SUPABASE_URL)
  edge_function_url := current_setting('app.settings.supabase_url', true)
    || '/functions/v1/deal-notifications';

  -- If the setting isn't available, use a hardcoded fallback
  IF edge_function_url IS NULL OR edge_function_url = '/functions/v1/deal-notifications' THEN
    edge_function_url := 'https://eawfhchyytnsewgnbznm.supabase.co/functions/v1/deal-notifications';
  END IF;

  -- Fire async HTTP request via pg_net
  PERFORM net.http_post(
    url := edge_function_url,
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on deals table for INSERT and UPDATE
DROP TRIGGER IF EXISTS on_deal_change ON deals;
CREATE TRIGGER on_deal_change
  AFTER INSERT OR UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION notify_deal_change();
