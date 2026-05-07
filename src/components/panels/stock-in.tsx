'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPKR, formatUSD, totalCostPKR, suggestedSellPrice } from '@/lib/data'
import { stockIn } from '@/lib/actions'
import { SIZES, SOURCES } from '@/lib/types'
import type { BrandWithCollections } from '@/lib/types'
import { Plus, X, Loader2, PackagePlus, DollarSign, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SizeRow {
  id: number
  size: string
  quantity: number
}

interface StockInProps {
  brands: BrandWithCollections[]
  exchangeRate: number
  onSuccess?: () => void
}

export function StockIn({ brands, exchangeRate, onSuccess }: StockInProps) {
  const router = useRouter()
  
  const [brandId, setBrandId] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [articleName, setArticleName] = useState('')
  const [sizeRows, setSizeRows] = useState<SizeRow[]>([{ id: 0, size: 'M', quantity: 1 }])
  const [costPKR, setCostPKR] = useState('')
  const [commissionPKR, setCommissionPKR] = useState('')
  const [shippingPKR, setShippingPKR] = useState('0')
  const [source, setSource] = useState<typeof SOURCES[number]>('prebook')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nextId, setNextId] = useState(1)

  const selectedBrand = brands.find(b => b.id === brandId)
  const collections = selectedBrand?.collections || []

  const cost = useMemo(() => {
    const c = Number(costPKR) || 0
    const co = Number(commissionPKR) || 0
    const sh = Number(shippingPKR) || 0
    const total = totalCostPKR(c, co, sh)
    const sell = suggestedSellPrice(c, co, sh)
    return { 
      totalPKR: total, 
      totalUSD: total / exchangeRate,
      sellPKR: sell,
      sellUSD: sell / exchangeRate
    }
  }, [costPKR, commissionPKR, shippingPKR, exchangeRate])

  const addSizeRow = () => {
    setSizeRows([...sizeRows, { id: nextId, size: 'M', quantity: 1 }])
    setNextId(nextId + 1)
  }

  const removeSizeRow = (id: number) => {
    if (sizeRows.length > 1) {
      setSizeRows(sizeRows.filter(r => r.id !== id))
    }
  }

  const updateSizeRow = (id: number, field: 'size' | 'quantity', value: string | number) => {
    setSizeRows(sizeRows.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    ))
  }

  const resetForm = () => {
    setBrandId('')
    setCollectionId('')
    setArticleName('')
    setSizeRows([{ id: 0, size: 'M', quantity: 1 }])
    setCostPKR('')
    setCommissionPKR('')
    setShippingPKR('0')
    setSource('prebook')
    setNotes('')
    setNextId(1)
  }

  const handleSubmit = async () => {
    if (!collectionId || !articleName.trim() || !costPKR) {
      return
    }

    const validSizes = sizeRows.filter(r => r.quantity > 0)
    if (validSizes.length === 0) return

    setIsSubmitting(true)
    try {
      await stockIn(
        articleName.trim(),
        collectionId,
        validSizes.map(r => ({ size: r.size, quantity: r.quantity })),
        Number(costPKR),
        Number(commissionPKR) || 0,
        Number(shippingPKR) || 0,
        exchangeRate,
        source,
        notes.trim()
      )
      
      router.refresh()
      resetForm()
      onSuccess?.()
    } catch (error) {
      console.error('Error stocking in:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid = collectionId && articleName.trim() && costPKR && sizeRows.some(r => r.quantity > 0)

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight mb-1">
          Stock In
        </h2>
        <p className="text-sm text-muted-foreground">
          Add new inventory items to your stock
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Item Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Tag className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">Item Details</h3>
            </div>
            
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Brand
                </Label>
                <select
                  value={brandId}
                  onChange={(e) => {
                    setBrandId(e.target.value)
                    setCollectionId('')
                  }}
                  className="flex h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm transition-all focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                >
                  <option value="">Select brand...</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Collection
                </Label>
                <select
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm transition-all focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
                  disabled={!brandId}
                >
                  <option value="">{brandId ? 'Select collection...' : 'Select brand first...'}</option>
                  {collections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Article Name <span className="font-normal text-muted-foreground/60">(auto-creates if new)</span>
                </Label>
                <Input
                  value={articleName}
                  onChange={(e) => setArticleName(e.target.value)}
                  placeholder="e.g. Muzlin 3-Piece Embroidered"
                  className="h-11 bg-white/[0.03] border-white/10 focus:border-primary/40"
                />
              </div>
            </div>
          </div>

          {/* Sizes & Quantities */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                <PackagePlus className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">Sizes & Quantities</h3>
            </div>
            
            <div className="mb-4 space-y-3">
              {sizeRows.map((row) => (
                <div 
                  key={row.id} 
                  className="grid grid-cols-[1fr_1fr_40px] items-end gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4"
                >
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Size
                    </Label>
                    <select
                      value={row.size}
                      onChange={(e) => updateSizeRow(row.id, 'size', e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm transition-all focus:border-primary/40 focus:outline-none"
                    >
                      {SIZES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Quantity
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => updateSizeRow(row.id, 'quantity', Number(e.target.value))}
                      className="h-10 bg-white/[0.03] border-white/10 focus:border-primary/40"
                    />
                  </div>
                  <button
                    onClick={() => removeSizeRow(row.id)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 transition-all",
                      sizeRows.length > 1 
                        ? "text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        : "opacity-30 cursor-not-allowed"
                    )}
                    disabled={sizeRows.length <= 1}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addSizeRow}
              className="inline-flex items-center gap-2 rounded-xl border border-success/20 bg-success/10 px-4 py-2.5 text-sm font-medium text-success transition-all hover:bg-success/20"
            >
              <Plus className="h-4 w-4" /> Add Size
            </button>
          </div>

          {/* Pricing */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <DollarSign className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">Pricing</h3>
            </div>
            
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Unit Cost (PKR)
                </Label>
                <Input
                  type="number"
                  value={costPKR}
                  onChange={(e) => setCostPKR(e.target.value)}
                  placeholder="e.g. 14500"
                  className="h-11 bg-white/[0.03] border-white/10 focus:border-primary/40"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Commission (PKR)
                </Label>
                <Input
                  type="number"
                  value={commissionPKR}
                  onChange={(e) => setCommissionPKR(e.target.value)}
                  placeholder="e.g. 1500"
                  className="h-11 bg-white/[0.03] border-white/10 focus:border-primary/40"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Shipping (PKR)
                </Label>
                <Input
                  type="number"
                  value={shippingPKR}
                  onChange={(e) => setShippingPKR(e.target.value)}
                  placeholder="e.g. 500"
                  className="h-11 bg-white/[0.03] border-white/10 focus:border-primary/40"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Source
                </Label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as typeof SOURCES[number])}
                  className="flex h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm transition-all focus:border-primary/40 focus:outline-none"
                >
                  <option value="prebook">Pre-book</option>
                  <option value="released">Released</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Notes (optional)
                </Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. limited colourway, ETA 2 weeks"
                  className="h-11 bg-white/[0.03] border-white/10 focus:border-primary/40"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Cost Preview Sidebar */}
        <div className="lg:col-span-1">
          <div className="glass rounded-2xl p-6 sticky top-8">
            <h3 className="text-base font-semibold mb-5 pb-4 border-b border-white/5">
              Cost Preview
            </h3>
            
            <div className="space-y-4">
              <div className="rounded-xl bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total Cost (PKR)</div>
                <div className="text-2xl font-bold">
                  {cost.totalPKR ? formatPKR(cost.totalPKR) : '---'}
                </div>
              </div>
              
              <div className="rounded-xl bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total Cost (USD)</div>
                <div className="text-2xl font-bold text-success">
                  {cost.totalUSD ? formatUSD(cost.totalUSD) : '---'}
                </div>
              </div>
              
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
                <div className="text-xs uppercase tracking-wider text-primary/70 mb-1">Suggested Sell (PKR)</div>
                <div className="text-2xl font-bold text-primary">
                  {cost.sellPKR ? formatPKR(cost.sellPKR) : '---'}
                </div>
              </div>
              
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
                <div className="text-xs uppercase tracking-wider text-primary/70 mb-1">Suggested Sell (USD)</div>
                <div className="text-2xl font-bold text-primary">
                  {cost.sellUSD ? formatUSD(cost.sellUSD) : '---'}
                </div>
              </div>
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="w-full mt-6 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add to Stock
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
