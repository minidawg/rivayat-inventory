-- Add tenant_id to root tables
ALTER TABLE brands ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE settings ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE overheads ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

-- Fix unique constraints to be tenant-scoped
ALTER TABLE brands DROP CONSTRAINT brands_name_key;
ALTER TABLE brands ADD CONSTRAINT brands_tenant_name_unique UNIQUE (tenant_id, name);

ALTER TABLE settings DROP CONSTRAINT settings_pkey;
ALTER TABLE settings ADD PRIMARY KEY (tenant_id, key);

-- Helper: set tenant_id per request (called from the app)
CREATE OR REPLACE FUNCTION set_tenant_id(p_tenant_id TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.tenant_id', p_tenant_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: read tenant_id (used by RLS policies)
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS TEXT AS $$
  SELECT COALESCE(current_setting('app.tenant_id', true), 'default');
$$ LANGUAGE SQL STABLE;

-- Replace all RLS policies with tenant-scoped ones

DROP POLICY IF EXISTS "auth_all" ON brands;
CREATE POLICY "tenant_isolation" ON brands
  FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "auth_all" ON collections;
CREATE POLICY "tenant_isolation" ON collections
  FOR ALL TO authenticated
  USING (brand_id IN (SELECT id FROM brands WHERE tenant_id = current_tenant_id()))
  WITH CHECK (brand_id IN (SELECT id FROM brands WHERE tenant_id = current_tenant_id()));

DROP POLICY IF EXISTS "auth_all" ON articles;
CREATE POLICY "tenant_isolation" ON articles
  FOR ALL TO authenticated
  USING (collection_id IN (
    SELECT c.id FROM collections c JOIN brands b ON c.brand_id = b.id
    WHERE b.tenant_id = current_tenant_id()
  ))
  WITH CHECK (collection_id IN (
    SELECT c.id FROM collections c JOIN brands b ON c.brand_id = b.id
    WHERE b.tenant_id = current_tenant_id()
  ));

DROP POLICY IF EXISTS "auth_all" ON skus;
CREATE POLICY "tenant_isolation" ON skus
  FOR ALL TO authenticated
  USING (article_id IN (
    SELECT a.id FROM articles a
    JOIN collections c ON a.collection_id = c.id
    JOIN brands b ON c.brand_id = b.id
    WHERE b.tenant_id = current_tenant_id()
  ))
  WITH CHECK (article_id IN (
    SELECT a.id FROM articles a
    JOIN collections c ON a.collection_id = c.id
    JOIN brands b ON c.brand_id = b.id
    WHERE b.tenant_id = current_tenant_id()
  ));

DROP POLICY IF EXISTS "auth_all" ON purchases;
CREATE POLICY "tenant_isolation" ON purchases
  FOR ALL TO authenticated
  USING (sku_id IN (
    SELECT s.id FROM skus s
    JOIN articles a ON s.article_id = a.id
    JOIN collections c ON a.collection_id = c.id
    JOIN brands b ON c.brand_id = b.id
    WHERE b.tenant_id = current_tenant_id()
  ))
  WITH CHECK (sku_id IN (
    SELECT s.id FROM skus s
    JOIN articles a ON s.article_id = a.id
    JOIN collections c ON a.collection_id = c.id
    JOIN brands b ON c.brand_id = b.id
    WHERE b.tenant_id = current_tenant_id()
  ));

DROP POLICY IF EXISTS "auth_all" ON sales;
CREATE POLICY "tenant_isolation" ON sales
  FOR ALL TO authenticated
  USING (sku_id IN (
    SELECT s.id FROM skus s
    JOIN articles a ON s.article_id = a.id
    JOIN collections c ON a.collection_id = c.id
    JOIN brands b ON c.brand_id = b.id
    WHERE b.tenant_id = current_tenant_id()
  ))
  WITH CHECK (sku_id IN (
    SELECT s.id FROM skus s
    JOIN articles a ON s.article_id = a.id
    JOIN collections c ON a.collection_id = c.id
    JOIN brands b ON c.brand_id = b.id
    WHERE b.tenant_id = current_tenant_id()
  ));

DROP POLICY IF EXISTS "auth_all" ON settings;
CREATE POLICY "tenant_isolation" ON settings
  FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "auth_all" ON overheads;
CREATE POLICY "tenant_isolation" ON overheads
  FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Migrate existing data to sister's tenant
UPDATE brands SET tenant_id = 'sister' WHERE tenant_id = 'default';
UPDATE settings SET tenant_id = 'sister' WHERE tenant_id = 'default';
UPDATE overheads SET tenant_id = 'sister' WHERE tenant_id = 'default';
