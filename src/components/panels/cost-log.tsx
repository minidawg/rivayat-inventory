'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatUSD, formatDate } from '@/lib/data'
import { deleteOverhead, updateOverhead } from '@/lib/actions'
import { OVERHEAD_CATEGORIES, PAYMENT_METHODS } from '@/lib/types'
import type { OverheadRow } from '@/lib/types'
import { Download, Receipt, Calendar, TrendingDown, Trash2, Loader2, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CostLogProps {
  overheads: OverheadRow[]
}

type DateFilter = 'all' | '7d' | '30d' | '90d' | 'ytd'

const selectClass =
  'h-9 w-full rounded-xl border border-white/10 bg-[#111] px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none'

export function CostLog({ overheads }: CostLogProps) {
  const router = useRouter()

  const [dateFilter,    setDateFilter]    = useState<DateFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [deletingId,    setDeletingId]    = useState<string | null>(null)
  const [confirmId,     setConfirmId]     = useState<string | null>(null)
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [savingId,      setSavingId]      = useState<string | null>(null)

  // Edit state
  const [editCategory,      setEditCategory]      = useState('')
  const [editAmount,        setEditAmount]        = useState('')
  const [editDate,          setEditDate]          = useState('')
  const [editNotes,         setEditNotes]         = useState('')
  const [editPaymentMethod, setEditPaymentMethod] = useState('')

  const filtered = useMemo(() => {
    let list = overheads
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
      list = list.filter(r => new Date(r.expenseDate) >= cutoff)
    }
    if (categoryFilter !== 'all') list = list.filter(r => r.category === categoryFilter)
    return list
  }, [overheads, dateFilter, categoryFilter])

  const stats = useMemo(() => {
    const total   = filtered.reduce((s, r) => s + r.amount, 0)
    const largest = filtered.reduce((max, r) => r.amount > max ? r.amount : max, 0)
    return { total, count: filtered.length, largest }
  }, [filtered])

  function startEdit(row: OverheadRow) {
    setEditingId(row.id)
    setEditCategory(row.category)
    setEditAmount(String(row.amount))
    setEditDate(row.expenseDate)
    setEditNotes(row.notes ?? '')
    setEditPaymentMethod(row.paymentMethod ?? 'Cash')
    setConfirmId(null)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSave(id: string) {
    const amount = Number(editAmount)
    if (!amount || amount <= 0) { toast.error('Amount must be greater than 0.'); return }
    setSavingId(id)
    try {
      const result = await updateOverhead(id, {
        category: editCategory,
        amount,
        expenseDate: editDate,
        notes: editNotes,
        paymentMethod: editPaymentMethod,
      })
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Cost updated.')
        setEditingId(null)
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update cost.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const result = await deleteOverhead(id)
      if (result?.error) {
        toast.error(result.error)
      } else {
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete cost.')
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  function exportCSV() {
    const rows = [['Date', 'Category', 'Amount (USD)', 'Payment Method', 'Notes']]
    for (const r of filtered) {
      rows.push([r.expenseDate, r.category, r.amount.toFixed(2), r.paymentMethod ?? 'Cash', r.notes ?? ''])
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(
      new Blob([rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })
    )
    a.download = `cost-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const dateFilters: { id: DateFilter; label: string }[] = [
    { id: 'all', label: 'All Time' }, { id: '7d', label: '7 Days' },
    { id: '30d', label: '30 Days' }, { id: '90d', label: '90 Days' },
    { id: 'ytd', label: 'YTD' },
  ]

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[1.9rem] font-semibold tracking-tight leading-none mb-1">
            Expense Log
          </h2>
          <p className="text-sm text-muted-foreground">All recorded overheads and operating expenses</p>
        </div>
        <Button onClick={exportCSV} size="sm"
          className="gap-2 border border-primary/20 bg-primary/8 text-primary hover:bg-primary/15 hover:border-primary/30">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { icon: TrendingDown, bg: 'bg-destructive/10', fg: 'text-destructive', label: 'Total Spent',    value: formatUSD(stats.total) },
          { icon: Receipt,      bg: 'bg-primary/10',     fg: 'text-primary',     label: 'Entries',        value: stats.count.toString() },
          { icon: Calendar,     bg: 'bg-amber-500/10',   fg: 'text-amber-400',   label: 'Largest Single', value: stats.largest > 0 ? formatUSD(stats.largest) : '—' },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', card.bg)}>
                <card.icon className={cn('h-4 w-4', card.fg)} />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</div>
                <div className={cn('text-xl font-bold num-display', card.fg)}>{card.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {dateFilters.map(f => (
            <button key={f.id} onClick={() => setDateFilter(f.id)}
              className={cn('rounded-xl border px-4 py-1.5 text-sm font-medium transition-all',
                dateFilter === f.id
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-white/8 bg-white/[0.02] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground')}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="h-9 rounded-xl border border-white/10 bg-[#111] px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none">
          <option value="all">All Categories</option>
          {OVERHEAD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center">
          <Receipt className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground">No costs recorded in this period</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.015]">
                  {['Date', 'Category', 'Amount (USD)', 'Payment', 'Notes', ''].map(h => (
                    <th key={h} className="whitespace-nowrap px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const isEditing  = editingId === row.id
                  const isConfirming = confirmId === row.id

                  return (
                    <>
                      <tr key={row.id}
                        className={cn(
                          'border-b border-white/[0.04] transition-colors',
                          isEditing    ? 'bg-primary/5'      : '',
                          isConfirming ? 'bg-destructive/5'  : '',
                          !isEditing && !isConfirming ? 'hover:bg-white/[0.02]' : '',
                        )}>

                        {/* Date */}
                        <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                          {isEditing ? (
                            <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                              className="h-8 w-36 bg-[#111] border-white/10 focus:border-primary/40 text-xs tabular" />
                          ) : (
                            formatDate(row.expenseDate)
                          )}
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3.5">
                          {isEditing ? (
                            <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
                              className="h-8 rounded-lg border border-white/10 bg-[#111] px-2 text-xs text-foreground focus:border-primary/40 focus:outline-none">
                              {OVERHEAD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <span className={cn(
                              'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                              row.category === 'Exhibition Rent'        ? 'bg-primary/10 text-primary' :
                              row.category === 'Deliveries (Pak to US)' ? 'bg-blue-500/10 text-blue-400' :
                              row.category === 'Supplies'               ? 'bg-amber-500/10 text-amber-400' :
                                                                          'bg-white/[0.05] text-muted-foreground',
                            )}>
                              {row.category}
                            </span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3.5">
                          {isEditing ? (
                            <div className="relative w-28">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                              <Input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                                onWheel={e => e.currentTarget.blur()}
                                min="0.01" step="0.01"
                                className="h-8 pl-5 bg-[#111] border-white/10 focus:border-primary/40 text-xs tabular" />
                            </div>
                          ) : (
                            <span className="font-semibold tabular text-destructive">{formatUSD(row.amount)}</span>
                          )}
                        </td>

                        {/* Payment Method */}
                        <td className="px-4 py-3.5">
                          {isEditing ? (
                            <select value={editPaymentMethod} onChange={e => setEditPaymentMethod(e.target.value)}
                              className="h-8 rounded-lg border border-white/10 bg-[#111] px-2 text-xs text-foreground focus:border-primary/40 focus:outline-none">
                              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          ) : (
                            <span className={cn(
                              'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                              row.paymentMethod === 'Zelle'
                                ? 'bg-violet-500/10 text-violet-400'
                                : 'bg-emerald-500/10 text-emerald-400',
                            )}>
                              {row.paymentMethod ?? 'Cash'}
                            </span>
                          )}
                        </td>

                        {/* Notes */}
                        <td className="px-4 py-3.5 max-w-[220px]">
                          {isEditing ? (
                            <Input value={editNotes} onChange={e => setEditNotes(e.target.value)}
                              placeholder="Notes…"
                              className="h-8 bg-[#111] border-white/10 focus:border-primary/40 text-xs" />
                          ) : (
                            <span className="text-xs text-muted-foreground truncate block">{row.notes || '—'}</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleSave(row.id)} disabled={savingId === row.id}
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/15 text-success hover:bg-success/25 transition-all disabled:opacity-50"
                                title="Save">
                                {savingId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              </button>
                              <button onClick={cancelEdit}
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-muted-foreground hover:bg-white/10 transition-all"
                                title="Cancel">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : isConfirming ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(row.id)} disabled={deletingId === row.id}
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 transition-all disabled:opacity-50"
                                title="Confirm delete">
                                {deletingId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              </button>
                              <button onClick={() => setConfirmId(null)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-muted-foreground hover:bg-white/10 transition-all"
                                title="Cancel">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button onClick={() => startEdit(row)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.02] text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/8 hover:text-primary"
                                title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setConfirmId(row.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.02] text-muted-foreground transition-all hover:border-destructive/30 hover:bg-destructive/8 hover:text-destructive"
                                title="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Confirm banner */}
                      {isConfirming && (
                        <tr key={`${row.id}-confirm`} className="border-b border-destructive/10 bg-destructive/5">
                          <td colSpan={6} className="px-4 py-2 text-xs text-destructive/80">
                            Delete this cost entry? This will also affect dashboard totals. Click the red trash icon to confirm.
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
