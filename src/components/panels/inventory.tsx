'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPKR, formatUSD, suggestedSellPrice } from '@/lib/data'
import { updateSku, updateArticle, deleteArticle } from '@/lib/actions'
import { SIZES } from '@/lib/types'
import type { ArticleInventory, BrandWithCollections } from '@/lib/types'
import { Download, Edit, ChevronDown, ChevronUp, Package, Search, Filter, Trash2, X, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InventoryProps {
  inventory: ArticleInventory[]
  brands: BrandWithCollections[]
  exchangeRate: number
  onSuccess?: () => void
}

function StockBadge({ qty, buffer }: { qty: number; buffer: number }) {
  if (qty === 0) return <span className="inline-flex items-center rounded-md bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">Out of stock</span>
  if (qty <= buffer) return <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">Low stock</span>
  return <span className="inline-flex items-center rounded-md bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">In stock</span>
}

export function Inventory({ inventory, brands, exchangeRate, onSuccess }: InventoryProps) {
  const [searchTerm, setSearchTerm]     = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'low'>('all')
  const [brandFilter, setBrandFilter]   = useState('all')
  const [sizeFilter, setSizeFilter]     = useState('all')
  const [showOutOfStock, setShowOutOfStock] = useState(true)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [deletingId, setDeletingId]     = useState<string | null>(null)

  const { inStock, outOfStock } = useMemo(() => {
    let f = inventory
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase()
      f = f.filter(i => i.articleName.toLowerCase().includes(t) || i.brandName.toLowerCase().includes(t) || i.collectionName.toLowerCase().includes(t))
    }
    if (brandFilter !== 'all') f = f.filter(i => i.brandId === brandFilter)
    if (sizeFilter !== 'all') f = f.filter(i => i.skus.some(s => s.size === sizeFilter && s.quantity > 0))
    const inStock  = f.filter(i => i.totalQuantity > 0)
    const outOfStock = f.filter(i => i.totalQuantity === 0)
    if (statusFilter === 'low') return { inStock: inStock.filter(i => i.skus.some(s => s.quantity > 0 && s.quantity <= s.lowStockBuffer)), outOfStock: [] }
    return { inStock, outOfStock }
  }, [inventory, searchTerm, statusFilter, brandFilter, sizeFilter])

  const availableSizes = useMemo(() => {
    const s = new Set<string>()
    inventory.forEach(i => i.skus.forEach(sk => { if (sk.quantity > 0) s.add(sk.size) }))
    return Array.from(s).sort((a, b) => { const ai = SIZES.indexOf(a as any), bi = SIZES.indexOf(b as any); return ai === -1 ? 1 : bi === -1 ? -1 : ai - bi })
  }, [inventory])

  const exportCSV = () => {
    const rows: string[][] = [['Brand','Collection','Article','Size','Qty','Cost PKR','Cost USD','Sell USD']]
    for (const item of inStock) {
      for (const sku of item.skus.filter(s => s.quantity > 0)) {
        const sell = suggestedSellPrice(sku.avgCostPKR, 0, 0) / exchangeRate
        rows.push([item.brandName, item.collectionName, item.articleName, sku.size, String(sku.quantity),
          String(Math.round(sku.avgCostPKR)), String((sku.avgCostPKR / exchangeRate).toFixed(2)), sell.toFixed(2)])
      }
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[1.9rem] font-semibold tracking-tight leading-none mb-1">
            Inventory
          </h2>
          <p className="text-sm text-muted-foreground">{inStock.length} articles in stock</p>
        </div>
        <Button onClick={exportCSV} size="sm"
          className="gap-2 border border-primary/20 bg-primary/8 text-primary hover:bg-primary/15 hover:border-primary/30">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4">
        <div className="flex items-center gap-2 mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1 max-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search articles…"
              className="pl-9 h-9 bg-[#111] border-white/10 focus:border-primary/40 text-sm" />
          </div>
          {[
            { value: statusFilter, onChange: (v: string) => setStatusFilter(v as 'all' | 'low'), options: [['all','All In Stock'],['low','Low Stock']] },
            { value: brandFilter, onChange: (v: string) => setBrandFilter(v), options: [['all','All Brands'], ...brands.map(b => [b.id, b.name])] },
            { value: sizeFilter, onChange: (v: string) => setSizeFilter(v), options: [['all','All Sizes'], ...availableSizes.map(s => [s, s])] },
          ].map((sel, idx) => (
            <select key={idx} value={sel.value} onChange={e => sel.onChange(e.target.value)}
              className="h-9 rounded-xl border border-white/10 bg-[#111] px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none">
              {(sel.options as [string, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
        </div>
      </div>

      {/* Grid */}
      {inStock.length === 0 ? (
        <div className="py-20 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground">No items found</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
          {inStock.map(item => (
            <InventoryCard
              key={item.articleId}
              item={item}
              brands={brands}
              exchangeRate={exchangeRate}
              isEditing={editingId === item.articleId}
              isDeleting={deletingId === item.articleId}
              onEdit={() => setEditingId(editingId === item.articleId ? null : item.articleId)}
              onDeleteStart={() => setDeletingId(item.articleId)}
              onDeleteCancel={() => setDeletingId(null)}
              onClose={() => setEditingId(null)}
              onSuccess={onSuccess}
            />
          ))}
        </div>
      )}

      {/* Out of stock */}
      {outOfStock.length > 0 && statusFilter === 'all' && (
        <div className="mt-8 border-t border-white/5 pt-6">
          <button onClick={() => setShowOutOfStock(!showOutOfStock)}
            className="mb-4 flex items-center gap-2 text-sm font-semibold text-destructive/70 hover:text-destructive transition-colors">
            Out of Stock ({outOfStock.length})
            {showOutOfStock ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showOutOfStock && (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {outOfStock.map(item => (
                <div key={item.articleId} className="rounded-xl border border-destructive/15 bg-destructive/5 px-4 py-3">
                  <div className="font-medium text-sm">{item.articleName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.brandName} · {item.collectionName}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Inventory Card ───────────────────────────────────────────────────────────

function InventoryCard({
  item, brands, exchangeRate, isEditing, isDeleting,
  onEdit, onDeleteStart, onDeleteCancel, onClose, onSuccess,
}: {
  item: ArticleInventory
  brands: BrandWithCollections[]
  exchangeRate: number
  isEditing: boolean
  isDeleting: boolean
  onEdit: () => void
  onDeleteStart: () => void
  onDeleteCancel: () => void
  onClose: () => void
  onSuccess?: () => void
}) {
  const avgCost = item.skus.reduce((s, sk) => s + sk.avgCostPKR * sk.quantity, 0) /
    Math.max(item.totalQuantity, 1)
  const suggestUSD = suggestedSellPrice(avgCost, 0, 0) / exchangeRate
  const marginPct  = avgCost > 0 ? ((suggestUSD - avgCost / exchangeRate) / suggestUSD) * 100 : 0

  // overall stock status
  const hasLow = item.skus.some(s => s.quantity > 0 && s.quantity <= s.lowStockBuffer)
  const status = hasLow ? 'low' : 'ok'

  return (
    <div className={cn(
      'group relative rounded-2xl border bg-[#141414] p-5 premium-card transition-all duration-350',
      isEditing ? 'border-primary/25 bg-[#191919]' : 'border-[rgba(255,255,255,0.06)]',
    )}>
      {/* Top row */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary mb-1.5">
            {item.brandName}
          </div>
          <div className="text-base font-semibold leading-tight group-hover:text-primary transition-colors truncate">
            {item.articleName}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{item.collectionName}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onEdit}
            className={cn('flex h-8 w-8 items-center justify-center rounded-xl border transition-all',
              isEditing ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-white/[0.03] border-white/10 text-muted-foreground hover:border-primary/25 hover:bg-primary/8 hover:text-primary')}>
            <Edit className="h-3.5 w-3.5" />
          </button>
          {!isDeleting ? (
            <button onClick={onDeleteStart}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-muted-foreground transition-all hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Delete confirm */}
      {isDeleting && (
        <DeleteConfirm item={item} onCancel={onDeleteCancel} onSuccess={onSuccess} />
      )}

      {/* Sizes */}
      {!isEditing && !isDeleting && (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {item.skus.filter(s => s.quantity > 0).map(s => (
              <span key={s.skuId} className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium tabular',
                s.quantity === 0 ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : s.quantity <= s.lowStockBuffer ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                  : 'border-white/8 bg-white/[0.04] text-foreground',
              )}>
                <span className="text-muted-foreground">{s.size}</span>
                <span className="font-bold">{s.quantity}</span>
              </span>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-end justify-between border-t border-white/5 pt-3 mt-3">
            <div className="flex items-center gap-2">
              <StockBadge qty={item.totalQuantity} buffer={item.skus[0]?.lowStockBuffer ?? 2} />
              {status === 'low' && <span className="text-[10px] text-amber-400/70">Some sizes low</span>}
            </div>
            <div className="text-right">
              {avgCost > 0 && (
                <>
                  <div className="text-xs text-muted-foreground">Cost {formatUSD(avgCost / exchangeRate)}</div>
                  <div className="text-sm font-bold text-primary num-display">Sell {formatUSD(suggestUSD)}</div>
                  <div className="text-[10px] text-success">{marginPct.toFixed(0)}% margin</div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Edit panel */}
      {isEditing && !isDeleting && (
        <EditPanel item={item} brands={brands} exchangeRate={exchangeRate} onClose={onClose} onSuccess={onSuccess} />
      )}
    </div>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ item, onCancel, onSuccess }: {
  item: ArticleInventory
  onCancel: () => void
  onSuccess?: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      await deleteArticle(item.articleId)
      router.refresh()
      onSuccess?.()
    } catch { setLoading(false); onCancel() }
  }

  return (
    <div className="rounded-xl border border-destructive/25 bg-destructive/8 p-4 mb-4">
      <p className="text-sm font-semibold text-destructive mb-1">Delete "{item.articleName}"?</p>
      <p className="text-xs text-muted-foreground mb-4">This permanently removes the article, all SKUs, purchases, and sales. This cannot be undone.</p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06] flex-1">
          <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
        </Button>
        <Button size="sm" onClick={handleDelete} disabled={loading}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex-1">
          {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
          Delete
        </Button>
      </div>
    </div>
  )
}

// ─── Edit Panel ───────────────────────────────────────────────────────────────

function EditPanel({ item, brands, exchangeRate, onClose, onSuccess }: {
  item: ArticleInventory
  brands: BrandWithCollections[]
  exchangeRate: number
  onClose: () => void
  onSuccess?: () => void
}) {
  const router = useRouter()
  const [articleName,   setArticleName]   = useState(item.articleName)
  const [collectionId,  setCollectionId]  = useState(item.collectionId)
  const [selectedBrand, setSelectedBrand] = useState(item.brandId)
  const [skuData, setSkuData] = useState<Record<string, { qty: number; buffer: number; cost: number }>>(
    Object.fromEntries(item.skus.map(s => [s.skuId, { qty: s.quantity, buffer: s.lowStockBuffer, cost: s.avgCostPKR }]))
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const collections = brands.find(b => b.id === selectedBrand)?.collections ?? []

  async function handleSave() {
    if (!articleName.trim()) { setError('Article name required'); return }
    setSaving(true); setError('')
    try {
      // Update article name / collection
      const updates: { name?: string; collection_id?: string } = {}
      if (articleName.trim() !== item.articleName) updates.name = articleName.trim()
      if (collectionId !== item.collectionId) updates.collection_id = collectionId
      if (Object.keys(updates).length > 0) await updateArticle(item.articleId, updates)

      // Update each SKU
      for (const [skuId, vals] of Object.entries(skuData)) {
        const orig = item.skus.find(s => s.skuId === skuId)
        if (!orig) continue
        const patch: { quantity?: number; lowStockBuffer?: number; avgCostPKR?: number } = {}
        if (vals.qty !== orig.quantity) patch.quantity = vals.qty
        if (vals.buffer !== orig.lowStockBuffer) patch.lowStockBuffer = vals.buffer
        if (vals.cost !== orig.avgCostPKR) patch.avgCostPKR = vals.cost
        if (Object.keys(patch).length > 0) await updateSku(skuId, patch)
      }

      router.refresh(); onSuccess?.(); onClose()
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">{error}</div>}

      {/* Article name */}
      <div className="space-y-1.5">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Article Name</Label>
        <Input value={articleName} onChange={e => setArticleName(e.target.value)}
          className="h-9 bg-[#111] border-white/10 focus:border-primary/40 text-sm" />
      </div>

      {/* Brand + Collection */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Brand</Label>
          <select value={selectedBrand}
            onChange={e => { setSelectedBrand(e.target.value); setCollectionId('') }}
            className="flex h-9 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none">
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Collection</Label>
          <select value={collectionId} onChange={e => setCollectionId(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none">
            <option value="">— select —</option>
            {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Per-SKU quantities + cost */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sizes / Quantities / Cost</div>
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {item.skus.map(s => {
            const d = skuData[s.skuId] ?? { qty: s.quantity, buffer: s.lowStockBuffer, cost: s.avgCostPKR }
            return (
              <div key={s.skuId} className="grid grid-cols-[40px_1fr_1fr_1fr] items-center gap-2 rounded-lg bg-white/[0.02] px-3 py-2 border border-white/5">
                <span className="text-xs font-semibold text-muted-foreground">{s.size}</span>
                <div>
                  <div className="text-[9px] text-muted-foreground mb-0.5">Qty</div>
                  <Input type="number" min="0" value={d.qty}
                    onChange={e => setSkuData(prev => ({ ...prev, [s.skuId]: { ...d, qty: Number(e.target.value) } }))}
                    className="h-8 bg-[#0D0D0D] border-white/8 focus:border-primary/40 text-xs" />
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground mb-0.5">Buffer</div>
                  <Input type="number" min="0" value={d.buffer}
                    onChange={e => setSkuData(prev => ({ ...prev, [s.skuId]: { ...d, buffer: Number(e.target.value) } }))}
                    className="h-8 bg-[#0D0D0D] border-white/8 focus:border-primary/40 text-xs" />
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground mb-0.5">Cost PKR</div>
                  <Input type="number" min="0" value={d.cost}
                    onChange={e => setSkuData(prev => ({ ...prev, [s.skuId]: { ...d, cost: Number(e.target.value) } }))}
                    className="h-8 bg-[#0D0D0D] border-white/8 focus:border-primary/40 text-xs" />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onClose} className="flex-1 border-white/10 bg-white/[0.02] hover:bg-white/[0.05]">
          <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
          Save Changes
        </Button>
      </div>
    </div>
  )
}
