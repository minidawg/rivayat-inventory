'use client'

import { useMemo, useState } from 'react'
import { formatPKR, formatUSD } from '@/lib/data'
import type { SkuForStats, SaleRow, PurchaseRow } from '@/lib/types'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Package, DollarSign,
  AlertTriangle, Sparkles, Crown, Users, ArrowUpRight, ChevronDown, Receipt,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardProps {
  skus: SkuForStats[]
  sales: SaleRow[]
  purchases: PurchaseRow[]
  exchangeRate: number
  lowStockAlertsEnabled: boolean
  totalOverheadsUSD: number
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const up = pct >= 0
  return (
    <div className={cn(
      'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular',
      up ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
    )}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{pct.toFixed(1)}%
    </div>
  )
}


export function Dashboard({ skus, sales, purchases, exchangeRate, lowStockAlertsEnabled, totalOverheadsUSD }: DashboardProps) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  // ── Core metrics ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalItems    = skus.reduce((s, x) => s + x.quantity, 0)
    const lowStockItems = skus.filter(s => s.quantity > 0 && s.quantity <= s.lowStockBuffer).length
    const outOfStock    = skus.filter(s => s.quantity === 0).length
    const inventoryValuePKR = skus.reduce((s, x) => s + x.avgCostPKR * x.quantity, 0)

    // sellingPrice is stored as USD
    const totalRevenueUSD = sales.reduce((s, x) => s + x.sellingPrice * x.quantity, 0)
    const totalCostUSD    = sales.reduce((s, x) => {
      const rate = x.exchangeRateAtSale || exchangeRate
      return s + (x.costPKRAtSale || 0) / rate * x.quantity
    }, 0)
    const totalProfitUSD    = totalRevenueUSD - totalCostUSD
    const trueNetProfitUSD  = totalProfitUSD - totalOverheadsUSD
    const profitMargin      = totalRevenueUSD > 0 ? (totalProfitUSD / totalRevenueUSD) * 100 : 0
    const trueMargin        = totalRevenueUSD > 0 ? (trueNetProfitUSD / totalRevenueUSD) * 100 : 0
    const avgOrderUSD       = sales.length > 0 ? totalRevenueUSD / sales.length : 0

    return {
      totalItems, lowStockItems, outOfStock,
      inventoryValuePKR, inventoryValueUSD: inventoryValuePKR / exchangeRate,
      totalRevenueUSD, totalCostUSD, totalProfitUSD, trueNetProfitUSD,
      profitMargin, trueMargin,
      salesCount: sales.length, avgOrderUSD,
    }
  }, [skus, sales, exchangeRate, totalOverheadsUSD])

  // ── Monthly trend (current vs previous month) ─────────────────────────────
  const trends = useMemo(() => {
    const now   = new Date()
    const currStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const curr = sales.filter(s => new Date(s.createdAt) >= currStart)
    const prev = sales.filter(s => { const d = new Date(s.createdAt); return d >= prevStart && d < currStart })

    function revOf(arr: SaleRow[]) { return arr.reduce((s, x) => s + x.sellingPrice * x.quantity, 0) }
    function profOf(arr: SaleRow[]) {
      return arr.reduce((s, x) => {
        const rate = x.exchangeRateAtSale || exchangeRate
        return s + (x.sellingPrice - (x.costPKRAtSale || 0) / rate) * x.quantity
      }, 0)
    }

    const currRev  = revOf(curr);  const prevRev  = revOf(prev)
    const currProf = profOf(curr); const prevProf = profOf(prev)

    const revTrend  = prevRev  > 0 ? (currRev  - prevRev)  / prevRev  * 100 : null
    const profTrend = prevProf > 0 ? (currProf - prevProf) / prevProf * 100 : null

    return { revTrend, profTrend }
  }, [sales, exchangeRate])

  // ── Monthly chart (6 months, USD) ─────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const months: Record<string, { revenue: number; profit: number }> = {}
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months[d.toLocaleDateString('en-US', { month: 'short' })] = { revenue: 0, profit: 0 }
    }
    for (const s of sales) {
      const key = new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short' })
      if (months[key]) {
        const rate = s.exchangeRateAtSale || exchangeRate
        months[key].revenue += s.sellingPrice * s.quantity
        months[key].profit  += (s.sellingPrice - (s.costPKRAtSale || 0) / rate) * s.quantity
      }
    }
    return Object.entries(months).map(([month, d]) => ({ month, ...d }))
  }, [sales, exchangeRate])

  // ── Top sellers ───────────────────────────────────────────────────────────
  const topSellers = useMemo(() => {
    const map: Record<string, { name: string; brand: string; qty: number; revenue: number }> = {}
    for (const s of sales) {
      if (!map[s.articleId]) map[s.articleId] = { name: s.articleName, brand: s.brandName, qty: 0, revenue: 0 }
      map[s.articleId].qty     += s.quantity
      map[s.articleId].revenue += s.sellingPrice * s.quantity
    }
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5)
  }, [sales])

  // ── Top clients ───────────────────────────────────────────────────────────
  const topClients = useMemo(() => {
    const map: Record<string, { name: string; orders: number; spent: number }> = {}
    for (const s of sales) {
      const n = s.clientName || 'Anonymous'
      if (!map[n]) map[n] = { name: n, orders: 0, spent: 0 }
      map[n].orders += 1
      map[n].spent  += s.sellingPrice * s.quantity
    }
    return Object.values(map).filter(c => c.name !== 'Anonymous').sort((a, b) => b.spent - a.spent).slice(0, 5)
  }, [sales])

  // ── Revenue by channel ────────────────────────────────────────────────────
  const revenueByChannel = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of sales) {
      const ch = s.channel || 'Unknown'
      map[ch] = (map[ch] || 0) + s.sellingPrice * s.quantity
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [sales])

  // ── KPI cards (5 core metrics) ────────────────────────────────────────────
  const kpiCards = [
    {
      id: 'inventory',
      label: 'Inventory Value',
      value: formatUSD(stats.inventoryValueUSD),
      sub: formatPKR(stats.inventoryValuePKR),
      icon: Package,
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-400',
      trend: null,
      warn: lowStockAlertsEnabled && stats.lowStockItems > 0,
    },
    {
      id: 'revenue',
      label: 'Total Revenue',
      value: formatUSD(stats.totalRevenueUSD),
      sub: `${stats.salesCount} transactions`,
      icon: DollarSign,
      iconBg: 'bg-primary/15',
      iconColor: 'text-primary',
      trend: trends.revTrend,
      warn: false,
    },
    {
      id: 'expenses',
      label: 'Total Expenses',
      value: formatUSD(totalOverheadsUSD),
      sub: 'rent · shipping · supplies',
      icon: Receipt,
      iconBg: 'bg-destructive/15',
      iconColor: 'text-destructive',
      trend: null,
      warn: false,
    },
    {
      id: 'cogs',
      label: 'Total Cost',
      value: formatUSD(stats.totalCostUSD),
      sub: 'cost of goods sold',
      icon: TrendingDown,
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
      trend: null,
      warn: false,
    },
    {
      id: 'netprofit',
      label: 'Net Profit',
      value: formatUSD(stats.trueNetProfitUSD),
      sub: `${stats.trueMargin.toFixed(1)}% margin · Revenue − (Expenses + Cost)`,
      icon: TrendingUp,
      iconBg: stats.trueNetProfitUSD >= 0 ? 'bg-success/15' : 'bg-destructive/15',
      iconColor: stats.trueNetProfitUSD >= 0 ? 'text-success' : 'text-destructive',
      trend: null,
      warn: stats.trueNetProfitUSD < 0,
    },
  ]

  // ── Drill-down content (inventory card only) ─────────────────────────────
  const drillContent: Record<string, React.ReactNode> = {
    inventory: (
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Stock Status</h4>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'In Stock', val: lowStockAlertsEnabled ? skus.filter(s => s.quantity > s.lowStockBuffer).length : skus.filter(s => s.quantity > 0).length, color: 'text-success' },
            { label: 'Low Stock', val: lowStockAlertsEnabled ? stats.lowStockItems : 0, color: 'text-amber-400' },
            { label: 'Out of Stock', val: stats.outOfStock, color: 'text-destructive' },
          ].map(item => (
            <div key={item.label} className="rounded-xl bg-white/[0.03] p-3">
              <div className={cn('text-2xl font-bold num-display', item.color)}>{item.val}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-7 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="font-[family-name:var(--font-display)] text-[1.9rem] font-semibold tracking-tight leading-none">
              Dashboard
            </h2>
            <div className="flex h-5 items-center gap-1 rounded-full bg-primary/10 px-2.5 text-[9px] font-bold uppercase tracking-[0.15em] text-primary">
              <Sparkles className="h-2.5 w-2.5" /> Live
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Rivayat Fashion Lounge — Inventory Command Centre</p>
        </div>
      </div>

      {/* KPI Grid — 5 core metrics */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 stagger-children">
        {kpiCards.map((card) => (
          <button
            key={card.id}
            onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
            className={cn(
              'group relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-350 premium-card',
              'border border-[rgba(255,255,255,0.06)] bg-[#141414]',
              expandedCard === card.id && 'border-primary/25 bg-[#191919]',
              drillContent[card.id] ? 'cursor-pointer' : 'cursor-default',
            )}
          >
            <div className="flex items-start justify-between mb-3.5">
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', card.iconBg)}>
                <card.icon className={cn('h-4.5 w-4.5', card.iconColor)} />
              </div>
              <div className="flex items-center gap-2">
                {card.warn && (
                  <div className="flex h-5 items-center gap-1 rounded-full bg-amber-500/10 px-2 text-[10px] font-semibold text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    {stats.lowStockItems}
                  </div>
                )}
                <TrendBadge pct={card.trend ?? null} />
                {drillContent[card.id] && (
                  <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground/40 transition-transform', expandedCard === card.id && 'rotate-180')} />
                )}
              </div>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
              {card.label}
            </div>
            <div className="text-[1.45rem] font-bold num-display leading-none mb-1 truncate">
              {card.value}
            </div>
            <div className="text-xs text-muted-foreground">{card.sub}</div>
          </button>
        ))}
      </div>

      {/* Drill-down panel */}
      {expandedCard && drillContent[expandedCard] && (
        <div className="mb-5 rounded-2xl border border-primary/15 bg-[#141414] p-5 animate-slide-up">
          {drillContent[expandedCard]}
        </div>
      )}

      {/* Charts row */}
      <div className="mb-5 grid gap-4 lg:grid-cols-5">
        {/* Revenue area chart */}
        <div className="lg:col-span-3 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5 premium-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold leading-none">Revenue Overview</h3>
              <p className="text-[11px] text-muted-foreground mt-1">Last 6 months · USD</p>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-primary" /><span className="text-muted-foreground">Revenue</span></div>
              <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-success" /><span className="text-muted-foreground">Profit</span></div>
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4ADE80" stopOpacity={0.30} />
                    <stop offset="100%" stopColor="#4ADE80" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9A8F82' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9A8F82' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toFixed(0)}`} width={48} />
                <Tooltip
                  formatter={(v, name) => [formatUSD(Number(v)), name === 'revenue' ? 'Revenue' : 'Profit']}
                  contentStyle={{ background:'#1A1A1A', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', color:'#FAF8F5', fontSize:'12px' }}
                  cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                <Area type="monotone" dataKey="profit"  stroke="#4ADE80" strokeWidth={2} fill="url(#profGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Channel */}
        <div className="lg:col-span-2 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5 premium-card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold leading-none">Revenue by Channel</h3>
            <p className="text-[11px] text-muted-foreground mt-1">USD · all-time</p>
          </div>
          {revenueByChannel.length > 0 ? (
            <div className="space-y-3">
              {revenueByChannel.map(([ch, rev]) => {
                const pct = stats.totalRevenueUSD > 0 ? rev / stats.totalRevenueUSD * 100 : 0
                return (
                  <div key={ch}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground/80">{ch}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold tabular">{formatUSD(rev)}</span>
                        <span className="text-[10px] text-muted-foreground tabular w-8 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No sales data yet</div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        {/* Top sellers */}
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5 premium-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold leading-none">Top Selling Articles</h3>
              <p className="text-[11px] text-muted-foreground mt-1">Best performers all-time</p>
            </div>
            <Crown className="h-4 w-4 text-primary" />
          </div>
          {topSellers.length > 0 ? (
            <div className="space-y-0.5">
              {topSellers.map((item, i) => (
                <div key={i} className="group flex items-center justify-between rounded-xl px-3 py-2.5 transition-all hover:bg-white/[0.03]">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                      i === 0 ? 'bg-primary/15 text-primary' : 'bg-white/5 text-muted-foreground')}>
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium leading-none group-hover:text-primary transition-colors">{item.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{item.brand}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold num-display">{item.qty} sold</div>
                    <div className="text-[11px] text-muted-foreground">{formatUSD(item.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">No sales recorded yet</div>
          )}
        </div>

        {/* VIP clients */}
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5 premium-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold leading-none">VIP Clients</h3>
              <p className="text-[11px] text-muted-foreground mt-1">Top spenders all-time</p>
            </div>
            <Users className="h-4 w-4 text-primary" />
          </div>
          {topClients.length > 0 ? (
            <div className="space-y-0.5">
              {topClients.map((client, i) => (
                <div key={i} className="group flex items-center justify-between rounded-xl px-3 py-2.5 transition-all hover:bg-white/[0.03]">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold uppercase',
                      i === 0 ? 'bg-primary/15 text-primary border border-primary/20' : 'bg-white/5 text-muted-foreground',
                    )}>
                      {client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-medium leading-none group-hover:text-primary transition-colors">{client.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{client.orders} orders</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold num-display">{formatUSD(client.spent)}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">No client data yet</div>
          )}
        </div>
      </div>

      {/* Recent Sales */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5 mb-5 premium-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold leading-none">Recent Sales</h3>
            <p className="text-[11px] text-muted-foreground mt-1">Last 10 transactions</p>
          </div>
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        {sales.length === 0 ? (
          <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">No sales yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Date','Article','Size','Qty','USD','Channel','Client'].map(h => (
                    <th key={h} className="whitespace-nowrap pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sales.slice(0, 10).map(s => (
                  <tr key={s.id} className="border-b border-white/[0.03] last:border-0 transition-colors hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="text-[11px] text-primary font-medium">{s.brandName}</div>
                      <div className="text-sm font-medium leading-tight">{s.articleName}</div>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="inline-flex items-center rounded-md bg-white/[0.05] px-2 py-0.5 text-xs font-medium">{s.size}</span>
                    </td>
                    <td className="py-2.5 pr-4 tabular font-medium">{s.quantity}</td>
                    <td className="py-2.5 pr-4 tabular font-semibold text-primary">{formatUSD(s.sellingPrice * s.quantity)}</td>
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground">{s.channel || '—'}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{s.clientName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Low stock alert */}
      {stats.lowStockItems > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-400">Low Stock Alert</h4>
              <p className="text-xs text-amber-400/70">
                {stats.lowStockItems} item{stats.lowStockItems !== 1 ? 's' : ''} running low.
                {stats.outOfStock > 0 && ` ${stats.outOfStock} out of stock.`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
