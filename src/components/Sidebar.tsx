'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  PackagePlus,
  ShoppingCart,
  Receipt,
  Package,
  ClipboardList,
  DollarSign,
  Settings,
  RefreshCw,
  Menu,
  X,
  Sparkles,
  Gem,
  Crown,
  LogOut,
} from 'lucide-react'
import { logout } from '@/actions/auth'

interface SidebarProps {
  isConnected: boolean
  exchangeRate: number
}

const navItems = [
  { id: 'dashboard',     label: 'Dashboard',        href: '/dashboard', icon: LayoutDashboard, group: 'Overview' },
  { id: 'stock-in',     label: 'Stock In',          href: '/stock-in',     icon: PackagePlus, group: 'Operations' },
  { id: 'sell',         label: 'Record Sale',       href: '/sell',         icon: ShoppingCart, group: 'Operations' },
  { id: 'record-cost',  label: 'Record Cost',       href: '/record-cost',  icon: Receipt,      group: 'Operations' },
  { id: 'inventory',    label: 'Inventory',         href: '/inventory', icon: Package,         group: 'Data' },
  { id: 'purchase-log', label: 'Purchase Log',      href: '/purchases', icon: ClipboardList,   group: 'Data' },
  { id: 'sales-log',    label: 'Sales Log',         href: '/sales',     icon: DollarSign,      group: 'Data' },
  { id: 'cost-log',     label: 'Cost Log',          href: '/costs',     icon: Receipt,         group: 'Data' },
  { id: 'settings',     label: 'Brands & Settings', href: '/settings',  icon: Settings,        group: 'System' },
]

const groups = ['Overview', 'Operations', 'Data', 'System']

export function Sidebar({ isConnected, exchangeRate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isAmethyst, setIsAmethyst] = useState(false)

  useEffect(() => {
    setIsAmethyst(document.documentElement.classList.contains('theme-amethyst'))
  }, [])

  function handleSync() {
    setIsSyncing(true)
    router.refresh()
    setTimeout(() => setIsSyncing(false), 1200)
  }

  function toggleTheme() {
    const html = document.documentElement
    if (isAmethyst) {
      html.classList.remove('theme-amethyst', 'dark')
      localStorage.setItem('rivayat-theme', 'gold')
      setIsAmethyst(false)
    } else {
      html.classList.add('theme-amethyst', 'dark')
      localStorage.setItem('rivayat-theme', 'amethyst')
      setIsAmethyst(true)
    }
  }

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-[200] flex h-11 w-11 items-center justify-center rounded-xl glass text-foreground md:hidden"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-[100] flex w-[260px] flex-col overflow-hidden transition-transform duration-400',
          'border-r border-border',
          'md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ background: 'var(--background)' }}
      >
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-28 -left-28 h-56 w-56 rounded-full bg-primary/3 blur-3xl" />
        </div>

        {/* Brand header */}
        <div className="relative border-b border-border px-6 pb-5 pt-7">
          <div className="flex items-center gap-3 mb-2">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
              <div className="absolute inset-0 rounded-xl shimmer" />
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-[1.15rem] font-semibold leading-tight tracking-tight text-foreground">
                Rivayat
              </h1>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-primary/60">
                Fashion Lounge
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 px-1">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            <span className="text-[8px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">Inventory System</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {groups.map((group) => (
            <div key={group} className="mb-1">
              <div className="px-3 pb-1 pt-3.5 text-[9px] font-bold uppercase tracking-[0.22em] text-primary/35">
                {group}
              </div>
              <div className="space-y-0.5">
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
                          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-250',
                          isActive
                            ? 'bg-primary/10 text-foreground'
                            : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground/80',
                        )}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_10px_var(--primary)]" />
                        )}
                        <div
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-250',
                            isActive
                              ? 'bg-primary/15 text-primary'
                              : 'text-muted-foreground/70 group-hover:text-primary/60',
                          )}
                        >
                          <Icon className="h-[15px] w-[15px]" />
                        </div>
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="relative border-t border-border px-4 py-4 space-y-3">
          {/* Connection + theme row */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className={cn('h-1.5 w-1.5 rounded-full', isConnected ? 'bg-success' : 'bg-destructive')} />
                {isConnected && <div className="absolute inset-0 rounded-full bg-success animate-ping opacity-40" />}
              </div>
              <span className={cn('text-[11px] font-medium', isConnected ? 'text-success' : 'text-destructive')}>
                {isConnected ? 'Connected' : 'Offline'}
              </span>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={isAmethyst ? 'Switch to Noir Gold' : 'Switch to Noir Amethyst'}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all duration-300',
                isAmethyst
                  ? 'border-[rgba(178,75,243,0.25)] bg-[rgba(178,75,243,0.1)] text-[#B24BF3]'
                  : 'border-primary/20 bg-primary/5 text-primary/80 hover:bg-primary/10'
              )}
            >
              {isAmethyst ? <Gem className="h-3 w-3" /> : <Crown className="h-3 w-3" />}
              {isAmethyst ? 'Amethyst' : 'Noir Gold'}
            </button>
          </div>

          {/* Sign Out */}
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/15 bg-destructive/5 px-4 py-2 text-[12px] font-medium text-destructive/70 transition-all duration-250 hover:border-destructive/25 hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </form>

          {/* Sync */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-[12px] font-medium transition-all duration-250',
              'border-primary/15 bg-primary/5 text-primary/70',
              'hover:border-primary/25 hover:bg-primary/10 hover:text-primary',
              isSyncing && 'pointer-events-none opacity-40',
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Syncing…' : 'Sync Data'}
          </button>

          {/* Rate */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] text-muted-foreground">USD/PKR</span>
            <span className="text-[12px] font-semibold tabular text-foreground">
              {exchangeRate.toFixed(2)}
            </span>
          </div>

          <div className="text-center">
            <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/40">v1.4 · May 2026</span>
          </div>
        </div>
      </aside>
    </>
  )
}
