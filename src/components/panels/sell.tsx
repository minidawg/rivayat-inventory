'use client'

import { useState, useMemo, useRef, useEffect, useId } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPKR, formatUSD } from '@/lib/data'
import { recordSale } from '@/lib/actions'
import { CHANNELS, PAYMENT_METHODS } from '@/lib/types'
import type { ArticleInventory } from '@/lib/types'
import { Loader2, Search, ShoppingCart, User, CheckCircle2, X, Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SellProps {
  inventory: ArticleInventory[]
  exchangeRate: number
  previousClients: string[]
  onSuccess?: () => void
}

interface SizeToSell {
  skuId: string
  size: string
  available: number
  avgCostPKR: number
  avgExchangeRate: number
  quantity: number
  sellingPriceUSD: string   // primary: USD
}

interface SaleSummary {
  items: { size: string; qty: number; priceUSD: number }[]
  totalUSD: number
  totalPKR: number
  costPKR: number
  profitUSD: number
  profitPKR: number
}

export function Sell({ inventory, exchangeRate, previousClients, onSuccess }: SellProps) {
  const router   = useRouter()
  const clientId = useId()

  const [searchTerm,       setSearchTerm]       = useState('')
  const [showDropdown,     setShowDropdown]     = useState(false)
  const [selectedArticle,  setSelectedArticle]  = useState<ArticleInventory | null>(null)
  const [sizesToSell,      setSizesToSell]      = useState<SizeToSell[]>([])
  const [channel,          setChannel]          = useState<typeof CHANNELS[number]>(CHANNELS[0])
  const [paymentMethod,    setPaymentMethod]    = useState<typeof PAYMENT_METHODS[number]>(PAYMENT_METHODS[0])
  const [clientName,       setClientName]       = useState('')
  const [isSubmitting,     setIsSubmitting]     = useState(false)
  const [successSummary,   setSuccessSummary]   = useState<SaleSummary | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)

  const inStockInventory = useMemo(() =>
    inventory.filter(i => i.totalQuantity > 0), [inventory])

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return inStockInventory
    const t = searchTerm.toLowerCase()
    return inStockInventory.filter(i =>
      i.articleName.toLowerCase().includes(t) ||
      i.brandName.toLowerCase().includes(t) ||
      i.collectionName.toLowerCase().includes(t) ||
      i.skus.some(s => s.size.toLowerCase().includes(t))
    )
  }, [inStockInventory, searchTerm])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function selectArticle(article: ArticleInventory) {
    setSelectedArticle(article)
    setSearchTerm(article.articleName)
    setShowDropdown(false)
    setSizesToSell(
      article.skus
        .filter(s => s.quantity > 0)
        .map(s => ({
          skuId: s.skuId,
          size: s.size,
          available: s.quantity,
          avgCostPKR: s.avgCostPKR,
          avgExchangeRate: s.avgExchangeRate,
          quantity: 0,
          // default suggested price in USD
          sellingPriceUSD: (s.avgCostPKR > 0 ? (s.avgCostPKR * 1.35) / exchangeRate : 0).toFixed(2),
        }))
    )
  }

  function updateField(skuId: string, field: 'quantity' | 'sellingPriceUSD', value: string | number) {
    setSizesToSell(prev => prev.map(s => s.skuId === skuId ? { ...s, [field]: value } : s))
  }

  function stepQty(skuId: string, delta: number) {
    setSizesToSell(prev => prev.map(s => {
      if (s.skuId !== skuId) return s
      return { ...s, quantity: Math.max(0, Math.min(s.available, s.quantity + delta)) }
    }))
  }

  function resetForm() {
    setSearchTerm(''); setSelectedArticle(null); setSizesToSell([])
    setChannel(CHANNELS[0]); setPaymentMethod(PAYMENT_METHODS[0]); setClientName('')
  }

  // ── Summary calc ─────────────────────────────────────────────────────────
  const summary = useMemo((): SaleSummary => {
    const active = sizesToSell.filter(s => s.quantity > 0 && Number(s.sellingPriceUSD) > 0)
    const totalUSD  = active.reduce((a, s) => a + Number(s.sellingPriceUSD) * s.quantity, 0)
    const totalPKR  = totalUSD * exchangeRate
    const costPKR   = active.reduce((a, s) => a + s.avgCostPKR * s.quantity, 0)
    const costUSD   = costPKR / exchangeRate
    const profitUSD = totalUSD - costUSD
    const profitPKR = profitUSD * exchangeRate
    return {
      items: active.map(s => ({ size: s.size, qty: s.quantity, priceUSD: Number(s.sellingPriceUSD) })),
      totalUSD, totalPKR, costPKR, profitUSD, profitPKR,
    }
  }, [sizesToSell, exchangeRate])

  const hasValidSale = summary.items.length > 0

  async function handleSubmit() {
    if (!hasValidSale) return
    setIsSubmitting(true)
    try {
      for (const item of sizesToSell.filter(s => s.quantity > 0 && Number(s.sellingPriceUSD) > 0)) {
        await recordSale(
          item.skuId,
          item.quantity,
          Number(item.sellingPriceUSD),
          channel,
          clientName.trim(),
          item.avgCostPKR,
          item.avgExchangeRate || exchangeRate,
          paymentMethod,
        )
      }
      setSuccessSummary(summary)
      router.refresh()
      resetForm()
      onSuccess?.()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Success Modal ─────────────────────────────────────────────────────────
  if (successSummary) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h2 className="font-[family-name:var(--font-display)] text-[1.9rem] font-semibold tracking-tight leading-none mb-1">Record Sale</h2>
          <p className="text-sm text-muted-foreground">Process a new sale from your inventory</p>
        </div>
        <div className="max-w-md mx-auto rounded-2xl border border-success/25 bg-success/5 p-8 text-center animate-slide-up">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <h3 className="text-xl font-semibold mb-1">Sale Recorded!</h3>
          <p className="text-sm text-muted-foreground mb-6">
            {successSummary.items.map(i => `${i.size} ×${i.qty}`).join(', ')}
          </p>

          <div className="space-y-3 text-left mb-6">
            <div className="rounded-xl bg-white/[0.04] p-4 text-center">
              <div className="text-[10px] uppercase tracking-wider text-success/70 mb-1">Total Revenue</div>
              <div className="text-3xl font-bold text-success num-display">{formatUSD(successSummary.totalUSD)}</div>
              <div className="text-sm text-muted-foreground">{formatPKR(successSummary.totalPKR)}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/[0.03] p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Cost Basis</div>
                <div className="text-base font-semibold num-display">{formatPKR(successSummary.costPKR)}</div>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Est. Profit</div>
                <div className={cn('text-base font-semibold num-display', successSummary.profitUSD >= 0 ? 'text-success' : 'text-destructive')}>
                  {formatUSD(successSummary.profitUSD)}
                </div>
              </div>
            </div>
          </div>

          <Button onClick={() => setSuccessSummary(null)} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Record Another Sale
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h2 className="font-[family-name:var(--font-display)] text-[1.9rem] font-semibold tracking-tight leading-none mb-1">Record Sale</h2>
        <p className="text-sm text-muted-foreground">Process a new sale from your inventory</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Search */}
          <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-6">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Search className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-sm font-semibold">Select Item</h3>
            </div>
            <Label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2 block">Search inventory</Label>
            <div className="relative" ref={dropdownRef}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setShowDropdown(true); if (selectedArticle && e.target.value !== selectedArticle.articleName) { setSelectedArticle(null); setSizesToSell([]) } }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Brand, article, size…"
                className="pl-11 h-12 bg-[#111] border-white/10 focus:border-primary/40"
                autoComplete="off"
              />
              {showDropdown && filteredItems.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[260px] overflow-y-auto rounded-xl border border-white/8 bg-[#1A1A1A] shadow-2xl">
                  {filteredItems.map(item => (
                    <div key={item.articleId} onClick={() => selectArticle(item)}
                      className="cursor-pointer border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/[0.04] last:border-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-primary">{item.brandName}</div>
                          <div className="text-sm font-medium">{item.articleName}</div>
                          <div className="text-xs text-muted-foreground">{item.collectionName}</div>
                        </div>
                        <div className="flex flex-wrap gap-1 max-w-[100px] justify-end">
                          {item.skus.filter(s => s.quantity > 0).map(s => (
                            <span key={s.skuId} className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{s.size}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedArticle && (
              <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-4 text-sm">
                <div><span className="text-xs text-muted-foreground block">Brand</span><span className="font-semibold text-primary">{selectedArticle.brandName}</span></div>
                <div><span className="text-xs text-muted-foreground block">Article</span><span className="font-medium">{selectedArticle.articleName}</span></div>
                <div><span className="text-xs text-muted-foreground block">Collection</span><span className="text-muted-foreground">{selectedArticle.collectionName}</span></div>
              </div>
            )}
          </div>

          {/* Sizes */}
          {sizesToSell.length > 0 && (
            <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-6">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10 text-success">
                  <ShoppingCart className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-sm font-semibold">Sizes & Prices</h3>
                <span className="ml-auto text-xs text-muted-foreground">Prices in USD</span>
              </div>
              <div className="space-y-3">
                {sizesToSell.map(item => (
                  <div key={item.skuId} className={cn(
                    'rounded-xl border p-4 transition-all duration-200',
                    item.quantity > 0 ? 'border-primary/25 bg-primary/5' : 'border-white/6 bg-white/[0.02]',
                  )}>
                    <div className="flex items-center gap-4">
                      {/* Size + available */}
                      <div className="w-20 shrink-0">
                        <div className="text-base font-bold">{item.size}</div>
                        <div className="text-[11px] text-muted-foreground">{item.available} avail.</div>
                      </div>

                      {/* Qty stepper */}
                      <div className="space-y-1 w-28">
                        <Label className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Quantity</Label>
                        <div className="flex items-center rounded-xl border border-white/10 bg-[#111] overflow-hidden h-10">
                          <button onClick={() => stepQty(item.skuId, -1)} disabled={item.quantity <= 0}
                            className="flex h-full w-10 shrink-0 items-center justify-center text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground disabled:opacity-30">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number" min="0" max={item.available}
                            value={item.quantity || ''}
                            onChange={e => updateField(item.skuId, 'quantity', Number(e.target.value))}
                            className="flex-1 bg-transparent text-center text-sm font-semibold tabular focus:outline-none w-0"
                          />
                          <button onClick={() => stepQty(item.skuId, 1)} disabled={item.quantity >= item.available}
                            className="flex h-full w-10 shrink-0 items-center justify-center text-muted-foreground transition-all hover:bg-white/5 hover:text-primary disabled:opacity-30">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* USD price */}
                      <div className="flex-1 space-y-1">
                        <Label className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Price (USD)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">$</span>
                          <Input
                            type="number" min="0" step="0.01"
                            value={item.sellingPriceUSD}
                            onChange={e => updateField(item.skuId, 'sellingPriceUSD', e.target.value)}
                            className="pl-7 h-10 bg-[#111] border-white/10 focus:border-primary/40 tabular"
                          />
                        </div>
                        {/* PKR reference */}
                        {Number(item.sellingPriceUSD) > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            ≈ {formatPKR(Number(item.sellingPriceUSD) * exchangeRate)} PKR
                          </div>
                        )}
                      </div>

                      {/* Cost reference */}
                      {item.avgCostPKR > 0 && (
                        <div className="hidden sm:block text-right shrink-0">
                          <div className="text-[10px] text-muted-foreground">Cost basis</div>
                          <div className="text-xs font-medium">{formatUSD(item.avgCostPKR / exchangeRate)}</div>
                          <div className="text-[10px] text-muted-foreground">{formatPKR(item.avgCostPKR)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sale Details */}
          <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-6">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <User className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-sm font-semibold">Sale Details</h3>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Customer Type / Channel</Label>
                <select value={channel} onChange={e => setChannel(e.target.value as typeof CHANNELS[number])}
                  className="flex h-11 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm text-foreground focus:border-primary/40 focus:outline-none">
                  {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Payment Method</Label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as typeof PAYMENT_METHODS[number])}
                  className="flex h-11 w-full rounded-xl border border-white/10 bg-[#111] px-4 text-sm text-foreground focus:border-primary/40 focus:outline-none">
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={clientId} className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Client Name <span className="font-normal lowercase tracking-normal text-muted-foreground/60">(optional)</span>
                </Label>
                <Input
                  id={clientId}
                  list={`${clientId}-list`}
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="e.g. Mrs. Ahmed"
                  className="h-11 bg-[#111] border-white/10 focus:border-primary/40"
                  autoComplete="off"
                />
                <datalist id={`${clientId}-list`}>
                  {previousClients.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
          </div>
        </div>

        {/* Summary sidebar */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-6 sticky top-8">
            <h3 className="text-sm font-semibold mb-5 pb-4 border-b border-white/5">Sale Summary</h3>

            <div className="space-y-3">
              {/* Items selected */}
              <div className="rounded-xl bg-white/[0.03] p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Items Selected</div>
                <div className="text-2xl font-bold num-display">{summary.items.length}</div>
                <div className="text-xs text-muted-foreground">
                  {summary.items.map(i => `${i.size}×${i.qty}`).join(', ') || 'none'}
                </div>
              </div>

              {/* Total USD — primary */}
              <div className="rounded-xl border border-primary/25 bg-primary/8 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-primary/70 mb-1">Total Revenue</div>
                <div className="text-2xl font-bold text-primary num-display">
                  {summary.totalUSD > 0 ? formatUSD(summary.totalUSD) : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {summary.totalPKR > 0 ? formatPKR(summary.totalPKR) : ''}
                </div>
              </div>

              {/* Cost basis */}
              <div className="rounded-xl bg-white/[0.03] p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Cost Basis (PKR)</div>
                <div className="text-lg font-bold num-display">
                  {summary.costPKR > 0 ? formatPKR(summary.costPKR) : '—'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {summary.costPKR > 0 ? formatUSD(summary.costPKR / exchangeRate) : ''}
                </div>
              </div>

              {/* Est. profit */}
              {summary.totalUSD > 0 && (
                <div className={cn(
                  'rounded-xl p-4 border',
                  summary.profitUSD >= 0 ? 'bg-success/8 border-success/20' : 'bg-destructive/8 border-destructive/20',
                )}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Est. Profit</div>
                  <div className={cn('text-lg font-bold num-display', summary.profitUSD >= 0 ? 'text-success' : 'text-destructive')}>
                    {formatUSD(summary.profitUSD)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatPKR(summary.profitPKR)}
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!hasValidSale || isSubmitting}
              className="w-full mt-6 h-12 bg-success text-success-foreground hover:bg-success/90 font-semibold text-sm"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Sale
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
