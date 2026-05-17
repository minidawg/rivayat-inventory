'use server'

import { getSupabaseServerClient } from '@/lib/supabase/server'

// ─── Stock In ─────────────────────────────────────────────────────────────────

export async function stockIn(
  articleName: string,
  collectionId: string,
  sizes: { size: string; quantity: number }[],
  costPKR: number,
  commissionPKR: number,
  shippingPKR: number,
  exchangeRate: number,
  source: string,
  notes: string,
  paidToWajid: boolean,
) {
  const client = await getSupabaseServerClient()
  const totalCostPerUnit = costPKR + commissionPKR + shippingPKR

  let { data: article } = await client
    .from('articles')
    .select('id')
    .eq('collection_id', collectionId)
    .eq('name', articleName)
    .maybeSingle()

  if (!article) {
    const { data, error } = await client
      .from('articles')
      .insert({ name: articleName, collection_id: collectionId })
      .select('id')
      .single()
    if (error) throw error
    article = data
  }

  for (const { size, quantity } of sizes) {
    const { data: existingSku } = await client
      .from('skus')
      .select('id, quantity, avg_cost_pkr, avg_exchange_rate')
      .eq('article_id', article!.id)
      .eq('size', size)
      .maybeSingle()

    let skuId: string

    if (!existingSku) {
      const { data: newSku, error } = await client
        .from('skus')
        .insert({
          article_id: article!.id,
          size,
          quantity,
          low_stock_buffer: 2,
          avg_cost_pkr: totalCostPerUnit,
          avg_exchange_rate: exchangeRate,
        })
        .select('id')
        .single()
      if (error) throw error
      skuId = newSku.id
    } else {
      const newQty = existingSku.quantity + quantity
      const newAvgCost =
        (existingSku.avg_cost_pkr * existingSku.quantity + totalCostPerUnit * quantity) / newQty
      const newAvgRate =
        (existingSku.avg_exchange_rate * existingSku.quantity + exchangeRate * quantity) / newQty

      await client
        .from('skus')
        .update({ quantity: newQty, avg_cost_pkr: newAvgCost, avg_exchange_rate: newAvgRate })
        .eq('id', existingSku.id)

      skuId = existingSku.id
    }

    const { error } = await client.from('purchases').insert({
      sku_id: skuId,
      quantity,
      cost_pkr: costPKR,
      commission_pkr: commissionPKR,
      shipping_pkr: shippingPKR,
      exchange_rate: exchangeRate,
      source: source || null,
      notes: notes || null,
      paid_to_wajid: paidToWajid,
    })
    if (error) throw error
  }
}

// ─── Record Sale ─────────────────────────────────────────────────────────────
// sellingPriceUSD: the price in USD (primary currency, stored in selling_price column)
// avgCostPKR:      the cost basis in PKR (stored in cost_pkr_at_sale)
// exchangeRate:    PKR/USD rate at time of sale (stored in exchange_rate_at_sale)

export async function recordSale(
  skuId: string,
  quantity: number,
  sellingPriceUSD: number,
  channel: string,
  clientName: string,
  avgCostPKR: number,
  exchangeRate: number,
  paymentMethod: string,
) {
  const client = await getSupabaseServerClient()

  const { data: sku, error: skuError } = await client
    .from('skus')
    .select('quantity')
    .eq('id', skuId)
    .single()

  if (skuError || !sku) throw new Error('SKU not found')
  if (sku.quantity < quantity) throw new Error('Insufficient stock')

  const { error: updateError } = await client
    .from('skus')
    .update({ quantity: sku.quantity - quantity })
    .eq('id', skuId)
  if (updateError) throw updateError

  const { error: saleError } = await client.from('sales').insert({
    sku_id: skuId,
    quantity,
    selling_price: sellingPriceUSD,
    cost_pkr_at_sale: avgCostPKR,
    exchange_rate_at_sale: exchangeRate,
    channel: channel || null,
    client_name: clientName || null,
    payment_method: paymentMethod || null,
  })
  if (saleError) throw saleError
}

// ─── Delete Sale ──────────────────────────────────────────────────────────────

export async function deleteSale(saleId: string) {
  const client = await getSupabaseServerClient()

  const { data: sale } = await client
    .from('sales')
    .select('sku_id, quantity')
    .eq('id', saleId)
    .maybeSingle()

  if (sale) {
    const { data: sku } = await client
      .from('skus')
      .select('quantity')
      .eq('id', sale.sku_id)
      .maybeSingle()
    if (sku) {
      await client
        .from('skus')
        .update({ quantity: sku.quantity + sale.quantity })
        .eq('id', sale.sku_id)
    }
  }

  const { error } = await client.from('sales').delete().eq('id', saleId)
  if (error) throw error
}

// ─── Inventory edits ──────────────────────────────────────────────────────────

export async function updateSKUQuantity(skuId: string, quantity: number) {
  const client = await getSupabaseServerClient()
  const { error } = await client.from('skus').update({ quantity }).eq('id', skuId)
  if (error) throw error
}

export async function updateSku(
  skuId: string,
  updates: { quantity?: number; lowStockBuffer?: number; avgCostPKR?: number },
) {
  const client = await getSupabaseServerClient()
  const { error } = await client.from('skus').update({
    ...(updates.quantity !== undefined      && { quantity:          updates.quantity }),
    ...(updates.lowStockBuffer !== undefined && { low_stock_buffer: updates.lowStockBuffer }),
    ...(updates.avgCostPKR !== undefined    && { avg_cost_pkr:      updates.avgCostPKR }),
  }).eq('id', skuId)
  if (error) throw error
}

export async function updateArticle(
  articleId: string,
  updates: { name?: string; collection_id?: string },
) {
  const client = await getSupabaseServerClient()
  const { error } = await client.from('articles').update(updates).eq('id', articleId)
  if (error) throw error
}

export async function deleteArticle(articleId: string) {
  const client = await getSupabaseServerClient()
  const { error } = await client.from('articles').delete().eq('id', articleId)
  if (error) throw error
}

// ─── Brands & Collections ─────────────────────────────────────────────────────

export async function addBrand(name: string) {
  const client = await getSupabaseServerClient()
  const { error } = await client.from('brands').insert({ name })
  if (error) throw error
}

export async function deleteBrand(brandId: string) {
  const client = await getSupabaseServerClient()
  const { error } = await client.from('brands').delete().eq('id', brandId)
  if (error) throw error
}

export async function addCollection(name: string, brandId: string) {
  const client = await getSupabaseServerClient()
  const { error } = await client.from('collections').insert({ name, brand_id: brandId })
  if (error) throw error
}

export async function deleteCollection(collectionId: string) {
  const client = await getSupabaseServerClient()
  const { error } = await client.from('collections').delete().eq('id', collectionId)
  if (error) throw error
}

export async function clearAllData() {
  const client = await getSupabaseServerClient()
  await client.from('sales').delete().not('id', 'is', null)
  await client.from('purchases').delete().not('id', 'is', null)
  await client.from('skus').delete().not('id', 'is', null)
  await client.from('articles').delete().not('id', 'is', null)
}

// ─── Paid to Wajid ────────────────────────────────────────────────────────────

export async function updateSkuPaidStatus(skuId: string, paidToWajid: boolean) {
  const client = await getSupabaseServerClient()
  const { error } = await client
    .from('purchases')
    .update({ paid_to_wajid: paidToWajid })
    .eq('sku_id', skuId)
  if (error) throw error
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function updateSetting(key: string, value: string) {
  const client = await getSupabaseServerClient()
  const { error } = await client
    .from('settings')
    .upsert({ key, value }, { onConflict: 'key' })
  if (error) throw error
}
