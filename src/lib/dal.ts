import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { DEFAULT_PKR_TO_USD } from '@/lib/format'
import type {
  SkuForStats,
  SaleRow,
  PurchaseRow,
  ArticleInventory,
  BrandWithCollections,
} from '@/lib/types'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function getSession() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('sb-access-token')?.value
  return accessToken ? { accessToken } : null
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getExchangeRate(): Promise<number> {
  try {
    const client = await getSupabaseServerClient()
    const { data } = await client
      .from('settings')
      .select('value')
      .eq('key', 'usd_rate')
      .maybeSingle()
    return Number(data?.value) || DEFAULT_PKR_TO_USD
  } catch {
    return DEFAULT_PKR_TO_USD
  }
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function getInventory(): Promise<ArticleInventory[]> {
  try {
    const client = await getSupabaseServerClient()
    const { data } = await client
      .from('articles')
      .select(`
        id, name, image_url,
        collections( id, name, brands(id, name) ),
        skus( id, size, quantity, low_stock_buffer, avg_cost_pkr, avg_exchange_rate, purchases(paid_to_wajid) )
      `)
      .order('name')

    if (!data) return []

    return (data as any[]).map((a) => ({
      articleId: a.id,
      articleName: a.name,
      brandId: a.collections?.brands?.id ?? '',
      brandName: a.collections?.brands?.name ?? '',
      collectionId: a.collections?.id ?? '',
      collectionName: a.collections?.name ?? '',
      totalQuantity: (a.skus ?? []).reduce((s: number, x: any) => s + (x.quantity ?? 0), 0),
      imageUrl: a.image_url ?? null,
      skus: (a.skus ?? []).map((s: any) => ({
        skuId: s.id,
        size: s.size,
        quantity: s.quantity,
        lowStockBuffer: s.low_stock_buffer,
        avgCostPKR: s.avg_cost_pkr,
        avgExchangeRate: s.avg_exchange_rate,
        paidToWajid: !(s.purchases ?? []).some((p: any) => p.paid_to_wajid === false),
      })),
    }))
  } catch {
    return []
  }
}

export async function getSkuStats(): Promise<SkuForStats[]> {
  try {
    const client = await getSupabaseServerClient()
    const { data } = await client.from('skus').select('id, quantity, low_stock_buffer, avg_cost_pkr')
    if (!data) return []
    return (data as any[]).map((s) => ({
      id: s.id,
      quantity: s.quantity,
      lowStockBuffer: s.low_stock_buffer,
      avgCostPKR: s.avg_cost_pkr ?? 0,
    }))
  } catch {
    return []
  }
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export async function getSales(): Promise<SaleRow[]> {
  try {
    const client = await getSupabaseServerClient()
    const { data } = await client
      .from('sales')
      .select(`
        id, created_at, quantity, selling_price, cost_pkr_at_sale,
        exchange_rate_at_sale, channel, client_name, payment_method,
        skus( size, articles( id, name, collections( brands(name) ) ) )
      `)
      .order('created_at', { ascending: false })

    if (!data) return []

    return (data as any[]).map((s) => ({
      id: s.id,
      createdAt: s.created_at,
      quantity: s.quantity,
      sellingPrice: s.selling_price,
      costPKRAtSale: s.cost_pkr_at_sale,
      exchangeRateAtSale: s.exchange_rate_at_sale,
      channel: s.channel,
      clientName: s.client_name,
      paymentMethod: s.payment_method,
      size: s.skus?.size ?? '',
      articleId: s.skus?.articles?.id ?? '',
      articleName: s.skus?.articles?.name ?? '',
      brandName: s.skus?.articles?.collections?.brands?.name ?? '',
    }))
  } catch {
    return []
  }
}

// ─── Purchases ────────────────────────────────────────────────────────────────

export async function getPurchases(): Promise<PurchaseRow[]> {
  try {
    const client = await getSupabaseServerClient()
    const { data } = await client
      .from('purchases')
      .select(`
        id, created_at, quantity, cost_pkr, commission_pkr, shipping_pkr,
        exchange_rate, source, notes, paid_to_wajid,
        skus( size, articles( name, collections( name, brands(name) ) ) )
      `)
      .order('created_at', { ascending: false })

    if (!data) return []

    return (data as any[]).map((p) => ({
      id: p.id,
      createdAt: p.created_at,
      quantity: p.quantity,
      costPKR: p.cost_pkr,
      commissionPKR: p.commission_pkr,
      shippingPKR: p.shipping_pkr,
      exchangeRate: p.exchange_rate,
      source: p.source,
      notes: p.notes,
      paidToWajid: p.paid_to_wajid ?? false,
      size: p.skus?.size ?? '',
      articleName: p.skus?.articles?.name ?? '',
      brandName: p.skus?.articles?.collections?.brands?.name ?? '',
      collectionName: p.skus?.articles?.collections?.name ?? '',
    }))
  } catch {
    return []
  }
}

// ─── Brands ───────────────────────────────────────────────────────────────────

export async function getBrands(): Promise<BrandWithCollections[]> {
  try {
    const client = await getSupabaseServerClient()
    const { data } = await client
      .from('brands')
      .select('id, name, collections(id, name)')
      .order('name')

    if (!data) return []

    return (data as any[]).map((b) => ({
      id: b.id,
      name: b.name,
      collections: (b.collections ?? []).map((c: any) => ({ id: c.id, name: c.name })),
    }))
  } catch {
    return []
  }
}
