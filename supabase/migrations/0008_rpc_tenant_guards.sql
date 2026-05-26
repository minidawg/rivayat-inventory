-- Add tenant ownership guards to delete_sale_atomic, delete_purchase_atomic,
-- and stock_in_sku. These were SECURITY DEFINER (bypassing RLS) without any
-- tenant check, allowing a user with a valid JWT to manipulate any tenant's
-- data if they knew the target UUID.

CREATE OR REPLACE FUNCTION delete_sale_atomic(p_sale_id UUID)
RETURNS JSON AS $$
DECLARE
  v_sku_id UUID;
  v_qty    INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sales sa
    JOIN skus      s  ON sa.sku_id         = s.id
    JOIN articles  a  ON s.article_id      = a.id
    JOIN collections c ON a.collection_id  = c.id
    JOIN brands    b  ON c.brand_id        = b.id
    WHERE sa.id = p_sale_id AND b.tenant_id = current_tenant_id()
  ) THEN
    RETURN json_build_object('error', 'Sale not found or access denied');
  END IF;

  DELETE FROM sales WHERE id = p_sale_id
  RETURNING sku_id, quantity INTO v_sku_id, v_qty;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Sale not found');
  END IF;

  UPDATE skus SET quantity = quantity + v_qty WHERE id = v_sku_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION delete_purchase_atomic(p_purchase_id UUID)
RETURNS JSON AS $$
DECLARE
  v_sku_id UUID;
  v_qty    INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM purchases p
    JOIN skus      s  ON p.sku_id          = s.id
    JOIN articles  a  ON s.article_id      = a.id
    JOIN collections c ON a.collection_id  = c.id
    JOIN brands    b  ON c.brand_id        = b.id
    WHERE p.id = p_purchase_id AND b.tenant_id = current_tenant_id()
  ) THEN
    RETURN json_build_object('error', 'Purchase not found or access denied');
  END IF;

  DELETE FROM purchases WHERE id = p_purchase_id
  RETURNING sku_id, quantity INTO v_sku_id, v_qty;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Purchase not found');
  END IF;

  UPDATE skus SET quantity = GREATEST(0, quantity - v_qty) WHERE id = v_sku_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION stock_in_sku(
  p_sku_id              UUID,
  p_quantity            INT,
  p_total_cost_per_unit NUMERIC,
  p_exchange_rate       NUMERIC
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM skus      s
    JOIN articles  a  ON s.article_id      = a.id
    JOIN collections c ON a.collection_id  = c.id
    JOIN brands    b  ON c.brand_id        = b.id
    WHERE s.id = p_sku_id AND b.tenant_id = current_tenant_id()
  ) THEN
    RAISE EXCEPTION 'SKU not found or access denied';
  END IF;

  UPDATE skus SET
    avg_cost_pkr = CASE
      WHEN quantity + p_quantity = 0 THEN 0
      ELSE (avg_cost_pkr * quantity + p_total_cost_per_unit * p_quantity)
           / (quantity + p_quantity)
    END,
    avg_exchange_rate = CASE
      WHEN quantity + p_quantity = 0 THEN 0
      ELSE (avg_exchange_rate * quantity + p_exchange_rate * p_quantity)
           / (quantity + p_quantity)
    END,
    quantity = quantity + p_quantity
  WHERE id = p_sku_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
