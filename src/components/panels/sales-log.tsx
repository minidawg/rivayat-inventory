'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatPKR, formatUSD, formatDate } from '@/lib/data'
import { deleteSale } from '@/lib/actions'
import type { SaleRow } from '@/lib/types'
import { Download, Trash2, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react'
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

  const filteredSales = useMemo(() => {
    if (dateFilter === 'all') return sales

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
        return sales
    }

    return sales.filter(s => new Date(s.createdAt) >= cutoff)
  }, [sales, dateFilter])

  const stats = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.sellingPrice * s.quantity, 0)
    const totalCost = filteredSales.reduce((sum, s) => sum + (s.costPKRAtSale || 0) * s.quantity, 0)
    const totalProfit = totalRevenue - totalCost
    return { totalRevenue, totalProfit, count: filteredSales.length }
  }, [filteredSales])

  const handleDelete = async (saleId: string) => {
    if (!confirm('Delete this sale? Stock will be restored.')) return
    
    setDeletingId(saleId)
    try {
      await deleteSale(saleId)
      router.refresh()
      onSuccess?.()
    } catch (error) {
      console.error('Error deleting sale:', error)
    } finally {
      setDeletingId(null)
    }
  }

  const exportCSV = () => {
    const rows: string[][] = [
      ['Date', 'Brand', 'Article', 'Size', 'Qty', 'Sold For', 'Cost', 'Profit', 'Channel', 'Client']
    ]

    for (const s of filteredSales) {
      const profit = s.sellingPrice - (s.costPKRAtSale || 0)
      rows.push([
        formatDate(s.createdAt),
        s.brandName,
        s.articleName,
        s.size,
        String(s.quantity),
        String(s.sellingPrice),
        String(s.costPKRAtSale || 0),
        String(profit),
        s.channel || '',
        s.clientName || '',
      ])
    }

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rivayat-sales-${new Date().toISOString().split('T')[0]}.csv`
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
            Sales Log
          </h2>
          <p className="text-sm text-muted-foreground">
            Complete history of all transactions
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
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Revenue</div>
              <div className="text-xl font-bold">{formatUSD(stats.totalRevenue / exchangeRate)}</div>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/20 text-success">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Profit</div>
              <div className="text-xl font-bold text-success">{formatUSD(stats.totalProfit / exchangeRate)}</div>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Sales</div>
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
      {filteredSales.length === 0 ? (
        <div className="py-20 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No sales recorded yet</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Item</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Size</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qty</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sold For</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cost</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profit</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Channel</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(s => {
                  const profit = s.sellingPrice - (s.costPKRAtSale || 0)
                  const rate = s.exchangeRateAtSale || exchangeRate
                  const isPositive = profit >= 0
                  
                  return (
                    <tr key={s.id} className="border-b border-white/5 transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-4 text-muted-foreground">{formatDate(s.createdAt)}</td>
                      <td className="px-4 py-4">
                        <div className="text-xs text-primary font-medium">{s.brandName}</div>
                        <div className="font-medium">{s.articleName}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium">
                          {s.size}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-medium">{s.quantity}</td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-primary">{formatUSD(s.sellingPrice / rate)}</div>
                        <div className="text-xs text-muted-foreground">{formatPKR(s.sellingPrice)}</div>
                      </td>
                      <td className="px-4 py-4">
                        {s.costPKRAtSale ? (
                          <>
                            <div>{formatUSD(s.costPKRAtSale / rate)}</div>
                            <div className="text-xs text-muted-foreground">{formatPKR(s.costPKRAtSale)}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className={cn(
                          "flex items-center gap-1 font-semibold",
                          isPositive ? "text-success" : "text-destructive"
                        )}>
                          {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {formatUSD(profit / rate)}
                        </div>
                        <div className="text-xs text-muted-foreground">{formatPKR(profit)}</div>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{s.channel || '--'}</td>
                      <td className="px-4 py-4">{s.clientName || '--'}</td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={deletingId === s.id}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-muted-foreground transition-all hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
