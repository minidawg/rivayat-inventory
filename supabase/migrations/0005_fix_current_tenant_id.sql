-- Fix current_tenant_id() to read from JWT app_metadata.
-- The set_tenant_id() RPC call was removed; the old fallback to
-- current_setting('app.tenant_id') is never populated, causing all
-- tenant-isolated RLS WITH CHECK policies to fail with 'default'.
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (auth.jwt()->'app_metadata'->>'tenant_id'),
    current_setting('app.tenant_id', true),
    'default'
  );
$$ LANGUAGE SQL STABLE;
