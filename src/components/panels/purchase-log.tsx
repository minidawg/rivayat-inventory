'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { formatPKR, formatUSD, formatDate, totalCostPKR } from '@/lib/data'
import type { PurchaseRow } from '@/lib/types'
import { Download, Package, Calendar, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PurchaseLogProps {
  purchases: PurchaseRow[]
  exchangeRate: number
}

type DateFilter = 'all' | '7d' | '30d' | '90d' | 'ytd'

export function PurchaseLog({ purchases, exchangeRate }: PurchaseLogProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')

  const filteredPurchases = useMemo(() => {
    if (dateFilter === 'all') return purchases

    const now = new Date()
    let cutoff: Date

    switch (dateFilter) {
      case '7d':
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'ytd':
        cutoff = new Date(now.getFullYear(), 0, 1)
        break
      default:
        return purchases
    }

    return purchases.filter(p => new Date(p.createdAt) >= cutoff)
  }, [purchases, dateFilter])

  const stats = useMemo(() => {
    const totalCost = filteredPurchases.reduce((sum, p) => {
      return sum + totalCostPKR(p.costPKR, p.commissionPKR, p.shippingPKR) * p.quantity
    }, 0)
    const totalQuantity = filteredPurchases.reduce((sum, p) => sum + p.quantity, 0)
    return { totalCost, totalQuantity, count: filteredPurchases.length }
  }, [filteredPurchases])

  const exportCSV = () => {
    const rows: string[][] = [
      ['Date', 'Brand', 'Article', 'Collection', 'Size', 'Qty', 'Unit Cost', 'Commission', 'Shipping', 'Total Cost', 'Rate', 'Source', 'Notes']
    ]

    for (const p of filteredPurchases) {
      const total = totalCostPKR(p.costPKR, p.commissionPKR, p.shippingPKR)
      rows.push([
        formatDate(p.createdAt),
        p.brandName,
        p.articleName,
        p.collectionName,
        p.size,
        String(p.quantity),
        String(p.costPKR),
        String(p.commissionPKR),
        String(p.shippingPKR),
        String(total),
        String(p.exchangeRate),
        p.source || '',
        p.notes || '',
      ])
    }

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rivayat-purchases-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const dateFilters: { id: DateFilter; label: string }[] = [
    { id: 'all', label: 'All Time' },
    { id: '7d', label: '7 Days' },
    { id: '30d', label: '30 Days' },
    { id: '90d', label: '90 Days' },
    { id: 'ytd', label: 'YTD' },
  ]

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight mb-1">
            Purchase Log
          </h2>
          <p className="text-sm text-muted-foreground">
            Track all inventory purchases and costs
          </p>
        </div>
        <Button
          onClick={exportCSV}
          className="gap-2 bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/20 text-primary hover:from-primary/30 hover:to-primary/20"
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Total Spent</div>
              <div className="text-xl font-bold">{formatUSD(stats.totalCost / exchangeRate)}</div>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Items Purchased</div>
              <div className="text-xl font-bold">{stats.totalQuantity}</div>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/20 text-success">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Orders</div>
              <div className="text-xl font-bold">{stats.count}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Date Filters */}
      <div className="mb-5 flex flex-wrap gap-2">
        {dateFilters.map(f => (
          <button
            key={f.id}
            onClick={() => setDateFilter(f.id)}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-medium transition-all",
              dateFilter === f.id
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredPurchases.length === 0 ? (
        <div className="py-20 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No purchases recorded yet</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Item</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collection</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Size</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qty</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unit Cost</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fees</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map(p => {
                  const total = totalCostPKR(p.costPKR, p.commissionPKR, p.shippingPKR)
                  return (
                    <tr key={p.id} className="border-b border-white/5 transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-4 text-muted-foreground">{formatDate(p.createdAt)}</td>
                      <td className="px-4 py-4">
                        <div className="text-xs text-primary font-medium">{p.brandName}</div>
                        <div className="font-medium">{p.articleName}</div>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{p.collectionName}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium">
                          {p.size}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-medium">{p.quantity}</td>
                      <td className="px-4 py-4">
                        <div className="font-medium">{formatUSD(p.costPKR / p.exchangeRate)}</div>
                        <div className="text-xs text-muted-foreground">{formatPKR(p.costPKR)}</div>
                      </td>
                      <td className="px-4 py-4">
                        {p.commissionPKR || p.shippingPKR ? (
                          <>
                            <div>{formatUSD((p.commissionPKR + p.shippingPKR) / p.exchangeRate)}</div>
                            <div className="text-xs text-muted-foreground">{formatPKR(p.commissionPKR + p.shippingPKR)}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-primary">{formatUSD(total / p.exchangeRate)}</div>
                        <div className="text-xs text-muted-foreground">{formatPKR(total)}</div>
                      </td>
                      <td className="px-4 py-4">
                        {p.source && (
                          <span className={cn(
                            "inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
                            p.source === 'prebook' 
                              ? "bg-success/20 text-success border border-success/30" 
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          )}>
                            {p.source}
                          </span>
                        )}
                      </td>
                      <td className="max-w-[150px] truncate px-4 py-4 text-muted-foreground">
                        {p.notes || '--'}
                      </td>
                    </tr>
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
