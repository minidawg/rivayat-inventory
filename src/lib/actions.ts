'use server'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { OVERHEAD_CATEGORIES, SIZES } from '@/lib/types'
// ─── Audit helper ─────────────────────────────────────────────────────────────

async function logAudit(
  client: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  action: string,
  tableName: string,
  recordId: string | null,
  summary: string,
  metadata?: Record<string, unknown>,
) {
  try {
    const { data: { session } } = await client.auth.getSession()
    await client.from('audit_logs').insert({
      user_id: session?.user?.id ?? null,
      user_email: session?.user?.email ?? null,
      action,
      table_name: tableName,
      record_id: recordId,
      summary,
      metadata: (metadata ?? null) as any,
    })
  } catch (e) {
    console.error('[logAudit] non-fatal failure:', e)
  }
}

// ─── Image Upload ─────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const ALLOWED_IMAGE_EXT  = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
const MAX_IMAGE_BYTES    = 10 * 1024 * 1024 // 10 MB

export async function uploadArticleImage(formData: FormData): Promise<{ url?: string; error?: string }> {
  try {
    const client = await getSupabaseServerClient()
    const file = formData.get('file') as File
    if (!file || file.size === 0) return { error: 'No file provided.' }

    if (file.size > MAX_IMAGE_BYTES) return { error: 'Image must be under 10 MB.' }

    const ext = (file.name.split('.').pop() ?? '').toLowerCase()
    if (!ALLOWED_IMAGE_EXT.has(ext))  return { error: 'Only JPEG, PNG, WebP, and GIF images are allowed.' }
    if (!ALLOWED_IMAGE_MIME.has(file.type)) return { error: `File type "${file.type}" is not allowed.` }

    const safePath = `articles/${crypto.randomUUID()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()

    const { error } = await client.storage
      .from('product-images')
      .upload(safePath, arrayBuffer, { contentType: file.type, upsert: false })

    if (error) {
      console.error('[uploadArticleImage] storage.upload failed:', error)
      return { error: `Storage upload failed: ${error.message}` }
    }

    const { data } = client.storage.from('product-images').getPublicUrl(safePath)
    return { url: data.publicUrl }
  } catch (e: any) {
    console.error('[uploadArticleImage] unexpected error:', e)
    return { error: `Image upload error: ${e?.message || 'unknown'}` }
  }
}

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
  imageUrl?: string,
): Promise<{ error?: string }> {
  try {
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
        .insert({ name: articleName, collection_id: collectionId, image_url: imageUrl ?? null })
        .select('id')
        .single()
      if (error) {
        console.error('[stockIn] article insert failed:', error)
        throw new Error(`Article insert failed: ${error.message}`)
      }
      article = data
    } else if (imageUrl) {
      const { error } = await client.from('articles').update({ image_url: imageUrl }).eq('id', article.id)
      if (error) {
        console.error('[stockIn] article image_url update failed:', error)
        throw new Error(`Article image update failed: ${error.message}`)
      }
    }

    for (const { size, quantity } of sizes) {
      if (!(SIZES as readonly string[]).includes(size))
        throw new Error(`Invalid size: ${size}`)
      if (quantity <= 0)
        throw new Error(`Quantity must be greater than 0 for size ${size}`)
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
        if (error) {
          console.error('[stockIn] sku insert failed:', error)
          throw new Error(`SKU insert failed (${size}): ${error.message}`)
        }
        skuId = newSku.id
      } else {
        const { error } = await client.rpc('stock_in_sku', {
          p_sku_id: existingSku.id,
          p_quantity: quantity,
          p_total_cost_per_unit: totalCostPerUnit,
          p_exchange_rate: exchangeRate,
        })
        if (error) {
          console.error('[stockIn] sku update failed:', error)
          throw new Error(`SKU update failed (${size}): ${error.message}`)
        }

        skuId = existingSku.id
      }

      const { error: purchaseError } = await client.from('purchases').insert({
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
      if (purchaseError) {
        console.error('[stockIn] purchase insert failed:', purchaseError)
        throw new Error(`Purchase record failed (${size}): ${purchaseError.message}`)
      }
    }

    await logAudit(client, 'stock_in', 'purchases', null,
      `Stocked in ${sizes.map(s => `${s.quantity}×${s.size}`).join(', ')} of "${articleName}"`,
      { collectionId, costPKR, exchangeRate, source })
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    console.error('[stockIn] caught error:', e)
    return { error: e?.message || 'Failed to add stock. Please try again.' }
  }
}

// ─── Record Sale ─────────────────────────────────────────────────────────────

export async function recordSale(
  skuId: string,
  quantity: number,
  sellingPriceUSD: number,
  channel: string,
  clientName: string,
  avgCostPKR: number,
  exchangeRate: number,
  paymentMethod: string,
): Promise<{ error?: string }> {
  if (!skuId)             return { error: 'SKU is required.' }
  if (quantity <= 0)      return { error: 'Quantity must be greater than 0.' }
  if (sellingPriceUSD <= 0) return { error: 'Selling price must be greater than 0.' }
  if (exchangeRate <= 0)  return { error: 'Exchange rate must be greater than 0.' }
  try {
    const client = await getSupabaseServerClient()
    const { data, error } = await client.rpc('record_sale_atomic', {
      p_sku_id: skuId,
      p_quantity: quantity,
      p_selling_price: sellingPriceUSD,
      p_cost_pkr: avgCostPKR,
      p_exchange_rate: exchangeRate,
      p_channel: channel || null,
      p_client_name: clientName || null,
      p_payment_method: paymentMethod || null,
    })
    if (error) return { error: `Network error: Sale not recorded. ${error.message}` }
    if (data?.error) return { error: data.error }
    await logAudit(client, 'sale_recorded', 'sales', data?.id ?? null,
      `Sold ${quantity}× SKU via ${channel || 'unknown'} at $${sellingPriceUSD}`,
      { skuId, quantity, sellingPriceUSD, channel, clientName, paymentMethod })
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Network error: Sale not recorded. Please try again.' }
  }
}

export async function recordMultiSale(
  items: { sku_id: string; quantity: number; selling_price: number; cost_pkr: number; exchange_rate: number }[],
  channel: string,
  clientName: string,
  paymentMethod: string,
): Promise<{ error?: string }> {
  if (!items || items.length === 0) return { error: 'At least one item is required.' }
  for (const item of items) {
    if (!item.sku_id)          return { error: 'Each item must have a SKU.' }
    if (item.quantity <= 0)    return { error: 'Each item quantity must be greater than 0.' }
    if (item.selling_price <= 0) return { error: 'Each item selling price must be greater than 0.' }
    if (item.exchange_rate <= 0) return { error: 'Each item exchange rate must be greater than 0.' }
  }
  try {
    const client = await getSupabaseServerClient()
    const { data, error } = await client.rpc('record_multi_sale', {
      p_items: items,
      p_channel: channel || null,
      p_client_name: clientName || null,
      p_payment_method: paymentMethod || null,
    })
    if (error) return { error: `Network error: Sale not recorded. ${error.message}` }
    if (data?.error) return { error: data.error }
    await logAudit(client, 'multi_sale_recorded', 'sales', null,
      `Multi-sale: ${items.length} item(s) via ${channel || 'unknown'}`,
      { itemCount: items.length, channel, clientName, paymentMethod })
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Network error: Sale not recorded. Please try again.' }
  }
}

// ─── Delete Sale ──────────────────────────────────────────────────────────────

export async function deleteSale(saleId: string): Promise<{ error?: string }> {
  try {
    const client = await getSupabaseServerClient()
    const { data, error } = await client.rpc('delete_sale_atomic', { p_sale_id: saleId })
    if (error) {
      console.error('[deleteSale] rpc failed:', error)
      throw error
    }
    if (data?.error) return { error: data.error }
    await logAudit(client, 'sale_deleted', 'sales', saleId, `Deleted sale ${saleId}`)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to delete sale. Please try again.' }
  }
}

// ─── Delete Purchase ──────────────────────────────────────────────────────────

export async function deletePurchase(purchaseId: string): Promise<{ error?: string }> {
  try {
    const client = await getSupabaseServerClient()
    const { data, error } = await client.rpc('delete_purchase_atomic', { p_purchase_id: purchaseId })
    if (error) {
      console.error('[deletePurchase] rpc failed:', error)
      throw error
    }
    if (data?.error) return { error: data.error }
    await logAudit(client, 'purchase_deleted', 'purchases', purchaseId, `Deleted purchase ${purchaseId}`)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to delete purchase. Please try again.' }
  }
}

// ─── Inventory edits ──────────────────────────────────────────────────────────

export async function updateSKUQuantity(skuId: string, quantity: number): Promise<{ error?: string }> {
  try {
    const client = await getSupabaseServerClient()
    const { error } = await client.from('skus').update({ quantity }).eq('id', skuId)
    if (error) throw error
    await logAudit(client, 'sku_quantity_updated', 'skus', skuId, `Set quantity to ${quantity} for SKU ${skuId}`)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to update quantity.' }
  }
}

export async function updateSku(
  skuId: string,
  updates: { quantity?: number; lowStockBuffer?: number; avgCostPKR?: number; size?: string },
): Promise<{ error?: string }> {
  try {
    const client = await getSupabaseServerClient()
    const { error } = await client.from('skus').update({
      ...(updates.size !== undefined            && { size:             updates.size }),
      ...(updates.quantity !== undefined        && { quantity:         updates.quantity }),
      ...(updates.lowStockBuffer !== undefined  && { low_stock_buffer: updates.lowStockBuffer }),
      ...(updates.avgCostPKR !== undefined      && { avg_cost_pkr:     updates.avgCostPKR }),
    }).eq('id', skuId)
    if (error) {
      console.error('[updateSku] failed:', error)
      throw new Error(error.message)
    }
    await logAudit(client, 'sku_updated', 'skus', skuId, `Updated SKU ${skuId}`, updates as Record<string, unknown>)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to update SKU.' }
  }
}

export async function deleteSku(skuId: string): Promise<{ error?: string }> {
  try {
    const client = await getSupabaseServerClient()
    const { error } = await client.from('skus').delete().eq('id', skuId)
    if (error) {
      console.error('[deleteSku] failed:', error)
      throw new Error(error.message)
    }
    await logAudit(client, 'sku_deleted', 'skus', skuId, `Deleted SKU ${skuId}`)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to delete size variant.' }
  }
}

export async function addSku(
  articleId: string,
  size: string,
  quantity: number,
  lowStockBuffer: number,
  avgCostPKR: number,
  avgExchangeRate: number,
): Promise<{ error?: string }> {
  if (!(SIZES as readonly string[]).includes(size)) return { error: `Invalid size: ${size}` }
  if (quantity < 0)       return { error: 'Quantity cannot be negative.' }
  if (lowStockBuffer < 0) return { error: 'Buffer cannot be negative.' }

  try {
    const client = await getSupabaseServerClient()
    const { error } = await client.from('skus').insert({
      article_id: articleId,
      size,
      quantity,
      low_stock_buffer: lowStockBuffer,
      avg_cost_pkr: avgCostPKR,
      avg_exchange_rate: avgExchangeRate,
    })
    if (error) {
      console.error('[addSku] failed:', error)
      throw new Error(error.message)
    }
    await logAudit(client, 'sku_added', 'skus', null,
      `Added size ${size} (qty ${quantity}) to article ${articleId}`)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to add size variant.' }
  }
}

export async function deleteArticleImage(
  articleId: string,
  storageUrl: string,
): Promise<{ error?: string }> {
  try {
    const client = await getSupabaseServerClient()

    // Extract path safely — only delete from the product-images bucket, articles/ prefix
    const BUCKET_MARKER = '/product-images/'
    const markerIndex = storageUrl.indexOf(BUCKET_MARKER)
    if (markerIndex !== -1) {
      const storagePath = storageUrl.slice(markerIndex + BUCKET_MARKER.length)
      if (storagePath.startsWith('articles/')) {
        const { error: storageError } = await client.storage
          .from('product-images')
          .remove([storagePath])
        if (storageError) console.error('[deleteArticleImage] storage.remove failed:', storageError)
      }
    }

    const { error } = await client.from('articles').update({ image_url: null }).eq('id', articleId)
    if (error) {
      console.error('[deleteArticleImage] db update failed:', error)
      throw new Error(error.message)
    }
    await logAudit(client, 'article_image_deleted', 'articles', articleId, `Removed image from article ${articleId}`)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to delete image.' }
  }
}

export async function updateArticle(
  articleId: string,
  updates: { name?: string; collection_id?: string; image_url?: string | null },
): Promise<{ error?: string }> {
  try {
    const client = await getSupabaseServerClient()
    const { error } = await client.from('articles').update(updates).eq('id', articleId)
    if (error) throw error
    await logAudit(client, 'article_updated', 'articles', articleId, `Updated article ${articleId}`, updates as Record<string, unknown>)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to update article.' }
  }
}

export async function deleteArticle(articleId: string): Promise<{ error?: string }> {
  try {
    const client = await getSupabaseServerClient()
    // Deletes by the article's UUID primary key — cascade removes its SKUs, purchases, and sales
    const { error } = await client.from('articles').delete().eq('id', articleId)
    if (error) throw error
    await logAudit(client, 'article_deleted', 'articles', articleId, `Deleted article ${articleId} and all its SKUs, purchases, and sales`)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to delete article.' }
  }
}

// ─── Brands & Collections ─────────────────────────────────────────────────────

export async function addBrand(name: string): Promise<{ error?: string }> {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Brand name cannot be empty.' }
  if (trimmed.length > 100) return { error: 'Brand name must be 100 characters or fewer.' }
  try {
    const client = await getSupabaseServerClient()
    const { error } = await client.from('brands').insert({ name: trimmed })
    if (error) throw error
    await logAudit(client, 'brand_added', 'brands', null, `Added brand "${trimmed}"`)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to add brand.' }
  }
}

export async function deleteBrand(brandId: string): Promise<{ error?: string }> {
  try {
    const client = await getSupabaseServerClient()
    const { error } = await client.from('brands').delete().eq('id', brandId)
    if (error) throw error
    await logAudit(client, 'brand_deleted', 'brands', brandId, `Deleted brand ${brandId}`)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to delete brand.' }
  }
}

export async function addCollection(name: string, brandId: string): Promise<{ error?: string }> {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Collection name cannot be empty.' }
  if (trimmed.length > 100) return { error: 'Collection name must be 100 characters or fewer.' }
  if (!brandId) return { error: 'Brand is required.' }
  try {
    const client = await getSupabaseServerClient()
    const { error } = await client.from('collections').insert({ name: trimmed, brand_id: brandId })
    if (error) throw error
    await logAudit(client, 'collection_added', 'collections', null, `Added collection "${trimmed}" to brand ${brandId}`)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to add collection.' }
  }
}

export async function deleteCollection(collectionId: string): Promise<{ error?: string }> {
  try {
    const client = await getSupabaseServerClient()
    const { error } = await client.from('collections').delete().eq('id', collectionId)
    if (error) throw error
    await logAudit(client, 'collection_deleted', 'collections', collectionId, `Deleted collection ${collectionId}`)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to delete collection.' }
  }
}

export async function clearAllData(confirmation: string): Promise<{ error?: string }> {
  if (confirmation !== 'DELETE') return { error: 'Confirmation text does not match.' }
  try {
    const client = await getSupabaseServerClient()
    await client.from('sales').delete().not('id', 'is', null)
    await client.from('purchases').delete().not('id', 'is', null)
    await client.from('skus').delete().not('id', 'is', null)
    await client.from('articles').delete().not('id', 'is', null)
    await logAudit(client, 'all_data_cleared', '*', null, 'CLEARED ALL inventory data (articles, SKUs, purchases, sales)')
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to clear data.' }
  }
}

// ─── Paid to Wajid ────────────────────────────────────────────────────────────

export async function updateSkuPaidStatus(skuId: string, paidToWajid: boolean): Promise<{ error?: string }> {
  try {
    const client = await getSupabaseServerClient()
    const { error } = await client
      .from('purchases')
      .update({ paid_to_wajid: paidToWajid })
      .eq('sku_id', skuId)
    if (error) {
      console.error('[updateSkuPaidStatus] update failed:', error)
      throw error
    }
    await logAudit(client, 'paid_status_updated', 'purchases', skuId,
      `Marked SKU ${skuId} as ${paidToWajid ? 'paid' : 'unpaid'} to Wajid`)
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to update paid status.' }
  }
}

// ─── Emergency Full Backup Export ────────────────────────────────────────────

export async function exportAllData() {
  const client = await getSupabaseServerClient()

  const [{ data: articles }, { data: purchases }, { data: sales }] = await Promise.all([
    client
      .from('articles')
      .select('name, collections(name, brands(name)), skus(size, quantity, avg_cost_pkr, avg_exchange_rate)')
      .order('name'),
    client
      .from('purchases')
      .select('created_at, quantity, cost_pkr, commission_pkr, shipping_pkr, exchange_rate, source, notes, paid_to_wajid, skus(size, articles(name, collections(name, brands(name))))')
      .order('created_at', { ascending: false }),
    client
      .from('sales')
      .select('created_at, quantity, selling_price, cost_pkr_at_sale, exchange_rate_at_sale, channel, client_name, payment_method, skus(size, articles(name, collections(brands(name))))')
      .order('created_at', { ascending: false }),
  ])

  return {
    articles: (articles ?? []) as any[],
    purchases: (purchases ?? []) as any[],
    sales: (sales ?? []) as any[],
  }
}

// ─── Overheads ───────────────────────────────────────────────────────────────

export async function recordCost(
  category: string,
  amount: number,
  expenseDate: string,
  notes: string,
  paymentMethod: string,
): Promise<{ error?: string }> {
  try {
    if (!OVERHEAD_CATEGORIES.includes(category as any)) return { error: 'Invalid category.' }
    if (!amount || amount <= 0) return { error: 'Amount must be greater than 0.' }
    if (!expenseDate || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) return { error: 'Invalid date.' }
    const client = await getSupabaseServerClient()
    const { error } = await client.from('overheads').insert({
      category,
      amount,
      expense_date: expenseDate,
      notes: notes.trim() || null,
      payment_method: paymentMethod || 'Cash',
    })
    if (error) {
      console.error('[recordCost] insert failed:', error)
      throw error
    }
    await logAudit(client, 'cost_recorded', 'overheads', null,
      `Recorded ${category} cost of $${amount} on ${expenseDate} via ${paymentMethod || 'Cash'}`,
      { category, amount, expenseDate, paymentMethod })
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to record cost.' }
  }
}

export async function deleteOverhead(id: string): Promise<{ error?: string }> {
  try {
    if (!id) return { error: 'ID is required.' }
    const client = await getSupabaseServerClient()
    const { error } = await client.from('overheads').delete().eq('id', id)
    if (error) {
      console.error('[deleteOverhead] delete failed:', error)
      throw error
    }
    await logAudit(client, 'cost_deleted', 'overheads', id, `Deleted overhead entry ${id}`)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to delete cost.' }
  }
}

export async function updateOverhead(
  id: string,
  updates: { category?: string; amount?: number; expenseDate?: string; notes?: string; paymentMethod?: string },
): Promise<{ error?: string }> {
  try {
    if (!id) return { error: 'ID is required.' }
    if (updates.category !== undefined && !OVERHEAD_CATEGORIES.includes(updates.category as any))
      return { error: 'Invalid category.' }
    if (updates.amount !== undefined && updates.amount <= 0)
      return { error: 'Amount must be greater than 0.' }
    if (updates.expenseDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(updates.expenseDate))
      return { error: 'Invalid date.' }
    const patch: { category?: string; amount?: number; expense_date?: string; notes?: string | null; payment_method?: string } = {}
    if (updates.category !== undefined)       patch.category       = updates.category
    if (updates.amount !== undefined)         patch.amount         = updates.amount
    if (updates.expenseDate !== undefined)    patch.expense_date   = updates.expenseDate
    if (updates.notes !== undefined)          patch.notes          = updates.notes.trim() || null
    if (updates.paymentMethod !== undefined)  patch.payment_method = updates.paymentMethod
    if (Object.keys(patch).length === 0)    return {}
    const client = await getSupabaseServerClient()
    const { error } = await client.from('overheads').update(patch).eq('id', id)
    if (error) {
      console.error('[updateOverhead] update failed:', error)
      throw error
    }
    await logAudit(client, 'cost_updated', 'overheads', id, `Updated overhead entry ${id}`, patch as Record<string, unknown>)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to update cost.' }
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function updateSetting(key: string, value: string): Promise<{ error?: string }> {
  try {
    const client = await getSupabaseServerClient()
    const { error } = await client
      .from('settings')
      .upsert({ key, value }, { onConflict: 'tenant_id,key' })
    if (error) throw error
    await logAudit(client, 'setting_updated', 'settings', null, `Updated setting "${key}" = "${value}"`)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to update setting.' }
  }
}
