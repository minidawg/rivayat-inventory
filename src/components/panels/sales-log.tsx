'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatPKR, formatUSD, formatDate } from '@/lib/data'
import { deleteSale } from '@/lib/actions'
import type { SaleRow } from '@/lib/types'
import { Download, Trash2, TrendingUp, TrendingDown, DollarSign, Calendar, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SalesLogProps {
  sales: SaleRow[]
  exchangeRate: number
  onSuccess?: () => void
}

type DateFilter = 'all' | '7d' | '30d' | '90d' | 'ytd'

export function SalesLog({ sales, exchangeRate, onSuccess }: SalesLogProps) {
  const router = useRouter()
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId]   = useState<string | null>(null)

  const filteredSales = useMemo(() => {
    if (dateFilter === 'all') return sales
    const now = new Date()
    let cutoff: Date
    switch (dateFilter) {
      case '7d':  cutoff = new Date(now.getTime() - 7  * 86400000); break
      case '30d': cutoff = new Date(now.getTime() - 30 * 86400000); break
      case '90d': cutoff = new Date(now.getTime() - 90 * 86400000); break
      case 'ytd': cutoff = new Date(now.getFullYear(), 0, 1); break
      default:    return sales
    }
    return sales.filter(s => new Date(s.createdAt) >= cutoff)
  }, [sales, dateFilter])

  // sellingPrice is stored as USD
  const stats = useMemo(() => {
    const totalRevUSD = filteredSales.reduce((s, x) => s + x.sellingPrice * x.quantity, 0)
    const totalCostUSD = filteredSales.reduce((s, x) => {
      const rate = x.exchangeRateAtSale || exchangeRate
      return s + (x.costPKRAtSale || 0) / rate * x.quantity
    }, 0)
    const totalProfitUSD = totalRevUSD - totalCostUSD
    return { totalRevUSD, totalProfitUSD, count: filteredSales.length }
  }, [filteredSales, exchangeRate])

  const handleDelete = async (saleId: string) => {
    setDeletingId(saleId)
    try {
      await deleteSale(saleId)
      router.refresh(); onSuccess?.()
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null); setConfirmId(null)
    }
  }

  const exportCSV = () => {
    const rows = [['Date','Brand','Article','Size','Qty','Revenue USD','Revenue PKR','Cost PKR','Profit USD','Profit PKR','Channel','Client']]
    for (const s of filteredSales) {
      const rate = s.exchangeRateAtSale || exchangeRate
      const revUSD  = s.sellingPrice * s.quantity
      const revPKR  = revUSD * rate
      const costPKR = (s.costPKRAtSale || 0) * s.quantity
      const profUSD = revUSD - costPKR / rate
      rows.push([formatDate(s.createdAt), s.brandName, s.articleName, s.size,
        String(s.quantity), revUSD.toFixed(2), Math.round(revPKR).toString(),
        Math.round(costPKR).toString(), profUSD.toFixed(2), Math.round(profUSD * rate).toString(),
        s.channel || '', s.clientName || ''])
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')], { type: 'text/csv' }))
    a.download = `sales-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const filters: { id: DateFilter; label: string }[] = [
    { id: 'all', label: 'All Time' }, { id: '7d', label: '7 Days' },
    { id: '30d', label: '30 Days' }, { id: '90d', label: '90 Days' },
    { id: 'ytd', label: 'YTD' },
  ]

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[1.9rem] font-semibold tracking-tight leading-none mb-1">Sales Log</h2>
          <p className="text-sm text-muted-foreground">Complete transaction history · prices in USD</p>
        </div>
        <Button onClick={exportCSV} size="sm"
          className="gap-2 border border-primary/20 bg-primary/8 text-primary hover:bg-primary/15 hover:border-primary/30">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { icon: DollarSign, bg: 'bg-primary/10', fg: 'text-primary',  label: 'Revenue', value: formatUSD(stats.totalRevUSD) },
          { icon: TrendingUp, bg: 'bg-success/10', fg: 'text-success',  label: 'Profit',  value: formatUSD(stats.totalProfitUSD) },
          { icon: Calendar,   bg: 'bg-blue-500/10', fg: 'text-blue-400', label: 'Sales',   value: stats.count.toString() },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', card.bg)}>
                <card.icon className={cn('h-4.5 w-4.5', card.fg)} />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</div>
                <div className={cn('text-xl font-bold num-display', card.fg)}>{card.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Date filters */}
      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map(f => (
          <button key={f.id} onClick={() => setDateFilter(f.id)}
            className={cn('rounded-xl border px-4 py-1.5 text-sm font-medium transition-all',
              dateFilter === f.id ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-white/8 bg-white/[0.02] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground')}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredSales.length === 0 ? (
        <div className="py-20 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground">No sales in this period</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.015]">
                  {['Date','Item','Size','Qty','Revenue (USD)','Cost (PKR)','Profit','Channel','Client',''].map(h => (
                    <th key={h} className="whitespace-nowrap px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(s => {
                  const rate    = s.exchangeRateAtSale || exchangeRate
                  const revUSD  = s.sellingPrice * s.quantity
                  const costPKR = (s.costPKRAtSale || 0) * s.quantity
                  const costUSD = costPKR / rate
                  const profUSD = revUSD - costUSD
                  const profPKR = profUSD * rate
                  const isPos   = profUSD >= 0

                  return (
                    <>
                      <tr key={s.id}
                        className={cn('border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]',
                          confirmId === s.id && 'bg-destructive/5')}>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(s.createdAt)}
                        </td>
                        <td className="px-4 py-3.5 max-w-[140px]">
                          <div className="text-[11px] font-semibold text-primary truncate">{s.brandName}</div>
                          <div className="font-medium truncate">{s.articleName}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center rounded-md bg-white/[0.05] px-2 py-0.5 text-xs font-medium">{s.size}</span>
                        </td>
                        <td className="px-4 py-3.5 tabular font-semibold">{s.quantity}</td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-primary tabular">{formatUSD(revUSD)}</div>
                          <div className="text-[11px] text-muted-foreground tabular">{formatPKR(revUSD * rate)}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          {s.costPKRAtSale ? (
                            <>
                              <div className="tabular">{formatPKR(costPKR)}</div>
                              <div className="text-[11px] text-muted-foreground tabular">{formatUSD(costUSD)}</div>
                            </>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className={cn('flex items-center gap-1 font-semibold tabular', isPos ? 'text-success' : 'text-destructive')}>
                            {isPos ? <TrendingUp className="h-3 w-3 shrink-0" /> : <TrendingDown className="h-3 w-3 shrink-0" />}
                            {formatUSD(profUSD)}
                          </div>
                          <div className="text-[11px] text-muted-foreground tabular">{formatPKR(profPKR)}</div>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{s.channel || '—'}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">{s.clientName || '—'}</td>
                        <td className="px-4 py-3.5">
                          {confirmId === s.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(s.id)} disabled={deletingId === s.id}
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 transition-all disabled:opacity-50">
                                {deletingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              </button>
                              <button onClick={() => setConfirmId(null)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-muted-foreground hover:bg-white/10 transition-all">
                                ×
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmId(s.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.02] text-muted-foreground transition-all hover:border-destructive/30 hover:bg-destructive/8 hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                      {confirmId === s.id && (
                        <tr key={`${s.id}-confirm`} className="border-b border-destructive/10 bg-destructive/5">
                          <td colSpan={10} className="px-4 py-2 text-xs text-destructive/80">
                            Delete this sale? Stock will be restored. Click the red trash icon to confirm.
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
