'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { formatPKR, formatUSD, formatDate, totalCostPKR } from '@/lib/data'
import type { PurchaseRow } from '@/lib/types'
import { Download, Package, Calendar, TrendingDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

interface PurchaseLogProps {
  purchases: PurchaseRow[]
  exchangeRate: number
}

type DateFilter = 'all' | '7d' | '30d' | '90d' | 'ytd'

export function PurchaseLog({ purchases, exchangeRate }: PurchaseLogProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [search,     setSearch]     = useState('')

  const filtered = useMemo(() => {
    let list = purchases

    if (dateFilter !== 'all') {
      const now = new Date()
      let cutoff: Date
      switch (dateFilter) {
        case '7d':  cutoff = new Date(now.getTime() - 7  * 86400000); break
        case '30d': cutoff = new Date(now.getTime() - 30 * 86400000); break
        case '90d': cutoff = new Date(now.getTime() - 90 * 86400000); break
        case 'ytd': cutoff = new Date(now.getFullYear(), 0, 1); break
        default:    cutoff = new Date(0)
      }
      list = list.filter(p => new Date(p.createdAt) >= cutoff)
    }

    if (search.trim()) {
      const t = search.toLowerCase()
      list = list.filter(p =>
        p.articleName.toLowerCase().includes(t) ||
        p.brandName.toLowerCase().includes(t) ||
        p.collectionName.toLowerCase().includes(t)
      )
    }

    return list
  }, [purchases, dateFilter, search])

  const stats = useMemo(() => {
    const totalCostPKRVal = filtered.reduce((s, p) =>
      s + totalCostPKR(p.costPKR, p.commissionPKR, p.shippingPKR) * p.quantity, 0)
    const totalQty   = filtered.reduce((s, p) => s + p.quantity, 0)
    const totalLines = filtered.length
    const avgUnitPKR = totalQty > 0 ? totalCostPKRVal / totalQty : 0
    // weighted average USD using each purchase's rate
    const totalCostUSD = filtered.reduce((s, p) =>
      s + totalCostPKR(p.costPKR, p.commissionPKR, p.shippingPKR) * p.quantity / p.exchangeRate, 0)
    return { totalCostPKRVal, totalCostUSD, totalQty, totalLines, avgUnitPKR }
  }, [filtered])

  const exportCSV = () => {
    const rows = [['Date','Brand','Collection','Article','Size','Qty','Unit Cost PKR','Commission PKR','Shipping PKR','All-in/Unit PKR','Line Total PKR','Line Total USD','Rate','Source','Notes']]
    for (const p of filtered) {
      const unitAllIn = totalCostPKR(p.costPKR, p.commissionPKR, p.shippingPKR)
      const lineTotal = unitAllIn * p.quantity
      rows.push([
        formatDate(p.createdAt), p.brandName, p.collectionName, p.articleName,
        p.size, String(p.quantity),
        String(p.costPKR), String(p.commissionPKR), String(p.shippingPKR),
        String(Math.round(unitAllIn)), String(Math.round(lineTotal)),
        (lineTotal / p.exchangeRate).toFixed(2),
        String(p.exchangeRate), p.source || '', p.notes || '',
      ])
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')], { type: 'text/csv' }))
    a.download = `purchases-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const dateFilters: { id: DateFilter; label: string }[] = [
    { id: 'all', label: 'All Time' }, { id: '7d', label: '7 Days' },
    { id: '30d', label: '30 Days' }, { id: '90d', label: '90 Days' },
    { id: 'ytd', label: 'YTD' },
  ]

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[1.9rem] font-semibold tracking-tight leading-none mb-1">
            Purchase Log
          </h2>
          <p className="text-sm text-muted-foreground">All inventory purchases · costs in PKR</p>
        </div>
        <Button onClick={exportCSV} size="sm"
          className="gap-2 border border-primary/20 bg-primary/8 text-primary hover:bg-primary/15 hover:border-primary/30">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            icon: TrendingDown, bg: 'bg-destructive/10', fg: 'text-destructive',
            label: 'Total Spent',
            primary: formatPKR(stats.totalCostPKRVal),
            secondary: formatUSD(stats.totalCostUSD),
          },
          {
            icon: Package, bg: 'bg-blue-500/10', fg: 'text-blue-400',
            label: 'Items Purchased',
            primary: stats.totalQty.toString(),
            secondary: 'pieces',
          },
          {
            icon: Calendar, bg: 'bg-success/10', fg: 'text-success',
            label: 'Purchase Orders',
            primary: stats.totalLines.toString(),
            secondary: 'records',
          },
          {
            icon: Package, bg: 'bg-primary/10', fg: 'text-primary',
            label: 'Avg Unit Cost',
            primary: stats.avgUnitPKR > 0 ? formatPKR(stats.avgUnitPKR) : '—',
            secondary: stats.avgUnitPKR > 0 ? formatUSD(stats.avgUnitPKR / exchangeRate) : '',
          },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', card.bg)}>
                <card.icon className={cn('h-4 w-4', card.fg)} />
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</div>
            </div>
            <div className="text-xl font-bold num-display">{card.primary}</div>
            {card.secondary && <div className="text-xs text-muted-foreground mt-0.5">{card.secondary}</div>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search article, brand…"
            className="pl-9 h-9 bg-[#111] border-white/10 focus:border-primary/40 text-sm w-48" />
        </div>
        <div className="flex flex-wrap gap-2">
          {dateFilters.map(f => (
            <button key={f.id} onClick={() => setDateFilter(f.id)}
              className={cn('rounded-xl border px-3.5 py-1.5 text-sm font-medium transition-all',
                dateFilter === f.id
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-white/8 bg-white/[0.02] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground">No purchases in this period</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.015]">
                  {['Date','Item','Size','Qty','Unit Cost','Fees','Line Total','Source','Notes'].map(h => (
                    <th key={h} className="whitespace-nowrap px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => {
                  const unitAllIn = totalCostPKR(p.costPKR, p.commissionPKR, p.shippingPKR)
                  const lineTotal = unitAllIn * p.quantity
                  const fees      = p.commissionPKR + p.shippingPKR

                  return (
                    <tr key={p.id}
                      className={cn(
                        'border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]',
                        idx % 2 === 1 && 'bg-white/[0.012]',
                      )}>
                      {/* Date */}
                      <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(p.createdAt)}
                      </td>

                      {/* Item */}
                      <td className="px-4 py-3.5 max-w-[160px]">
                        <div className="text-[11px] font-semibold text-primary truncate">{p.brandName}</div>
                        <div className="font-medium truncate">{p.articleName}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{p.collectionName}</div>
                      </td>

                      {/* Size */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center rounded-md bg-white/[0.05] px-2 py-0.5 text-xs font-medium">{p.size}</span>
                      </td>

                      {/* Qty */}
                      <td className="px-4 py-3.5 tabular font-semibold">{p.quantity}</td>

                      {/* Unit Cost */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium tabular">{formatPKR(p.costPKR)}</div>
                        <div className="text-[11px] text-muted-foreground tabular">{formatUSD(p.costPKR / p.exchangeRate)}</div>
                      </td>

                      {/* Fees */}
                      <td className="px-4 py-3.5">
                        {fees > 0 ? (
                          <>
                            <div className="tabular">{formatPKR(fees)}</div>
                            <div className="text-[11px] text-muted-foreground tabular">{formatUSD(fees / p.exchangeRate)}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>

                      {/* Line total (unit all-in × qty) */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-foreground tabular">{formatPKR(lineTotal)}</div>
                        <div className="text-[11px] text-muted-foreground tabular">{formatUSD(lineTotal / p.exchangeRate)}</div>
                        {p.quantity > 1 && (
                          <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {formatPKR(unitAllIn)}/pc
                          </div>
                        )}
                      </td>

                      {/* Source badge */}
                      <td className="px-4 py-3.5">
                        {p.source ? (
                          <span className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                            p.source === 'prebook'
                              ? 'bg-success/12 text-success border border-success/20'
                              : 'bg-amber-500/12 text-amber-400 border border-amber-500/20',
                          )}>
                            {p.source}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-3.5 max-w-[160px]">
                        {p.notes ? (
                          <span className="text-xs text-muted-foreground line-clamp-2" title={p.notes}>{p.notes}</span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Footer totals */}
              {filtered.length > 1 && (
                <tfoot>
                  <tr className="border-t border-white/8 bg-white/[0.02]">
                    <td colSpan={3} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {filtered.length} records
                    </td>
                    <td className="px-4 py-3 tabular font-bold">{stats.totalQty}</td>
                    <td colSpan={2} />
                    <td className="px-4 py-3">
                      <div className="font-bold tabular">{formatPKR(stats.totalCostPKRVal)}</div>
                      <div className="text-xs text-muted-foreground tabular">{formatUSD(stats.totalCostUSD)}</div>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
