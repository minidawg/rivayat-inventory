'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPKR, formatUSD, totalCostPKR, suggestedSellPrice } from '@/lib/data'
import { stockIn, uploadArticleImage } from '@/lib/actions'
import { SIZES, SOURCES } from '@/lib/types'
import type { BrandWithCollections } from '@/lib/types'
import { Plus, X, Loader2, PackagePlus, Tag, CheckCircle2, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SizeRow { id: number; size: string; quantity: number }

interface StockInProps {
  brands: BrandWithCollections[]
  exchangeRate: number
  onSuccess?: () => void
}

const selectClass = 'flex h-11 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm text-foreground transition-all focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:opacity-40'

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1.5">
      {children}
    </div>
  )
}

export function StockIn({ brands, exchangeRate, onSuccess }: StockInProps) {
  const router = useRouter()

  const [brandId,       setBrandId]       = useState('')
  const [collectionId,  setCollectionId]  = useState('')
  const [articleName,   setArticleName]   = useState('')
  const [sizeRows,      setSizeRows]      = useState<SizeRow[]>([{ id: 0, size: 'M', quantity: 1 }])
  const [costPKR,       setCostPKR]       = useState('')
  const [commissionPKR, setCommissionPKR] = useState('')
  const [shippingPKR,   setShippingPKR]   = useState('0')
  const [source,        setSource]        = useState<typeof SOURCES[number]>('prebook')
  const [paidToWajid,   setPaidToWajid]   = useState(false)
  const [notes,         setNotes]         = useState('')
  const [imageFile,     setImageFile]     = useState<File | null>(null)
  const [imagePreview,  setImagePreview]  = useState<string | null>(null)
  const [isSubmitting,  setIsSubmitting]  = useState(false)
  const [success,       setSuccess]       = useState(false)
  const [nextId,        setNextId]        = useState(1)

  const selectedBrand = brands.find(b => b.id === brandId)
  const collections   = selectedBrand?.collections ?? []

  const totalUnits = sizeRows.reduce((s, r) => s + r.quantity, 0)

  const cost = useMemo(() => {
    const c  = Number(costPKR)       || 0
    const co = Number(commissionPKR) || 0
    const sh = Number(shippingPKR)   || 0
    const unitPKR = totalCostPKR(c, co, sh)
    const linePKR = unitPKR * totalUnits
    const sellPKR = suggestedSellPrice(c, co, sh)
    return {
      unitPKR,  unitUSD: unitPKR / exchangeRate,
      linePKR,  lineUSD: linePKR / exchangeRate,
      sellPKR,  sellUSD: sellPKR / exchangeRate,
    }
  }, [costPKR, commissionPKR, shippingPKR, exchangeRate, totalUnits])

  function addRow() {
    setSizeRows(r => [...r, { id: nextId, size: 'M', quantity: 1 }])
    setNextId(n => n + 1)
  }
  function removeRow(id: number) {
    if (sizeRows.length > 1) setSizeRows(r => r.filter(x => x.id !== id))
  }
  function updateRow(id: number, field: 'size' | 'quantity', value: string | number) {
    setSizeRows(r => r.map(x => x.id === id ? { ...x, [field]: value } : x))
  }
  function stepQty(id: number, delta: number) {
    setSizeRows(r => r.map(x => x.id === id ? { ...x, quantity: Math.max(1, x.quantity + delta) } : x))
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  function resetForm() {
    setBrandId(''); setCollectionId(''); setArticleName('')
    setSizeRows([{ id: 0, size: 'M', quantity: 1 }])
    setCostPKR(''); setCommissionPKR(''); setShippingPKR('0')
    setSource('prebook'); setPaidToWajid(false); setNotes(''); setNextId(1)
    setImageFile(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
  }

  async function handleSubmit() {
    if (!collectionId || !articleName.trim() || !costPKR) return
    const valid = sizeRows.filter(r => r.quantity > 0)
    if (valid.length === 0) return

    setIsSubmitting(true)
    try {
      let imageUrl: string | undefined
      if (imageFile) {
        const fd = new FormData()
        fd.append('file', imageFile)
        const { url, error: uploadError } = await uploadArticleImage(fd)
        if (uploadError) { toast.error(`Image upload failed: ${uploadError}`); setIsSubmitting(false); return }
        imageUrl = url
      }

      const result = await stockIn(
        articleName.trim(), collectionId,
        valid.map(r => ({ size: r.size, quantity: r.quantity })),
        Number(costPKR), Number(commissionPKR) || 0, Number(shippingPKR) || 0,
        exchangeRate, source, notes.trim(), paidToWajid,
        imageUrl,
      )
      if (result?.error) {
        toast.error(result.error)
      } else {
        router.refresh()
        resetForm()
        setSuccess(true)
        setTimeout(() => setSuccess(false), 4000)
        onSuccess?.()
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add stock. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid = !!(collectionId && articleName.trim() && costPKR && sizeRows.some(r => r.quantity > 0))

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-[family-name:var(--font-display)] text-[1.9rem] font-semibold tracking-tight leading-none mb-1">
          Stock In
        </h2>
        <p className="text-sm text-muted-foreground">Add new inventory to your stock</p>
      </div>

      {/* Success banner */}
      {success && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-success/25 bg-success/8 px-5 py-4 animate-slide-up">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
          <div>
            <p className="text-sm font-semibold text-success">Stock added successfully</p>
            <p className="text-xs text-success/60">Inventory has been updated.</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Item Details */}
          <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-6">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Tag className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold">Item Details</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Brand</FieldLabel>
                <select value={brandId} onChange={e => { setBrandId(e.target.value); setCollectionId('') }} className={selectClass}>
                  <option value="">Select brand…</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div>
                <FieldLabel>Collection</FieldLabel>
                <select value={collectionId} onChange={e => setCollectionId(e.target.value)} disabled={!brandId} className={selectClass}>
                  <option value="">{brandId ? 'Select collection…' : 'Select brand first'}</option>
                  {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="md:col-span-2">
                <FieldLabel>Article Name <span className="font-normal lowercase tracking-normal text-muted-foreground/50">(auto-creates if new)</span></FieldLabel>
                <Input value={articleName} onChange={e => setArticleName(e.target.value)}
                  placeholder="e.g. Muzlin 3-Piece Embroidered"
                  className="h-11 bg-[#111] border-white/10 focus:border-primary/40" />
              </div>

              <div className="md:col-span-2">
                <FieldLabel>Product Image <span className="font-normal lowercase tracking-normal text-muted-foreground/50">(optional)</span></FieldLabel>
                <div className="flex items-start gap-4">
                  <label className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-white/15 bg-[#111] px-4 text-sm text-muted-foreground cursor-pointer hover:border-primary/30 hover:text-foreground transition-all">
                    <input type="file" accept="image/*" onChange={handleImageChange} className="sr-only" />
                    {imageFile ? imageFile.name : 'Choose image…'}
                  </label>
                  {imagePreview && (
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setImageFile(null); if (imagePreview) URL.revokeObjectURL(imagePreview); setImagePreview(null) }}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sizes & Quantities */}
          <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-6">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <PackagePlus className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold">Sizes & Quantities</h3>
              <span className="ml-auto text-xs text-muted-foreground tabular">{totalUnits} pcs total</span>
            </div>

            <div className="mb-4 space-y-2.5">
              {sizeRows.map(row => (
                <div key={row.id}
                  className="grid grid-cols-[140px_1fr_36px] items-end gap-3 rounded-xl border border-white/5 bg-[#111]/60 px-4 py-3">
                  {/* Size */}
                  <div>
                    <FieldLabel>Size</FieldLabel>
                    <select value={row.size} onChange={e => updateRow(row.id, 'size', e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none">
                      {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Qty stepper */}
                  <div>
                    <FieldLabel>Quantity</FieldLabel>
                    <div className="flex items-center rounded-xl border border-white/10 bg-[#111] overflow-hidden h-9">
                      <button onClick={() => stepQty(row.id, -1)} disabled={row.quantity <= 1}
                        className="flex h-full w-9 shrink-0 items-center justify-center text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:opacity-30 transition-all">
                        <Minus className="h-3 w-3" />
                      </button>
                      <input type="number" min="1" value={row.quantity}
                        onChange={e => updateRow(row.id, 'quantity', Math.max(1, Number(e.target.value)))}
                        className="flex-1 bg-transparent text-center text-sm font-semibold tabular focus:outline-none w-0" />
                      <button onClick={() => stepQty(row.id, 1)}
                        className="flex h-full w-9 shrink-0 items-center justify-center text-muted-foreground hover:bg-white/5 hover:text-primary transition-all">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Remove */}
                  <button onClick={() => removeRow(row.id)} disabled={sizeRows.length <= 1}
                    className={cn('flex h-9 w-9 items-center justify-center rounded-lg border border-white/8 transition-all',
                      sizeRows.length > 1
                        ? 'text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive'
                        : 'opacity-20 cursor-not-allowed')}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button onClick={addRow}
              className="inline-flex items-center gap-2 rounded-xl border border-success/20 bg-success/8 px-4 py-2 text-sm font-medium text-success transition-all hover:bg-success/15 hover:border-success/30">
              <Plus className="h-3.5 w-3.5" /> Add Size
            </button>
          </div>

          {/* Pricing */}
          <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-6">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <span className="text-sm font-bold">₨</span>
              </div>
              <h3 className="text-sm font-semibold">Cost Breakdown</h3>
              <span className="ml-auto text-xs text-muted-foreground">All values in PKR</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Unit Cost (PKR) *</FieldLabel>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₨</span>
                  <Input type="number" value={costPKR} onChange={e => setCostPKR(e.target.value)}
                    placeholder="e.g. 14500"
                    className="pl-7 h-11 bg-[#111] border-white/10 focus:border-primary/40 tabular" />
                </div>
                {costPKR && <p className="mt-1 text-[10px] text-muted-foreground">≈ {formatUSD(Number(costPKR) / exchangeRate)}</p>}
              </div>

              <div>
                <FieldLabel>Commission (PKR)</FieldLabel>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₨</span>
                  <Input type="number" value={commissionPKR} onChange={e => setCommissionPKR(e.target.value)}
                    placeholder="e.g. 1500"
                    className="pl-7 h-11 bg-[#111] border-white/10 focus:border-primary/40 tabular" />
                </div>
                {commissionPKR && <p className="mt-1 text-[10px] text-muted-foreground">≈ {formatUSD(Number(commissionPKR) / exchangeRate)}</p>}
              </div>

              <div>
                <FieldLabel>Shipping (PKR)</FieldLabel>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₨</span>
                  <Input type="number" value={shippingPKR} onChange={e => setShippingPKR(e.target.value)}
                    placeholder="e.g. 500"
                    className="pl-7 h-11 bg-[#111] border-white/10 focus:border-primary/40 tabular" />
                </div>
                {shippingPKR && Number(shippingPKR) > 0 && <p className="mt-1 text-[10px] text-muted-foreground">≈ {formatUSD(Number(shippingPKR) / exchangeRate)}</p>}
              </div>

              <div>
                <FieldLabel>Source</FieldLabel>
                <select value={source} onChange={e => setSource(e.target.value as typeof SOURCES[number])} className={selectClass}>
                  <option value="prebook">Pre-book</option>
                  <option value="released">Released</option>
                </select>
              </div>

              <div>
                <FieldLabel>Paid to Wajid</FieldLabel>
                <select
                  value={paidToWajid ? 'yes' : 'no'}
                  onChange={e => setPaidToWajid(e.target.value === 'yes')}
                  className={selectClass}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <FieldLabel>Notes <span className="font-normal lowercase tracking-normal text-muted-foreground/50">(optional)</span></FieldLabel>
                <Input value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. limited colourway, ETA 2 weeks"
                  className="h-11 bg-[#111] border-white/10 focus:border-primary/40" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Cost Preview sidebar ── */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-6 sticky top-8">
            <h3 className="text-sm font-semibold mb-5 pb-4 border-b border-white/5">Cost Preview</h3>

            <div className="space-y-3">
              {/* Units */}
              <div className="rounded-xl bg-white/[0.03] px-4 py-3 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Pieces</span>
                <span className="text-xl font-bold num-display">{totalUnits}</span>
              </div>

              {/* Per-unit all-in */}
              <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Unit Cost (all-in)</div>
                <div className="text-2xl font-bold num-display text-foreground">
                  {cost.unitPKR ? formatPKR(cost.unitPKR) : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {cost.unitUSD ? formatUSD(cost.unitUSD) : ''}
                </div>
              </div>

              {/* Line total */}
              {totalUnits > 1 && cost.unitPKR > 0 && (
                <div className="rounded-xl bg-white/[0.03] px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Total ({totalUnits} pcs)
                  </div>
                  <div className="text-xl font-bold num-display">{formatPKR(cost.linePKR)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{formatUSD(cost.lineUSD)}</div>
                </div>
              )}

              {/* Suggested sell — USD primary */}
              <div className="rounded-xl border border-primary/20 bg-primary/8 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-primary/70 mb-2">Suggested Sell Price</div>
                <div className="text-2xl font-bold text-primary num-display">
                  {cost.sellUSD ? formatUSD(cost.sellUSD) : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {cost.sellPKR ? formatPKR(cost.sellPKR) : ''}
                </div>
              </div>

            </div>

            <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}
              className="w-full mt-6 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm">
              {isSubmitting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding…</>
                : <><PackagePlus className="mr-2 h-4 w-4" /> Add to Stock</>
              }
            </Button>

            {!isValid && (
              <p className="mt-3 text-center text-[11px] text-muted-foreground/60">
                {!collectionId ? 'Select brand & collection' : !articleName.trim() ? 'Enter article name' : !costPKR ? 'Enter unit cost' : 'Add at least one size'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
