'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { updateSetting } from '@/lib/actions'
import {
  LayoutDashboard,
  PackagePlus,
  ShoppingCart,
  Package,
  ClipboardList,
  DollarSign,
  Settings,
  RefreshCw,
  Menu,
  X,
  Sparkles,
} from 'lucide-react'

interface SidebarProps {
  isConnected: boolean
  exchangeRate: number
}

const navItems: { id: string; label: string; href: string; icon: React.ElementType; group: string }[] = [
  { id: 'dashboard',    label: 'Dashboard',        href: '/dashboard', icon: LayoutDashboard, group: 'Overview' },
  { id: 'stock-in',    label: 'Stock In',          href: '/stock-in',  icon: PackagePlus,     group: 'Operations' },
  { id: 'sell',        label: 'Record Sale',       href: '/sell',      icon: ShoppingCart,    group: 'Operations' },
  { id: 'inventory',   label: 'Inventory',         href: '/inventory', icon: Package,         group: 'Data' },
  { id: 'purchase-log',label: 'Purchase Log',      href: '/purchases', icon: ClipboardList,   group: 'Data' },
  { id: 'sales-log',   label: 'Sales Log',         href: '/sales',     icon: DollarSign,      group: 'Data' },
  { id: 'settings',    label: 'Brands & Settings', href: '/settings',  icon: Settings,        group: 'System' },
]

const groups = ['Overview', 'Operations', 'Data', 'System']

export function Sidebar({ isConnected, exchangeRate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [localRate, setLocalRate] = useState(exchangeRate)

  function handleSync() {
    setIsSyncing(true)
    router.refresh()
    setTimeout(() => setIsSyncing(false), 1200)
  }

  async function handleRateChange(rate: number) {
    setLocalRate(rate)
    try {
      await updateSetting('usd_rate', String(rate))
    } catch {
      // non-critical; the rate is already updated locally
    }
  }

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-[200] flex h-11 w-11 items-center justify-center rounded-xl glass text-foreground md:hidden transition-all hover:glow-gold-sm"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-[100] flex w-[260px] flex-col overflow-hidden transition-all duration-500',
          'bg-gradient-to-b from-[#141210] via-[#0d0c0a] to-[#080706]',
          'border-r border-[rgba(212,175,55,0.08)]',
          'md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-primary/3 rounded-full blur-3xl" />
        </div>

        {/* Brand Header */}
        <div className="relative border-b border-[rgba(212,175,55,0.08)] px-6 pb-6 pt-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
              <div className="absolute inset-0 rounded-xl shimmer" />
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-foreground">
                Rivayat
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70 font-medium">
                Fashion Lounge
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 px-1">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
              Inventory System
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {groups.map((group) => (
            <div key={group} className="mb-2">
              <div className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40">
                {group}
              </div>
              <div className="space-y-1">
                {navItems
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const Icon = item.icon
                    const isActive =
                      item.href === '/dashboard'
                        ? pathname === '/dashboard'
                        : pathname.startsWith(item.href)
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          'group relative flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-[13px] font-medium transition-all duration-300',
                          isActive
                            ? 'bg-gradient-to-r from-primary/15 via-primary/10 to-transparent text-foreground'
                            : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground',
                        )}
                      >
                        {isActive && (
                          <>
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary shadow-[0_0_12px_rgba(212,175,55,0.5)]" />
                            <div className="absolute inset-0 rounded-xl opacity-50 shimmer" />
                          </>
                        )}
                        <div
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300',
                            isActive
                              ? 'bg-primary/20 text-primary'
                              : 'bg-white/[0.03] text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary/70',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="relative">{item.label}</span>
                      </Link>
                    )
                  })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="relative border-t border-[rgba(212,175,55,0.08)] px-4 py-4 space-y-3">
          {/* Connection status */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div
                  className={cn(
                    'h-2 w-2 rounded-full',
                    isConnected
                      ? 'bg-success shadow-[0_0_8px_rgba(74,222,128,0.5)]'
                      : 'bg-destructive',
                  )}
                />
                {isConnected && (
                  <div className="absolute inset-0 rounded-full bg-success animate-ping opacity-50" />
                )}
              </div>
              <span className={cn('text-[11px] font-medium', isConnected ? 'text-success' : 'text-destructive')}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">Live</span>
          </div>

          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-medium transition-all duration-300',
              'bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/15',
              'hover:from-primary/20 hover:to-primary/10 hover:border-primary/25 hover:shadow-[0_0_20px_rgba(212,175,55,0.1)]',
              'text-primary/80 hover:text-primary',
              isSyncing && 'pointer-events-none opacity-50',
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Syncing...' : 'Sync Data'}
          </button>

          {/* Exchange rate */}
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] text-muted-foreground">USD/PKR Rate</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={localRate}
                onChange={(e) => handleRateChange(Number(e.target.value) || 278)}
                className="w-16 rounded-lg border border-primary/10 bg-white/[0.02] px-2 py-1 text-center text-[12px] font-medium text-foreground transition-all focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/20"
                min="1"
              />
            </div>
          </div>

          {/* Version */}
          <div className="text-center">
            <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground/50">
              v1.3 — May 2026
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}
