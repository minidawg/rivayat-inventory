// ─── Supabase Database type (mirrors 0001_initial_schema.sql) ────────────────

export type Database = {
  public: {
    Tables: {
      brands: {
        Row:    { id: string; name: string; tenant_id: string }
        Insert: { id?: string; name: string; tenant_id: string }
        Update: { id?: string; name?: string; tenant_id?: string }
        Relationships: []
      }
      collections: {
        Row:    { id: string; name: string; brand_id: string }
        Insert: { id?: string; name: string; brand_id: string }
        Update: { id?: string; name?: string; brand_id?: string }
        Relationships: [{ foreignKeyName: 'collections_brand_id_fkey'; columns: ['brand_id']; referencedRelation: 'brands'; referencedColumns: ['id'] }]
      }
      articles: {
        Row:    { id: string; name: string; collection_id: string; image_url: string | null }
        Insert: { id?: string; name: string; collection_id: string; image_url?: string | null }
        Update: { id?: string; name?: string; collection_id?: string; image_url?: string | null }
        Relationships: [{ foreignKeyName: 'articles_collection_id_fkey'; columns: ['collection_id']; referencedRelation: 'collections'; referencedColumns: ['id'] }]
      }
      skus: {
        Row:    { id: string; article_id: string; size: string; quantity: number; low_stock_buffer: number; avg_cost_pkr: number; avg_exchange_rate: number }
        Insert: { id?: string; article_id: string; size: string; quantity?: number; low_stock_buffer?: number; avg_cost_pkr?: number; avg_exchange_rate?: number }
        Update: { id?: string; article_id?: string; size?: string; quantity?: number; low_stock_buffer?: number; avg_cost_pkr?: number; avg_exchange_rate?: number }
        Relationships: [{ foreignKeyName: 'skus_article_id_fkey'; columns: ['article_id']; referencedRelation: 'articles'; referencedColumns: ['id'] }]
      }
      purchases: {
        Row:    { id: string; created_at: string; sku_id: string; quantity: number; cost_pkr: number; commission_pkr: number; shipping_pkr: number; exchange_rate: number; source: string | null; notes: string | null; paid_to_wajid: boolean }
        Insert: { id?: string; created_at?: string; sku_id: string; quantity: number; cost_pkr: number; commission_pkr?: number; shipping_pkr?: number; exchange_rate: number; source?: string | null; notes?: string | null; paid_to_wajid?: boolean }
        Update: { id?: string; created_at?: string; sku_id?: string; quantity?: number; cost_pkr?: number; commission_pkr?: number; shipping_pkr?: number; exchange_rate?: number; source?: string | null; notes?: string | null; paid_to_wajid?: boolean }
        Relationships: [{ foreignKeyName: 'purchases_sku_id_fkey'; columns: ['sku_id']; referencedRelation: 'skus'; referencedColumns: ['id'] }]
      }
      sales: {
        Row:    { id: string; created_at: string; sku_id: string; quantity: number; selling_price: number; cost_pkr_at_sale: number | null; exchange_rate_at_sale: number | null; channel: string | null; client_name: string | null; payment_method: string | null }
        Insert: { id?: string; created_at?: string; sku_id: string; quantity: number; selling_price: number; cost_pkr_at_sale?: number | null; exchange_rate_at_sale?: number | null; channel?: string | null; client_name?: string | null; payment_method?: string | null }
        Update: { id?: string; created_at?: string; sku_id?: string; quantity?: number; selling_price?: number; cost_pkr_at_sale?: number | null; exchange_rate_at_sale?: number | null; channel?: string | null; client_name?: string | null; payment_method?: string | null }
        Relationships: [{ foreignKeyName: 'sales_sku_id_fkey'; columns: ['sku_id']; referencedRelation: 'skus'; referencedColumns: ['id'] }]
      }
      settings: {
        Row:    { key: string; value: string; tenant_id: string }
        Insert: { key: string; value: string; tenant_id: string }
        Update: { key?: string; value?: string; tenant_id?: string }
        Relationships: []
      }
      overheads: {
        Row:    { id: string; created_at: string; category: string; amount: number; expense_date: string; notes: string | null; tenant_id: string }
        Insert: { id?: string; created_at?: string; category: string; amount: number; expense_date?: string; notes?: string | null; tenant_id: string }
        Update: { id?: string; created_at?: string; category?: string; amount?: number; expense_date?: string; notes?: string | null; tenant_id?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      record_sale_atomic: {
        Args: { p_sku_id: string; p_quantity: number; p_selling_price: number; p_cost_pkr: number; p_exchange_rate: number; p_channel?: string | null; p_client_name?: string | null; p_payment_method?: string | null }
        Returns: { id?: string; remaining?: number; error?: string }
      }
      record_multi_sale: {
        Args: { p_items: string; p_channel?: string | null; p_client_name?: string | null; p_payment_method?: string | null }
        Returns: { success?: boolean; error?: string }
      }
      delete_sale_atomic: {
        Args: { p_sale_id: string }
        Returns: { success?: boolean; error?: string }
      }
      delete_purchase_atomic: {
        Args: { p_purchase_id: string }
        Returns: { success?: boolean; error?: string }
      }
      stock_in_sku: {
        Args: { p_sku_id: string; p_quantity: number; p_total_cost_per_unit: number; p_exchange_rate: number }
        Returns: undefined
      }
      set_tenant_id: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const SIZES = [
  'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
  '34', '36', '38', '40', '42', '44', '46',
] as const
export type Size = typeof SIZES[number]

export const SOURCES = ['prebook', 'released'] as const
export type Source = typeof SOURCES[number]

export const CHANNELS = ['WhatsApp', 'Instagram', 'Exhibition'] as const
export type Channel = typeof CHANNELS[number]

export const PAYMENT_METHODS = ['Zelle', 'Cash'] as const
export type PaymentMethod = typeof PAYMENT_METHODS[number]

export const OVERHEAD_CATEGORIES = [
  'Exhibition Rent',
  'Deliveries (Pak to US)',
  'Supplies',
  'Miscellaneous',
] as const
export type OverheadCategory = typeof OVERHEAD_CATEGORIES[number]

// ─── View types (returned by DAL, camelCase) ─────────────────────────────────

export interface SkuForStats {
  id: string
  quantity: number
  lowStockBuffer: number
  avgCostPKR: number
}

export interface SaleRow {
  id: string
  createdAt: string
  quantity: number
  /** Selling price in USD — primary currency */
  sellingPrice: number
  /** Cost basis in PKR at time of sale */
  costPKRAtSale: number | null
  /** PKR/USD exchange rate locked at time of sale */
  exchangeRateAtSale: number | null
  channel: string | null
  clientName: string | null
  paymentMethod: string | null
  size: string
  articleId: string
  articleName: string
  brandName: string
}

/** Alias kept for import compatibility. */
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
  paidToWajid: boolean
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
  collectionId: string
  collectionName: string
  totalQuantity: number
  imageUrl: string | null
  skus: {
    skuId: string
    size: string
    quantity: number
    lowStockBuffer: number
    avgCostPKR: number
    avgExchangeRate: number
    /** false if any purchase for this SKU has paid_to_wajid = false */
    paidToWajid: boolean
  }[]
}

export interface OverheadRow {
  id: string
  createdAt: string
  category: OverheadCategory
  amount: number
  expenseDate: string
  notes: string | null
}

export interface BrandWithCollections {
  id: string
  name: string
  collections: { id: string; name: string }[]
}
