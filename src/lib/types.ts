// ─── Constants ───────────────────────────────────────────────────────────────

export const SIZES = [
  'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
  '34', '36', '38', '40', '42', '44', '46',
] as const
export type Size = typeof SIZES[number]

export const SOURCES = ['prebook', 'released'] as const
export type Source = typeof SOURCES[number]

export const CHANNELS = ['Instagram', 'Walk-in', 'WhatsApp', 'Facebook', 'Website', 'TikTok'] as const
export type Channel = typeof CHANNELS[number]

// ─── View types (returned by DAL, camelCase) ─────────────────────────────────

export interface SkuForStats {
  id: string
  quantity: number
  lowStockBuffer: number
}

export interface SaleRow {
  id: string
  createdAt: string
  quantity: number
  sellingPrice: number
  costPKRAtSale: number | null
  exchangeRateAtSale: number | null
  channel: string | null
  clientName: string | null
  size: string
  articleId: string
  articleName: string
  brandName: string
}

/** Alias kept so dashboard panel import compiles without change. */
export type SaleWithDetails = SaleRow

export interface PurchaseRow {
  id: string
  createdAt: string
  quantity: number
  costPKR: number
  commissionPKR: number
  shippingPKR: number
  exchangeRate: number
  source: string | null
  notes: string | null
  size: string
  articleName: string
  brandName: string
  collectionName: string
}

export interface ArticleInventory {
  articleId: string
  articleName: string
  brandId: string
  brandName: string
  collectionName: string
  totalQuantity: number
  skus: {
    skuId: string
    size: string
    quantity: number
    lowStockBuffer: number
    avgCostPKR: number
    avgExchangeRate: number
  }[]
}

export interface BrandWithCollections {
  id: string
  name: string
  collections: { id: string; name: string }[]
}
