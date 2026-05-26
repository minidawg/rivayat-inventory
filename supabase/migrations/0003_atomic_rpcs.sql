-- 1. Atomic sale recording
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
  v_sale_id UUID;
  v_remaining INT;
BEGIN
  UPDATE skus
  SET quantity = quantity - p_quantity
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

-- 2. Atomic multi-size sale
CREATE OR REPLACE FUNCTION record_multi_sale(
  p_items JSONB,
  p_channel TEXT DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  item JSONB;
  v_sku_id UUID;
  v_qty INT;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_sku_id := (item->>'sku_id')::UUID;
    v_qty := (item->>'quantity')::INT;

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

-- 3. Atomic sale deletion with stock restore
CREATE OR REPLACE FUNCTION delete_sale_atomic(p_sale_id UUID)
RETURNS JSON AS $$
DECLARE
  v_sku_id UUID;
  v_qty INT;
BEGIN
  DELETE FROM sales WHERE id = p_sale_id
  RETURNING sku_id, quantity INTO v_sku_id, v_qty;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Sale not found');
  END IF;

  UPDATE skus SET quantity = quantity + v_qty WHERE id = v_sku_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Atomic purchase deletion with stock adjustment
CREATE OR REPLACE FUNCTION delete_purchase_atomic(p_purchase_id UUID)
RETURNS JSON AS $$
DECLARE
  v_sku_id UUID;
  v_qty INT;
BEGIN
  DELETE FROM purchases WHERE id = p_purchase_id
  RETURNING sku_id, quantity INTO v_sku_id, v_qty;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Purchase not found');
  END IF;

  UPDATE skus SET quantity = GREATEST(0, quantity - v_qty) WHERE id = v_sku_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Atomic stock-in with weighted average
CREATE OR REPLACE FUNCTION stock_in_sku(
  p_sku_id UUID,
  p_quantity INT,
  p_total_cost_per_unit NUMERIC,
  p_exchange_rate NUMERIC
) RETURNS VOID AS $$
BEGIN
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
