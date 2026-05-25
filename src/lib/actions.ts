'use server'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
        const newQty = existingSku.quantity + quantity
        const newAvgCost =
          (existingSku.avg_cost_pkr * existingSku.quantity + totalCostPerUnit * quantity) / newQty
        const newAvgRate =
          (existingSku.avg_exchange_rate * existingSku.quantity + exchangeRate * quantity) / newQty

        const { error } = await client
          .from('skus')
          .update({ quantity: newQty, avg_cost_pkr: newAvgCost, avg_exchange_rate: newAvgRate })
          .eq('id', existingSku.id)
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

    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    console.error('[stockIn] caught error:', e)
    return { error: e?.message || 'Failed to add stock. Please try again.' }
  }
}

// ─── Record Sale ─────────────────────────────────────────────────────────────
// FIX: Insert into sales FIRST (atomic safety). Only decrement inventory after
// the sale record is successfully committed. If the sales insert fails, inventory
// is never touched and no data is lost.

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
  try {
    const client = await getSupabaseServerClient()

    // Verify the exact SKU row by its UUID (not by name or product SKU)
    const { data: sku, error: skuError } = await client
      .from('skus')
      .select('quantity')
      .eq('id', skuId)
      .single()

    if (skuError || !sku) return { error: 'SKU not found. Please refresh and try again.' }
    if (sku.quantity < quantity) {
      return { error: `Insufficient stock. Available: ${sku.quantity}, requested: ${quantity}.` }
    }

    // STEP 1: Insert the sale record first. If this fails, abort entirely.
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
    if (saleError) {
      return { error: `Network error: Sale not recorded. ${saleError.message}` }
    }

    // STEP 2: Only decrement inventory after the sale is confirmed committed.
    const { error: updateError } = await client
      .from('skus')
      .update({ quantity: sku.quantity - quantity })
      .eq('id', skuId)
    if (updateError) {
      return {
        error: `Sale recorded but inventory count not updated: ${updateError.message}. Please adjust manually in Inventory.`,
      }
    }

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
        const { error } = await client
          .from('skus')
          .update({ quantity: sku.quantity + sale.quantity })
          .eq('id', sale.sku_id)
        if (error) throw error
      }
    }

    // Delete targets the exact row by its UUID primary key
    const { error } = await client.from('sales').delete().eq('id', saleId)
    if (error) throw error

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

    const { data: purchase } = await client
      .from('purchases')
      .select('sku_id, quantity')
      .eq('id', purchaseId)
      .maybeSingle()

    if (purchase) {
      const { data: sku } = await client
        .from('skus')
        .select('quantity')
        .eq('id', purchase.sku_id)
        .maybeSingle()
      if (sku) {
        const { error } = await client
          .from('skus')
          .update({ quantity: Math.max(0, sku.quantity - purchase.quantity) })
          .eq('id', purchase.sku_id)
        if (error) throw error
      }
    }

    // Delete targets the exact row by its UUID primary key — never by sku_id or name
    const { error } = await client.from('purchases').delete().eq('id', purchaseId)
    if (error) throw error

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
  const VALID_SIZES = ['XS','S','M','L','XL','XXL','XXXL','34','36','38','40','42','44','46']
  if (!VALID_SIZES.includes(size)) return { error: `Invalid size: ${size}` }
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
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to delete article.' }
  }
}

// ─── Brands & Collections ─────────────────────────────────────────────────────

export async function addBrand(name: string): Promise<{ error?: string }> {
  try {
    const client = await getSupabaseServerClient()
    const { error } = await client.from('brands').insert({ name })
    if (error) throw error
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
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to delete brand.' }
  }
}

export async function addCollection(name: string, brandId: string): Promise<{ error?: string }> {
  try {
    const client = await getSupabaseServerClient()
    const { error } = await client.from('collections').insert({ name, brand_id: brandId })
    if (error) throw error
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
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to delete collection.' }
  }
}

export async function clearAllData(): Promise<{ error?: string }> {
  try {
    const client = await getSupabaseServerClient()
    await client.from('sales').delete().not('id', 'is', null)
    await client.from('purchases').delete().not('id', 'is', null)
    await client.from('skus').delete().not('id', 'is', null)
    await client.from('articles').delete().not('id', 'is', null)
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to clear data.' }
  }
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
): Promise<{ error?: string }> {
  try {
    if (!category) return { error: 'Category is required.' }
    if (!amount || amount <= 0) return { error: 'Amount must be greater than 0.' }
    if (!expenseDate) return { error: 'Date is required.' }
    const client = await getSupabaseServerClient()
    const { error } = await client.from('overheads').insert({
      category,
      amount,
      expense_date: expenseDate,
      notes: notes.trim() || null,
    })
    if (error) throw error
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to record cost.' }
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function updateSetting(key: string, value: string): Promise<{ error?: string }> {
  try {
    const client = await getSupabaseServerClient()
    const { error } = await client
      .from('settings')
      .upsert({ key, value }, { onConflict: 'key' })
    if (error) throw error
    revalidatePath('/', 'layout')
    return {}
  } catch (e: any) {
    return { error: e?.message || 'Failed to update setting.' }
  }
}
