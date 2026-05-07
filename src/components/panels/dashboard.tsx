'use client'

import { useMemo } from 'react'
import { formatPKR, formatUSD } from '@/lib/data'
import type { SkuForStats, SaleRow, PurchaseRow } from '@/lib/types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  DollarSign, 
  ShoppingBag, 
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Crown
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardProps {
  skus: SkuForStats[]
  sales: SaleRow[]
  purchases: PurchaseRow[]
  exchangeRate: number
}

export function Dashboard({ skus, sales, purchases, exchangeRate }: DashboardProps) {

  const stats = useMemo(() => {
    const totalItems = skus.reduce((sum, s) => sum + s.quantity, 0)
    const lowStockItems = skus.filter(s => s.quantity > 0 && s.quantity <= s.lowStockBuffer).length
    const outOfStockItems = skus.filter(s => s.quantity === 0).length

    const totalRevenue = sales.reduce((sum, s) => sum + s.sellingPrice * s.quantity, 0)
    const totalCost = sales.reduce((sum, s) => sum + (s.costPKRAtSale || 0) * s.quantity, 0)
    const totalProfit = totalRevenue - totalCost

    const totalPurchases = purchases.reduce((sum, p) => {
      const total = (p.costPKR + p.commissionPKR + p.shippingPKR) * p.quantity
      return sum + total
    }, 0)

    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

    return {
      totalItems,
      lowStockItems,
      outOfStockItems,
      totalRevenue,
      totalProfit,
      totalPurchases,
      salesCount: sales.length,
      profitMargin,
    }
  }, [skus, sales, purchases])

  // Monthly revenue data for chart (last 6 months)
  const monthlyData = useMemo(() => {
    const months: Record<string, { revenue: number; profit: number }> = {}
    const now = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = date.toLocaleDateString('en-US', { month: 'short' })
      months[key] = { revenue: 0, profit: 0 }
    }

    for (const sale of sales) {
      const date = new Date(sale.createdAt)
      const key = date.toLocaleDateString('en-US', { month: 'short' })
      if (months[key]) {
        months[key].revenue += sale.sellingPrice * sale.quantity
        months[key].profit += (sale.sellingPrice - (sale.costPKRAtSale || 0)) * sale.quantity
      }
    }

    return Object.entries(months).map(([month, data]) => ({
      month,
      revenue: data.revenue,
      profit: data.profit,
    }))
  }, [sales])

  // Top selling articles
  const topSellers = useMemo(() => {
    const articleSales: Record<string, { name: string; brand: string; qty: number; revenue: number }> = {}

    for (const sale of sales) {
      const key = sale.articleId
      if (!articleSales[key]) {
        articleSales[key] = {
          name: sale.articleName,
          brand: sale.brandName,
          qty: 0,
          revenue: 0,
        }
      }
      articleSales[key].qty += sale.quantity
      articleSales[key].revenue += sale.sellingPrice * sale.quantity
    }

    return Object.values(articleSales)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
  }, [sales])

  // Top clients
  const topClients = useMemo(() => {
    const clientData: Record<string, { name: string; orders: number; spent: number }> = {}

    for (const sale of sales) {
      const name = sale.clientName || 'Anonymous'
      if (!clientData[name]) {
        clientData[name] = { name, orders: 0, spent: 0 }
      }
      clientData[name].orders += 1
      clientData[name].spent += sale.sellingPrice * sale.quantity
    }

    return Object.values(clientData)
      .filter(c => c.name !== 'Anonymous')
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5)
  }, [sales])

  // Profit breakdown by category (brand)
  const profitByBrand = useMemo(() => {
    const brandProfit: Record<string, number> = {}

    for (const sale of sales) {
      if (!brandProfit[sale.brandName]) {
        brandProfit[sale.brandName] = 0
      }
      brandProfit[sale.brandName] += (sale.sellingPrice - (sale.costPKRAtSale || 0)) * sale.quantity
    }

    const colors = ['#d4af37', '#4ade80', '#f59e0b', '#6366f1', '#ec4899']
    return Object.entries(brandProfit)
      .map(([name, value], i) => ({
        name,
        value,
        color: colors[i % colors.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [sales])

  const statCards = [
    {
      label: 'Total Items',
      value: stats.totalItems.toLocaleString(),
      subtext: `${stats.lowStockItems} low stock`,
      icon: Package,
      trend: stats.lowStockItems > 0 ? 'warning' : 'neutral',
      gradient: 'from-blue-500/20 to-cyan-500/20',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
    },
    {
      label: 'Total Revenue',
      value: formatUSD(stats.totalRevenue / exchangeRate),
      subtext: formatPKR(stats.totalRevenue),
      icon: DollarSign,
      trend: 'up',
      gradient: 'from-primary/20 to-amber-500/20',
      iconBg: 'bg-primary/20',
      iconColor: 'text-primary',
    },
    {
      label: 'Net Profit',
      value: formatUSD(stats.totalProfit / exchangeRate),
      subtext: `${stats.profitMargin.toFixed(1)}% margin`,
      icon: TrendingUp,
      trend: stats.totalProfit > 0 ? 'up' : 'down',
      gradient: 'from-success/20 to-emerald-500/20',
      iconBg: 'bg-success/20',
      iconColor: 'text-success',
    },
    {
      label: 'Total Sales',
      value: stats.salesCount.toString(),
      subtext: 'transactions',
      icon: ShoppingBag,
      trend: 'neutral',
      gradient: 'from-purple-500/20 to-pink-500/20',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
    },
  ]

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
              Dashboard
            </h2>
            <div className="flex h-6 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" />
              Live
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Welcome back to your inventory command center
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <span>Last synced: Just now</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4 stagger-children">
        {statCards.map((stat, i) => (
          <div
            key={stat.label}
            className={cn(
              "group relative overflow-hidden rounded-2xl p-5 transition-all duration-500",
              "glass premium-card"
            )}
          >
            {/* Background gradient */}
            <div className={cn(
              "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
              stat.gradient
            )} />
            
            {/* Content */}
            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
                  stat.iconBg
                )}>
                  <stat.icon className={cn("h-5 w-5", stat.iconColor)} />
                </div>
                {stat.trend === 'up' && (
                  <div className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                    <TrendingUp className="h-3 w-3" />
                    <span>+12%</span>
                  </div>
                )}
                {stat.trend === 'warning' && (
                  <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                  </div>
                )}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                {stat.label}
              </div>
              <div className="text-2xl font-bold tracking-tight mb-0.5">
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground">
                {stat.subtext}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="mb-6 grid gap-5 lg:grid-cols-5">
        {/* Revenue Chart - Takes 3 columns */}
        <div className="lg:col-span-3 glass rounded-2xl p-5 premium-card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold mb-0.5">Revenue Overview</h3>
              <p className="text-xs text-muted-foreground">Last 6 months performance</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span className="text-muted-foreground">Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-success" />
                <span className="text-muted-foreground">Profit</span>
              </div>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d4af37" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#d4af37" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4ade80" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 11, fill: '#9a8f82' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#9a8f82' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={(value: number) => formatPKR(value)}
                  contentStyle={{ 
                    background: 'rgba(18, 16, 14, 0.95)', 
                    border: '1px solid rgba(212, 175, 55, 0.2)', 
                    borderRadius: '12px',
                    color: '#faf8f5',
                    fontSize: '12px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#d4af37" 
                  strokeWidth={2}
                  fill="url(#revenueGradient)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#4ade80" 
                  strokeWidth={2}
                  fill="url(#profitGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Profit by Brand - Takes 2 columns */}
        <div className="lg:col-span-2 glass rounded-2xl p-5 premium-card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-0.5">Profit by Brand</h3>
            <p className="text-xs text-muted-foreground">Top performing brands</p>
          </div>
          <div className="h-[180px]">
            {profitByBrand.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={profitByBrand}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth={1}
                  >
                    {profitByBrand.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatPKR(value)}
                    contentStyle={{ 
                      background: 'rgba(18, 16, 14, 0.95)', 
                      border: '1px solid rgba(212, 175, 55, 0.2)', 
                      borderRadius: '12px',
                      color: '#faf8f5',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No data yet
              </div>
            )}
          </div>
          {profitByBrand.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              {profitByBrand.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5 text-[11px]">
                  <div 
                    className="h-2 w-2 rounded-full" 
                    style={{ backgroundColor: item.color }} 
                  />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Top Sellers */}
        <div className="glass rounded-2xl p-5 premium-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold mb-0.5">Top Selling Articles</h3>
              <p className="text-xs text-muted-foreground">Best performers this period</p>
            </div>
            <Crown className="h-4 w-4 text-primary" />
          </div>
          {topSellers.length > 0 ? (
            <div className="space-y-1">
              {topSellers.map((item, i) => (
                <div 
                  key={i} 
                  className="group flex items-center justify-between rounded-xl px-3 py-3 transition-all hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold",
                      i === 0 ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"
                    )}>
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium group-hover:text-primary transition-colors">{item.name}</div>
                      <div className="text-[11px] text-muted-foreground">{item.brand}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{item.qty} sold</div>
                    <div className="text-[11px] text-muted-foreground">{formatPKR(item.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No sales recorded yet
            </div>
          )}
        </div>

        {/* Top Clients */}
        <div className="glass rounded-2xl p-5 premium-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold mb-0.5">VIP Clients</h3>
              <p className="text-xs text-muted-foreground">Top spenders this period</p>
            </div>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          {topClients.length > 0 ? (
            <div className="space-y-1">
              {topClients.map((client, i) => (
                <div 
                  key={i} 
                  className="group flex items-center justify-between rounded-xl px-3 py-3 transition-all hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold uppercase",
                      i === 0 
                        ? "bg-gradient-to-br from-primary/30 to-primary/10 text-primary border border-primary/20" 
                        : "bg-white/5 text-muted-foreground"
                    )}>
                      {client.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="text-sm font-medium group-hover:text-primary transition-colors">{client.name}</div>
                      <div className="text-[11px] text-muted-foreground">{client.orders} orders</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold">{formatPKR(client.spent)}</div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No client data yet
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Alert */}
      {stats.lowStockItems > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-400">Low Stock Alert</h4>
              <p className="text-xs text-amber-400/70">
                {stats.lowStockItems} items are running low on stock. {stats.outOfStockItems > 0 && `${stats.outOfStockItems} items are out of stock.`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
