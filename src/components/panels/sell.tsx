'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPKR, formatUSD, suggestedSellPrice } from '@/lib/data'
import { recordSale } from '@/lib/actions'
import { CHANNELS } from '@/lib/types'
import type { ArticleInventory } from '@/lib/types'
import { Loader2, Search, ShoppingCart, User, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SellProps {
  inventory: ArticleInventory[]
  exchangeRate: number
  onSuccess?: () => void
}

interface SizeToSell {
  skuId: string
  size: string
  available: number
  avgCostPKR: number
  avgExchangeRate: number
  quantity: number
  sellingPrice: string
}

export function Sell({ inventory, exchangeRate, onSuccess }: SellProps) {
  const router = useRouter()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<ArticleInventory | null>(null)
  const [sizesToSell, setSizesToSell] = useState<SizeToSell[]>([])
  const [channel, setChannel] = useState<typeof CHANNELS[number]>(CHANNELS[0])
  const [clientName, setClientName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const dropdownRef = useRef<HTMLDivElement>(null)

  const inStockInventory = useMemo(() => {
    return inventory.filter(item => item.totalQuantity > 0)
  }, [inventory])

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return inStockInventory
    const term = searchTerm.toLowerCase()
    return inStockInventory.filter(item =>
      item.articleName.toLowerCase().includes(term) ||
      item.brandName.toLowerCase().includes(term) ||
      item.collectionName.toLowerCase().includes(term) ||
      item.skus.some(s => s.size.toLowerCase().includes(term))
    )
  }, [inStockInventory, searchTerm])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectArticle = (article: ArticleInventory) => {
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
          sellingPrice: String(suggestedSellPrice(s.avgCostPKR, 0, 0)),
        }))
    )
  }

  const updateSizeToSell = (skuId: string, field: 'quantity' | 'sellingPrice', value: string | number) => {
    setSizesToSell(prev =>
      prev.map(s => s.skuId === skuId ? { ...s, [field]: value } : s)
    )
  }

  const resetForm = () => {
    setSearchTerm('')
    setSelectedArticle(null)
    setSizesToSell([])
    setChannel(CHANNELS[0])
    setClientName('')
  }

  const handleSubmit = async () => {
    const toSell = sizesToSell.filter(s => s.quantity > 0 && s.quantity <= s.available)
    if (toSell.length === 0) return

    setIsSubmitting(true)
    try {
      for (const item of toSell) {
        await recordSale(
          item.skuId,
          item.quantity,
          Number(item.sellingPrice),
          channel,
          clientName.trim(),
          item.avgCostPKR,
          item.avgExchangeRate || exchangeRate
        )
      }

      router.refresh()
      resetForm()
      onSuccess?.()
    } catch (error) {
      console.error('Error recording sale:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasValidSale = sizesToSell.some(s => s.quantity > 0 && s.quantity <= s.available && Number(s.sellingPrice) > 0)

  const totalRevenue = sizesToSell.reduce((sum, s) => {
    if (s.quantity > 0 && Number(s.sellingPrice) > 0) {
      return sum + (Number(s.sellingPrice) * s.quantity)
    }
    return sum
  }, 0)

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight mb-1">
          Record Sale
        </h2>
        <p className="text-sm text-muted-foreground">
          Process a new sale from your inventory
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">Select Item</h3>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Search inventory
              </Label>
              <div className="relative" ref={dropdownRef}>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setShowDropdown(true)
                    if (selectedArticle && e.target.value !== selectedArticle.articleName) {
                      setSelectedArticle(null)
                      setSizesToSell([])
                    }
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Type brand, article, size..."
                  className="pl-11 h-12 bg-white/[0.03] border-white/10 focus:border-primary/40"
                  autoComplete="off"
                />
                
                {showDropdown && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[280px] overflow-y-auto rounded-xl border border-white/10 bg-[#141210] shadow-2xl">
                    {filteredItems.length > 0 ? (
                      filteredItems.map(item => (
                        <div
                          key={item.articleId}
                          onClick={() => selectArticle(item)}
                          className="cursor-pointer px-4 py-3 transition-colors hover:bg-white/[0.05] border-b border-white/5 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-semibold text-primary">{item.brandName}</div>
                              <div className="text-sm text-foreground">{item.articleName}</div>
                              <div className="text-xs text-muted-foreground">{item.collectionName}</div>
                            </div>
                            <div className="flex gap-1.5">
                              {item.skus.filter(s => s.quantity > 0).map(s => (
                                <span key={s.skuId} className="inline-flex items-center rounded-lg bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  {s.size}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No items found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Item Card */}
            {selectedArticle && (
              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Brand</span>
                    <span className="font-semibold text-primary">{selectedArticle.brandName}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Article</span>
                    <span className="font-medium">{selectedArticle.articleName}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Collection</span>
                    <span>{selectedArticle.collectionName}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sizes to Sell */}
          {sizesToSell.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/20 text-success">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">Select Sizes & Quantities</h3>
              </div>
              
              <div className="space-y-3">
                {sizesToSell.map(item => (
                  <div
                    key={item.skuId}
                    className={cn(
                      "grid grid-cols-[1fr_100px_140px] items-center gap-4 rounded-xl border p-4 transition-all",
                      item.quantity > 0 
                        ? "border-primary/30 bg-primary/5" 
                        : "border-white/5 bg-white/[0.02]"
                    )}
                  >
                    <div>
                      <span className="text-base font-semibold">{item.size}</span>
                      <span className="ml-3 text-sm text-muted-foreground">
                        {item.available} available
                      </span>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty</Label>
                      <Input
                        type="number"
                        min="0"
                        max={item.available}
                        value={item.quantity || ''}
                        onChange={(e) => updateSizeToSell(item.skuId, 'quantity', Number(e.target.value))}
                        className="h-10 bg-white/[0.03] border-white/10 focus:border-primary/40"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Price (PKR)</Label>
                      <Input
                        type="number"
                        value={item.sellingPrice}
                        onChange={(e) => updateSizeToSell(item.skuId, 'sellingPrice', e.target.value)}
                        className="h-10 bg-white/[0.03] border-white/10 focus:border-primary/40"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Channel & Client */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                <User className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">Sale Details</h3>
            </div>
            
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Sale Channel
                </Label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as typeof CHANNELS[number])}
                  className="flex h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm transition-all focus:border-primary/40 focus:outline-none"
                >
                  {CHANNELS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Client Name (optional)
                </Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Mrs. Ahmed"
                  className="h-11 bg-white/[0.03] border-white/10 focus:border-primary/40"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sale Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="glass rounded-2xl p-6 sticky top-8">
            <h3 className="text-base font-semibold mb-5 pb-4 border-b border-white/5">
              Sale Summary
            </h3>
            
            <div className="space-y-4">
              <div className="rounded-xl bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Items Selected</div>
                <div className="text-2xl font-bold">
                  {sizesToSell.filter(s => s.quantity > 0).length}
                </div>
              </div>
              
              <div className="rounded-xl bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total Quantity</div>
                <div className="text-2xl font-bold">
                  {sizesToSell.reduce((sum, s) => sum + s.quantity, 0)}
                </div>
              </div>
              
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
                <div className="text-xs uppercase tracking-wider text-primary/70 mb-1">Total Revenue (PKR)</div>
                <div className="text-2xl font-bold text-primary">
                  {totalRevenue > 0 ? formatPKR(totalRevenue) : '---'}
                </div>
              </div>
              
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
                <div className="text-xs uppercase tracking-wider text-primary/70 mb-1">Total Revenue (USD)</div>
                <div className="text-2xl font-bold text-primary">
                  {totalRevenue > 0 ? formatUSD(totalRevenue / exchangeRate) : '---'}
                </div>
              </div>
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={!hasValidSale || isSubmitting}
              className="w-full mt-6 h-12 bg-success text-success-foreground hover:bg-success/90 font-semibold"
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
