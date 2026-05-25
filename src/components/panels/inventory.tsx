'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { formatPKR, formatUSD, suggestedSellPrice } from '@/lib/data'
import {
  updateSku, updateArticle, deleteArticle, updateSkuPaidStatus,
  deleteSku, addSku, deleteArticleImage, uploadArticleImage,
} from '@/lib/actions'
import { SIZES } from '@/lib/types'
import type { ArticleInventory, BrandWithCollections } from '@/lib/types'
import Image from 'next/image'
import {
  Download, Edit, ChevronDown, ChevronUp, Package, Search, Filter,
  Trash2, X, Check, Loader2, AlertTriangle, RotateCcw, Plus,
} from 'lucide-react'
import { exportAllData } from '@/lib/actions'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface InventoryProps {
  inventory: ArticleInventory[]
  brands: BrandWithCollections[]
  exchangeRate: number
  lowStockAlertsEnabled: boolean
  onSuccess?: () => void
}

export function Inventory({ inventory, brands, exchangeRate, lowStockAlertsEnabled, onSuccess }: InventoryProps) {
  const [searchTerm, setSearchTerm]     = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'low'>('all')
  const [brandFilter, setBrandFilter]   = useState('all')
  const [sizeFilter, setSizeFilter]     = useState('all')
  const [showOutOfStock, setShowOutOfStock] = useState(true)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [isExporting, setIsExporting]   = useState(false)

  const { inStock, outOfStock } = useMemo(() => {
    let f = inventory
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase()
      f = f.filter(i => i.articleName.toLowerCase().includes(t) || i.brandName.toLowerCase().includes(t) || i.collectionName.toLowerCase().includes(t))
    }
    if (brandFilter !== 'all') f = f.filter(i => i.brandId === brandFilter)
    if (sizeFilter !== 'all') f = f.filter(i => i.skus.some(s => s.size === sizeFilter && s.quantity > 0))
    const inStock    = f.filter(i => i.totalQuantity > 0)
    const outOfStock = f.filter(i => i.totalQuantity === 0)
    if (statusFilter === 'low' && lowStockAlertsEnabled) return { inStock: inStock.filter(i => i.skus.some(s => s.quantity > 0 && s.quantity <= s.lowStockBuffer)), outOfStock: [] }
    return { inStock, outOfStock }
  }, [inventory, searchTerm, statusFilter, brandFilter, sizeFilter, lowStockAlertsEnabled])

  const availableSizes = useMemo(() => {
    const s = new Set<string>()
    inventory.forEach(i => i.skus.forEach(sk => { if (sk.quantity > 0) s.add(sk.size) }))
    return Array.from(s).sort((a, b) => { const ai = SIZES.indexOf(a as any), bi = SIZES.indexOf(b as any); return ai === -1 ? 1 : bi === -1 ? -1 : ai - bi })
  }, [inventory])

  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csvRow = (...cols: unknown[]) => cols.map(esc).join(',')

  async function handleExport() {
    setIsExporting(true)
    try {
      const { articles, purchases, sales } = await exportAllData()

      const lines: string[] = []
      const date = new Date().toISOString().slice(0, 10)

      // ── Inventory ──
      lines.push(csvRow('=== INVENTORY ==='))
      lines.push(csvRow('Brand','Collection','Article','Size','Qty','Avg Cost PKR','Avg Cost USD','Suggested Sell USD'))
      for (const a of articles) {
        const brand = a.collections?.brands?.name ?? ''
        const col   = a.collections?.name ?? ''
        for (const s of a.skus ?? []) {
          const rate = s.avg_exchange_rate || exchangeRate
          const sell = (Math.round((s.avg_cost_pkr ?? 0) * 1.35) / rate).toFixed(2)
          lines.push(csvRow(brand, col, a.name, s.size, s.quantity ?? 0,
            Math.round(s.avg_cost_pkr ?? 0), ((s.avg_cost_pkr ?? 0) / rate).toFixed(2), sell))
        }
      }

      lines.push('')

      // ── Purchases ──
      lines.push(csvRow('=== PURCHASES ==='))
      lines.push(csvRow('Date','Brand','Collection','Article','Size','Qty',
        'Cost PKR','Commission PKR','Shipping PKR','Total Cost PKR','Exchange Rate','Source','Notes','Paid To Wajid'))
      for (const p of purchases) {
        const sku  = p.skus
        const brand  = sku?.articles?.collections?.brands?.name ?? ''
        const col    = sku?.articles?.collections?.name ?? ''
        const article= sku?.articles?.name ?? ''
        const total  = (p.cost_pkr ?? 0) + (p.commission_pkr ?? 0) + (p.shipping_pkr ?? 0)
        lines.push(csvRow(
          p.created_at?.slice(0,10) ?? '', brand, col, article, sku?.size ?? '',
          p.quantity ?? 0, p.cost_pkr ?? 0, p.commission_pkr ?? 0, p.shipping_pkr ?? 0,
          total, p.exchange_rate ?? '', p.source ?? '', p.notes ?? '',
          p.paid_to_wajid ? 'Yes' : 'No'))
      }

      lines.push('')

      // ── Sales ──
      lines.push(csvRow('=== SALES ==='))
      lines.push(csvRow('Date','Brand','Article','Size','Qty','Price USD',
        'Cost PKR at Sale','Exchange Rate','Payment Method','Channel','Client Name'))
      for (const s of sales) {
        const sku  = s.skus
        const brand  = sku?.articles?.collections?.brands?.name ?? ''
        const article= sku?.articles?.name ?? ''
        lines.push(csvRow(
          s.created_at?.slice(0,10) ?? '', brand, article, sku?.size ?? '',
          s.quantity ?? 0, s.selling_price ?? 0,
          s.cost_pkr_at_sale ?? '', s.exchange_rate_at_sale ?? '',
          s.payment_method ?? '', s.channel ?? '', s.client_name ?? ''))
      }

      const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `rivayat-full-backup-${date}.csv`
      a.click()
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
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
        <Button onClick={handleExport} disabled={isExporting} size="sm"
          className="gap-2 border border-primary/20 bg-primary/8 text-primary hover:bg-primary/15 hover:border-primary/30 disabled:opacity-50">
          {isExporting
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Exporting…</>
            : <><Download className="h-4 w-4" /> Full Backup</>}
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
            { value: statusFilter, onChange: (v: string) => setStatusFilter(v as 'all' | 'low'), options: lowStockAlertsEnabled ? [['all','All In Stock'],['low','Low Stock']] : [['all','All In Stock']] },
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
              lowStockAlertsEnabled={lowStockAlertsEnabled}
              isDeleting={deletingId === item.articleId}
              onDeleteStart={() => setDeletingId(item.articleId)}
              onDeleteCancel={() => setDeletingId(null)}
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
  item, brands, exchangeRate, lowStockAlertsEnabled, isDeleting,
  onDeleteStart, onDeleteCancel, onSuccess,
}: {
  item: ArticleInventory
  brands: BrandWithCollections[]
  exchangeRate: number
  lowStockAlertsEnabled: boolean
  isDeleting: boolean
  onDeleteStart: () => void
  onDeleteCancel: () => void
  onSuccess?: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)

  const avgCost = item.skus.reduce((s, sk) => s + sk.avgCostPKR * sk.quantity, 0) /
    Math.max(item.totalQuantity, 1)
  const costUSD    = avgCost / exchangeRate
  const suggestUSD = suggestedSellPrice(avgCost, 0, 0) / exchangeRate
  const markupPct  = avgCost > 0 ? ((suggestUSD - costUSD) / costUSD) * 100 : 0

  const hasUnpaid = item.skus.some(s => !s.paidToWajid)

  return (
    <div className={cn(
      'group relative rounded-2xl border bg-[#141414] p-5 premium-card transition-all duration-350',
      'border-[rgba(255,255,255,0.06)]',
    )}>
      {/* Unpaid badge */}
      {hasUnpaid && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute top-3 right-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/90 shadow-sm cursor-help">
              <AlertTriangle className="h-3.5 w-3.5 text-white" />
            </div>
          </TooltipTrigger>
          <TooltipContent>Status: Unpaid</TooltipContent>
        </Tooltip>
      )}

      {/* Thumbnail */}
      {item.imageUrl && (
        <div className="relative mb-4 aspect-square w-full overflow-hidden rounded-xl border border-white/5">
          <Image
            src={item.imageUrl}
            alt={item.articleName}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Top row */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="mb-1.5 flex max-w-full">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary whitespace-nowrap overflow-hidden max-w-full" style={{ minWidth: 0 }}>
              <span className="truncate">{item.brandName}</span>
            </span>
          </div>
          <div className="text-base font-semibold leading-tight group-hover:text-primary transition-colors truncate">
            {item.articleName}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.collectionName}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setEditOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-muted-foreground transition-all hover:border-primary/25 hover:bg-primary/8 hover:text-primary"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          {!isDeleting && (
            <button onClick={onDeleteStart}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-muted-foreground transition-all hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {isDeleting && (
        <DeleteConfirm item={item} onCancel={onDeleteCancel} onSuccess={onSuccess} />
      )}

      {/* Sizes */}
      {!isDeleting && (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {item.skus.filter(s => s.quantity > 0).map(s => (
              <span key={s.skuId} className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium tabular',
                s.quantity === 0 ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : lowStockAlertsEnabled && s.quantity <= s.lowStockBuffer ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                  : 'border-white/8 bg-white/[0.04] text-foreground',
              )}>
                <span className="text-muted-foreground">{s.size}</span>
                <span className="font-bold">{s.quantity}</span>
              </span>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-end justify-between border-t border-white/5 pt-3 mt-3">
            <div />
            <div className="text-right">
              {avgCost > 0 && (
                <>
                  <div className="text-xs text-muted-foreground">Cost {formatUSD(avgCost / exchangeRate)}</div>
                  <div className="text-sm font-bold text-primary num-display">Sell {formatUSD(suggestUSD)}</div>
                  <div className="text-[10px] text-success">{markupPct.toFixed(0)}% markup</div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>Edit: {item.articleName}</DialogTitle>
            <DialogDescription>{item.brandName} · {item.collectionName}</DialogDescription>
          </DialogHeader>
          <EditModal
            item={item}
            brands={brands}
            exchangeRate={exchangeRate}
            onClose={() => setEditOpen(false)}
            onSuccess={onSuccess}
          />
        </DialogContent>
      </Dialog>
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
      const result = await deleteArticle(item.articleId)
      if (result?.error) {
        toast.error(result.error)
        setLoading(false); onCancel()
      } else {
        router.refresh()
        onSuccess?.()
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete article. Please try again.')
      setLoading(false); onCancel()
    }
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

// ─── Edit Modal (inside Dialog) ───────────────────────────────────────────────

interface SkuEditRow {
  id: string           // local React key
  skuId?: string       // undefined = newly added, not yet in DB
  size: string
  qty: number
  buffer: number
  cost: number
  paidToWajid: boolean
  isDeleted: boolean
}

function EditModal({ item, brands, exchangeRate, onClose, onSuccess }: {
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

  // Image state
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(item.imageUrl)
  const [imageAction,     setImageAction]     = useState<'none' | 'upload' | 'delete'>('none')
  const [imageFile,       setImageFile]       = useState<File | null>(null)
  const [imagePreview,    setImagePreview]    = useState<string | null>(null)

  // SKU rows
  const [skuRows,    setSkuRows]    = useState<SkuEditRow[]>(
    item.skus.map(s => ({
      id: s.skuId, skuId: s.skuId,
      size: s.size, qty: s.quantity, buffer: s.lowStockBuffer,
      cost: s.avgCostPKR, paidToWajid: s.paidToWajid, isDeleted: false,
    }))
  )
  const [nextTempId, setNextTempId] = useState(0)

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const collections    = brands.find(b => b.id === selectedBrand)?.collections ?? []
  const activeRows     = skuRows.filter(r => !r.isDeleted)
  const deletedExisting = skuRows.filter(r => r.isDeleted && r.skuId)

  const selectClass = 'flex h-9 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground focus:border-primary/50 focus:outline-none'

  // ── Image handlers ────────────────────────────────────────────────────────

  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    const preview = URL.createObjectURL(file)
    setImageFile(file); setImagePreview(preview)
    setCurrentImageUrl(preview); setImageAction('upload')
  }

  function handleDeleteImage() {
    setCurrentImageUrl(null); setImageAction('delete')
    if (imagePreview) { URL.revokeObjectURL(imagePreview); setImagePreview(null) }
    setImageFile(null)
  }

  function handleUndoDeleteImage() {
    setCurrentImageUrl(item.imageUrl); setImageAction('none')
  }

  // ── SKU row handlers ──────────────────────────────────────────────────────

  function updateRow(id: string, field: keyof SkuEditRow, value: unknown) {
    setSkuRows(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function toggleDeleted(id: string) {
    setSkuRows(rows => rows.map(r => r.id === id ? { ...r, isDeleted: !r.isDeleted } : r))
  }

  function addRow() {
    const tempId = `temp-${nextTempId}`
    setNextTempId(n => n + 1)
    setSkuRows(rows => [...rows, {
      id: tempId, skuId: undefined,
      size: 'M', qty: 0, buffer: 2, cost: 0, paidToWajid: true, isDeleted: false,
    }])
  }

  function removeNewRow(id: string) {
    setSkuRows(rows => rows.filter(r => r.id !== id))
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!articleName.trim()) { setError('Article name required'); return }
    if (activeRows.length === 0) { setError('At least one size variant is required.'); return }
    setSaving(true); setError('')

    try {
      // 1. Article name / collection
      const articleUpdates: { name?: string; collection_id?: string } = {}
      if (articleName.trim() !== item.articleName) articleUpdates.name = articleName.trim()
      if (collectionId !== item.collectionId) articleUpdates.collection_id = collectionId
      if (Object.keys(articleUpdates).length > 0) {
        const r = await updateArticle(item.articleId, articleUpdates)
        if (r?.error) { setError(r.error); return }
      }

      // 2. Image
      if (imageAction === 'delete' && item.imageUrl) {
        const r = await deleteArticleImage(item.articleId, item.imageUrl)
        if (r?.error) { setError(r.error); return }
      } else if (imageAction === 'upload' && imageFile) {
        const fd = new FormData()
        fd.append('file', imageFile)
        const { url, error: uploadError } = await uploadArticleImage(fd)
        if (uploadError) { setError(`Image upload failed: ${uploadError}`); return }
        const r = await updateArticle(item.articleId, { image_url: url! })
        if (r?.error) { setError(r.error); return }
      }

      // 3. Delete marked variants (cascades purchases + sales)
      for (const row of deletedExisting) {
        const r = await deleteSku(row.skuId!)
        if (r?.error) { setError(r.error); return }
      }

      // 4. Upsert active rows
      for (const row of activeRows) {
        if (!row.skuId) {
          // New variant
          const r = await addSku(item.articleId, row.size, row.qty, row.buffer, row.cost, exchangeRate)
          if (r?.error) { setError(r.error); return }
        } else {
          // Existing variant — diff patch
          const orig = item.skus.find(s => s.skuId === row.skuId)
          if (!orig) continue
          const patch: Parameters<typeof updateSku>[1] = {}
          if (row.size   !== orig.size)             patch.size           = row.size
          if (row.qty    !== orig.quantity)          patch.quantity       = row.qty
          if (row.buffer !== orig.lowStockBuffer)    patch.lowStockBuffer = row.buffer
          if (row.cost   !== orig.avgCostPKR)        patch.avgCostPKR     = row.cost
          if (Object.keys(patch).length > 0) {
            const r = await updateSku(row.skuId, patch)
            if (r?.error) { setError(r.error); return }
          }
          if (row.paidToWajid !== orig.paidToWajid) {
            await updateSkuPaidStatus(row.skuId, row.paidToWajid)
          }
        }
      }

      router.refresh(); onSuccess?.(); onClose()
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="space-y-5 max-h-[62vh] overflow-y-auto pr-1">
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* ── Image ── */}
        <div className="space-y-2">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Product Image</Label>

          {imageAction === 'delete' ? (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
              <span className="text-xs text-destructive">Image will be removed on save.</span>
              <button type="button" onClick={handleUndoDeleteImage}
                className="ml-auto text-xs underline text-muted-foreground hover:text-foreground">
                Undo
              </button>
            </div>
          ) : currentImageUrl ? (
            <div className="flex items-start gap-3">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={currentImageUrl} alt="Product" className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <button type="button" onClick={handleDeleteImage}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/15 transition-all">
                  <Trash2 className="h-3 w-3" /> Delete Picture
                </button>
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.06] cursor-pointer transition-all">
                  <input type="file" accept="image/*" onChange={handleImageFileChange} className="sr-only" />
                  Replace Image
                </label>
              </div>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-white/15 bg-[#111] px-4 text-sm text-muted-foreground cursor-pointer hover:border-primary/30 hover:text-foreground transition-all">
              <input type="file" accept="image/*" onChange={handleImageFileChange} className="sr-only" />
              {imageFile ? imageFile.name : 'Upload image…'}
            </label>
          )}
        </div>

        {/* ── Article name ── */}
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Article Name</Label>
          <Input value={articleName} onChange={e => setArticleName(e.target.value)}
            className="h-10 bg-input border-border focus:border-primary/50" />
        </div>

        {/* ── Brand + Collection ── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Brand</Label>
            <select value={selectedBrand}
              onChange={e => { setSelectedBrand(e.target.value); setCollectionId('') }}
              className={selectClass}>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Collection</Label>
            <select value={collectionId} onChange={e => setCollectionId(e.target.value)} className={selectClass}>
              <option value="">— select —</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* ── Variants ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Variants — Size / Qty / Buffer / Cost PKR / Paid
            </div>
            {deletedExisting.length > 0 && (
              <span className="text-[10px] font-medium text-destructive">
                {deletedExisting.length} variant{deletedExisting.length > 1 ? 's' : ''} flagged for deletion
                {' '}(cascades purchases &amp; sales)
              </span>
            )}
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
            {skuRows.map(row => (
              <div key={row.id} className={cn(
                'grid grid-cols-[72px_1fr_1fr_1fr_auto_auto] items-center gap-2 rounded-xl border px-3 py-2.5 transition-all',
                row.isDeleted
                  ? 'border-destructive/20 bg-destructive/5 opacity-55'
                  : 'border-border bg-muted/40',
              )}>
                {/* Size */}
                <div>
                  <div className="text-[9px] text-muted-foreground mb-0.5 uppercase tracking-wider">Size</div>
                  <select value={row.size} disabled={row.isDeleted}
                    onChange={e => updateRow(row.id, 'size', e.target.value)}
                    className="flex h-8 w-full rounded-lg border border-border bg-input px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none disabled:opacity-40">
                    {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Qty */}
                <div>
                  <div className="text-[9px] text-muted-foreground mb-0.5 uppercase tracking-wider">Qty</div>
                  <Input type="number" min="0" value={row.qty} disabled={row.isDeleted}
                    onChange={e => updateRow(row.id, 'qty', Number(e.target.value))}
                    className="h-8 bg-input border-border focus:border-primary/50 text-xs disabled:opacity-40" />
                </div>

                {/* Buffer */}
                <div>
                  <div className="text-[9px] text-muted-foreground mb-0.5 uppercase tracking-wider">Buffer</div>
                  <Input type="number" min="0" value={row.buffer} disabled={row.isDeleted}
                    onChange={e => updateRow(row.id, 'buffer', Number(e.target.value))}
                    className="h-8 bg-input border-border focus:border-primary/50 text-xs disabled:opacity-40" />
                </div>

                {/* Cost */}
                <div>
                  <div className="text-[9px] text-muted-foreground mb-0.5 uppercase tracking-wider">Cost PKR</div>
                  <Input type="number" min="0" value={row.cost} disabled={row.isDeleted}
                    onChange={e => updateRow(row.id, 'cost', Number(e.target.value))}
                    className="h-8 bg-input border-border focus:border-primary/50 text-xs disabled:opacity-40" />
                </div>

                {/* Paid toggle */}
                <div className="text-center">
                  <div className="text-[9px] text-muted-foreground mb-1.5 uppercase tracking-wider whitespace-nowrap">Paid</div>
                  <button type="button" disabled={row.isDeleted}
                    onClick={() => updateRow(row.id, 'paidToWajid', !row.paidToWajid)}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg border transition-all disabled:opacity-40',
                      row.paidToWajid
                        ? 'bg-success/15 border-success/30 text-success'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-500',
                    )}>
                    {row.paidToWajid ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Delete / Undo / Remove */}
                <div className="text-center">
                  <div className="text-[9px] text-muted-foreground mb-1.5 invisible">·</div>
                  {row.isDeleted ? (
                    <button type="button" onClick={() => toggleDeleted(row.id)}
                      title="Undo deletion"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-success/30 bg-success/10 text-success hover:bg-success/20 transition-all">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  ) : row.skuId ? (
                    <button type="button" onClick={() => toggleDeleted(row.id)}
                      title="Mark for deletion"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button type="button" onClick={() => removeNewRow(row.id)}
                      title="Remove new row"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive transition-all">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={addRow}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-success/20 bg-success/8 px-4 py-2 text-sm font-medium text-success transition-all hover:bg-success/15 hover:border-success/30">
            <Plus className="h-3.5 w-3.5" /> Add Size
          </button>
        </div>
      </div>

      <DialogFooter className="pt-4 border-t border-white/5 mt-2">
        <Button variant="outline" onClick={onClose} className="border-border bg-transparent hover:bg-muted/40">
          <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || activeRows.length === 0}
          className="bg-primary text-primary-foreground hover:bg-primary/90">
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
          Save Changes
        </Button>
      </DialogFooter>
    </>
  )
}
