-- Set tenant_id column defaults from the authenticated user's JWT on all
-- root tenant-owned tables. This means any INSERT that omits tenant_id gets
-- the correct value automatically, so application code never needs to supply it.
--
-- Previously the app passed tenant_id: process.env.TENANT_ID (a server-wide
-- env var = 'rivayat'), which broke RLS WITH CHECK for any other tenant.

ALTER TABLE brands     ALTER COLUMN tenant_id SET DEFAULT (auth.jwt()->'app_metadata'->>'tenant_id');
ALTER TABLE settings   ALTER COLUMN tenant_id SET DEFAULT (auth.jwt()->'app_metadata'->>'tenant_id');
ALTER TABLE overheads  ALTER COLUMN tenant_id SET DEFAULT (auth.jwt()->'app_metadata'->>'tenant_id');
ALTER TABLE audit_logs ALTER COLUMN tenant_id SET DEFAULT (auth.jwt()->'app_metadata'->>'tenant_id');
