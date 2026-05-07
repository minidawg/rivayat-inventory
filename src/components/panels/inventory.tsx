'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPKR, formatUSD, suggestedSellPrice } from '@/lib/data'
import { updateSKUQuantity } from '@/lib/actions'
import { SIZES } from '@/lib/types'
import type { ArticleInventory, BrandWithCollections } from '@/lib/types'
import { Download, Edit, ChevronDown, ChevronUp, Package, Search, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InventoryProps {
  inventory: ArticleInventory[]
  brands: BrandWithCollections[]
  exchangeRate: number
  onSuccess?: () => void
}

export function Inventory({ inventory, brands, exchangeRate, onSuccess }: InventoryProps) {
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'low'>('all')
  const [brandFilter, setBrandFilter] = useState('all')
  const [sizeFilter, setSizeFilter] = useState('all')
  const [showOutOfStock, setShowOutOfStock] = useState(true)
  const [editingArticle, setEditingArticle] = useState<string | null>(null)

  // Filter inventory
  const { inStock, outOfStock } = useMemo(() => {
    let filtered = inventory

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(item =>
        item.articleName.toLowerCase().includes(term) ||
        item.brandName.toLowerCase().includes(term) ||
        item.collectionName.toLowerCase().includes(term)
      )
    }

    if (brandFilter !== 'all') {
      filtered = filtered.filter(item => item.brandId === brandFilter)
    }

    if (sizeFilter !== 'all') {
      filtered = filtered.filter(item =>
        item.skus.some(s => s.size === sizeFilter && s.quantity > 0)
      )
    }

    const inStock = filtered.filter(item => item.totalQuantity > 0)
    const outOfStock = filtered.filter(item => item.totalQuantity === 0)

    if (statusFilter === 'low') {
      return {
        inStock: inStock.filter(item =>
          item.skus.some(s => s.quantity > 0 && s.quantity <= s.lowStockBuffer)
        ),
        outOfStock: [],
      }
    }

    return { inStock, outOfStock }
  }, [inventory, searchTerm, statusFilter, brandFilter, sizeFilter])

  const availableSizes = useMemo(() => {
    const sizes = new Set<string>()
    inventory.forEach(item => {
      item.skus.forEach(s => {
        if (s.quantity > 0) sizes.add(s.size)
      })
    })
    return Array.from(sizes).sort((a, b) => {
      const aIdx = SIZES.indexOf(a as any)
      const bIdx = SIZES.indexOf(b as any)
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b)
      if (aIdx === -1) return 1
      if (bIdx === -1) return -1
      return aIdx - bIdx
    })
  }, [inventory])

  const exportCSV = () => {
    const rows: string[][] = [
      ['Brand', 'Collection', 'Article', 'Size', 'Qty', 'Cost (PKR)', 'Cost (USD)', 'Sell (PKR)', 'Sell (USD)']
    ]

    for (const item of inStock) {
      for (const sku of item.skus.filter(s => s.quantity > 0)) {
        const sellPrice = suggestedSellPrice(sku.avgCostPKR, 0, 0)
        rows.push([
          item.brandName,
          item.collectionName,
          item.articleName,
          sku.size,
          String(sku.quantity),
          String(Math.round(sku.avgCostPKR)),
          String((sku.avgCostPKR / exchangeRate).toFixed(2)),
          String(sellPrice),
          String((sellPrice / exchangeRate).toFixed(2)),
        ])
      }
    }

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rivayat-inventory-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getStatusClass = (qty: number, buffer: number) => {
    if (qty === 0) return 'bg-destructive/20 text-destructive border-destructive/30'
    if (qty <= buffer) return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    return 'bg-success/20 text-success border-success/30'
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight mb-1">
            Inventory
          </h2>
          <p className="text-sm text-muted-foreground">
            {inStock.length} articles in stock
          </p>
        </div>
        <Button
          onClick={exportCSV}
          className="gap-2 bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/20 text-primary hover:from-primary/30 hover:to-primary/20"
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span className="uppercase tracking-wider font-medium">Filters</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search articles..."
              className="pl-9 h-10 bg-white/[0.03] border-white/10 focus:border-primary/40 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'low')}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm focus:border-primary/40 focus:outline-none"
          >
            <option value="all">All In Stock</option>
            <option value="low">Low Stock Only</option>
          </select>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm focus:border-primary/40 focus:outline-none"
          >
            <option value="all">All Brands</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={sizeFilter}
            onChange={(e) => setSizeFilter(e.target.value)}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm focus:border-primary/40 focus:outline-none"
          >
            <option value="all">All Sizes</option>
            {availableSizes.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* In Stock Items */}
      {inStock.length === 0 ? (
        <div className="py-20 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No items found</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
          {inStock.map(item => (
            <div 
              key={item.articleId} 
              className="glass rounded-2xl p-5 premium-card group"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">
                    {item.brandName}
                  </div>
                  <div className="text-base font-semibold group-hover:text-primary transition-colors">
                    {item.articleName}
                  </div>
                  <div className="text-xs text-muted-foreground">{item.collectionName}</div>
                </div>
                <button
                  onClick={() => setEditingArticle(editingArticle === item.articleId ? null : item.articleId)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl border transition-all",
                    editingArticle === item.articleId 
                      ? "bg-primary/20 border-primary/30 text-primary" 
                      : "bg-white/[0.03] border-white/10 text-muted-foreground hover:bg-primary/10 hover:border-primary/20 hover:text-primary"
                  )}
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>

              {/* Sizes */}
              <div className="mb-4 flex flex-wrap gap-1.5">
                {item.skus
                  .filter(s => s.quantity > 0)
                  .map(s => (
                    <span
                      key={s.skuId}
                      className={cn(
                        "inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium",
                        getStatusClass(s.quantity, s.lowStockBuffer)
                      )}
                    >
                      {s.size}: {s.quantity}
                    </span>
                  ))}
              </div>

              {/* Footer */}
              <div className="flex items-end justify-between border-t border-white/5 pt-4">
                <div className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{item.totalQuantity}</span> items
                </div>
                <div className="text-right">
                  {item.skus[0]?.avgCostPKR > 0 && (
                    <>
                      <div className="text-xs text-muted-foreground">
                        Cost: {formatUSD(item.skus[0].avgCostPKR / exchangeRate)}
                      </div>
                      <div className="text-sm font-bold text-primary">
                        Sell: {formatUSD(suggestedSellPrice(item.skus[0].avgCostPKR, 0, 0) / exchangeRate)}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Edit Panel */}
              {editingArticle === item.articleId && (
                <EditPanel
                  article={item}
                  exchangeRate={exchangeRate}
                  onClose={() => setEditingArticle(null)}
                  onSuccess={onSuccess}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Out of Stock Section */}
      {outOfStock.length > 0 && statusFilter === 'all' && (
        <div className="mt-8 border-t border-white/5 pt-6">
          <button
            onClick={() => setShowOutOfStock(!showOutOfStock)}
            className="mb-4 flex items-center gap-2 text-sm font-semibold text-destructive hover:text-destructive/80 transition-colors"
          >
            Out of Stock ({outOfStock.length})
            {showOutOfStock ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          {showOutOfStock && (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {outOfStock.map(item => (
                <div
                  key={item.articleId}
                  className="rounded-xl border border-destructive/20 bg-destructive/5 p-4"
                >
                  <div className="font-medium">{item.articleName}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.brandName} - {item.collectionName}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Edit Panel Component
function EditPanel({
  article,
  exchangeRate,
  onClose,
  onSuccess,
}: {
  article: any
  exchangeRate: number
  onClose: () => void
  onSuccess?: () => void
}) {
  const router = useRouter()
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(article.skus.map((s: any) => [s.skuId, s.quantity]))
  )
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      for (const [skuId, qty] of Object.entries(quantities)) {
        const original = article.skus.find((s: any) => s.skuId === skuId)
        if (original && original.quantity !== qty) {
          await updateSKUQuantity(skuId, qty)
        }
      }
      router.refresh()
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mt-4 border-t border-white/5 pt-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Edit Quantities
      </div>
      <div className="space-y-2">
        {article.skus.map((s: any) => (
          <div key={s.skuId} className="flex items-center gap-3">
            <span className="w-20 text-sm text-muted-foreground">{s.size}</span>
            <Input
              type="number"
              min="0"
              value={quantities[s.skuId] || 0}
              onChange={(e) => setQuantities({ ...quantities, [s.skuId]: Number(e.target.value) })}
              className="h-9 w-24 bg-white/[0.03] border-white/10 focus:border-primary/40 text-sm"
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
