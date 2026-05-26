-- ─── Safety net: ensure overheads table exists ───────────────────────────────
CREATE TABLE IF NOT EXISTS overheads (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  category     text        NOT NULL,
  amount       numeric     NOT NULL CHECK (amount > 0),
  expense_date text        NOT NULL,
  notes        text,
  tenant_id    text        NOT NULL DEFAULT 'default'
);
ALTER TABLE overheads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON overheads;
CREATE POLICY "tenant_isolation" ON overheads
  FOR ALL TO authenticated
  USING  (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ─── Audit log table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  tenant_id   text        NOT NULL,
  user_id     uuid,
  user_email  text,
  action      text        NOT NULL,
  table_name  text        NOT NULL,
  record_id   text,
  summary     text        NOT NULL,
  metadata    jsonb
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON audit_logs;
CREATE POLICY "tenant_isolation" ON audit_logs
  FOR ALL TO authenticated
  USING  (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ─── Fix SECURITY DEFINER RPCs: add tenant ownership guard ───────────────────
CREATE OR REPLACE FUNCTION record_sale_atomic(
  p_sku_id UUID,
  p_quantity INT,
  p_selling_price NUMERIC,
  p_cost_pkr NUMERIC,
  p_exchange_rate NUMERIC,
  p_channel TEXT DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_sale_id   UUID;
  v_remaining INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM skus s
    JOIN articles a ON s.article_id = a.id
    JOIN collections c ON a.collection_id = c.id
    JOIN brands b ON c.brand_id = b.id
    WHERE s.id = p_sku_id AND b.tenant_id = current_tenant_id()
  ) THEN
    RETURN json_build_object('error', 'SKU not found or access denied');
  END IF;

  UPDATE skus SET quantity = quantity - p_quantity
  WHERE id = p_sku_id AND quantity >= p_quantity
  RETURNING quantity INTO v_remaining;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Insufficient stock');
  END IF;

  INSERT INTO sales (
    sku_id, quantity, selling_price, cost_pkr_at_sale,
    exchange_rate_at_sale, channel, client_name, payment_method
  ) VALUES (
    p_sku_id, p_quantity, p_selling_price, p_cost_pkr,
    p_exchange_rate, p_channel, p_client_name, p_payment_method
  ) RETURNING id INTO v_sale_id;

  RETURN json_build_object('id', v_sale_id, 'remaining', v_remaining);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_multi_sale(
  p_items JSONB,
  p_channel TEXT DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  item     JSONB;
  v_sku_id UUID;
  v_qty    INT;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_sku_id := (item->>'sku_id')::UUID;
    v_qty    := (item->>'quantity')::INT;

    IF NOT EXISTS (
      SELECT 1 FROM skus s
      JOIN articles a ON s.article_id = a.id
      JOIN collections c ON a.collection_id = c.id
      JOIN brands b ON c.brand_id = b.id
      WHERE s.id = v_sku_id AND b.tenant_id = current_tenant_id()
    ) THEN
      RAISE EXCEPTION 'SKU % not found or access denied', v_sku_id;
    END IF;

    UPDATE skus SET quantity = quantity - v_qty
    WHERE id = v_sku_id AND quantity >= v_qty;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock for SKU %', v_sku_id;
    END IF;

    INSERT INTO sales (
      sku_id, quantity, selling_price, cost_pkr_at_sale,
      exchange_rate_at_sale, channel, client_name, payment_method
    ) VALUES (
      v_sku_id, v_qty,
      (item->>'selling_price')::NUMERIC,
      (item->>'cost_pkr')::NUMERIC,
      (item->>'exchange_rate')::NUMERIC,
      p_channel, p_client_name, p_payment_method
    );
  END LOOP;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Developer changelog seed ─────────────────────────────────────────────────
INSERT INTO settings (tenant_id, key, value)
VALUES ('rivayat', 'app_changelog', '[
  {
    "date": "2026-05-26",
    "author": "Claude Sonnet 4.6",
    "changes": [
      "Fixed RLS violation on overheads: current_tenant_id() now reads from JWT app_metadata instead of never-set session variable (migration 0005)",
      "Fixed record_multi_sale scalar error: removed JSON.stringify — was passing text string to JSONB param causing jsonb_array_elements to fail",
      "Renamed tenant from ''sister'' to ''rivayat'' — updated TENANT_ID env var, migrated all data rows in brands/settings/overheads",
      "Added input validation to recordSale, recordMultiSale, stockIn (quantity > 0, price > 0, valid sizes, non-empty items array)",
      "Wrapped updateSkuPaidStatus in try/catch with consistent { error? } return type",
      "Added console.error logging to deleteSale and deletePurchase before re-throw",
      "Removed dead x-tenant-id custom header from Supabase client (ignored by Supabase; tenant isolation comes from JWT)",
      "Fixed TypeScript type for record_multi_sale p_items: string → Json to match JSONB parameter",
      "Added audit_logs table with RLS — tracks all data mutations with user_id, user_email, action, summary, metadata",
      "Fixed SECURITY DEFINER RPC tenant isolation: added tenant ownership guard inside record_sale_atomic and record_multi_sale",
      "Added Developer Changelog and Recent Activity sections to Settings page"
    ]
  },
  {
    "date": "2026-05-27",
    "author": "Claude Sonnet 4.6",
    "changes": [
      "Dashboard KPI cards: replaced 8 cards with 5 core metrics — Inventory Value, Total Revenue, Total Expenses, Total Cost, Net Profit",
      "Dashboard charts: removed Profit by Brand donut; added Revenue by Channel panel with horizontal bars showing USD and % per channel",
      "Terminology: renamed Record Cost → Record Expense and Cost Log → Expense Log in sidebar and page headers (routes and DB tables unchanged)",
      "Confirmed low stock toggle logic (lowStockAlertsEnabled) fully intact after dashboard refactor"
    ]
  }
]')
ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;
