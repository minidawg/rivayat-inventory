'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { recordCost } from '@/lib/actions'
import { OVERHEAD_CATEGORIES, PAYMENT_METHODS } from '@/lib/types'
import { Receipt, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </label>
  )
}

const selectClass =
  'h-11 w-full rounded-xl border border-white/10 bg-[#111] px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none'

export function RecordCost() {
  const router = useRouter()

  const todayISO = new Date().toISOString().slice(0, 10)

  const [category,       setCategory]       = useState<string>(OVERHEAD_CATEGORIES[0])
  const [amount,         setAmount]         = useState('')
  const [date,           setDate]           = useState(todayISO)
  const [notes,          setNotes]          = useState('')
  const [paymentMethod,  setPaymentMethod]  = useState<string>('Cash')
  const [isSubmitting,   setIsSubmitting]   = useState(false)
  const [success,        setSuccess]        = useState(false)

  const isValid = !!category && !!amount && Number(amount) > 0 && !!date

  async function handleSubmit() {
    if (!isValid) return
    setIsSubmitting(true)
    try {
      const result = await recordCost(category, Number(amount), date, notes, paymentMethod)
      if (result?.error) {
        toast.error(result.error)
      } else {
        setSuccess(true)
        toast.success('Cost recorded.')
        setTimeout(() => {
          setSuccess(false)
          setCategory(OVERHEAD_CATEGORIES[0])
          setAmount('')
          setDate(todayISO)
          setNotes('')
          setPaymentMethod('Cash')
          router.refresh()
        }, 1400)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Something went wrong.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h2 className="font-[family-name:var(--font-display)] text-[1.9rem] font-semibold tracking-tight leading-none mb-1">
          Record Expense
        </h2>
        <p className="text-sm text-muted-foreground">Log business overheads and operating expenses</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Form */}
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Receipt className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold">Expense Details</h3>
          </div>

          {/* Category */}
          <div>
            <FieldLabel>Category *</FieldLabel>
            <select value={category} onChange={e => setCategory(e.target.value)} className={selectClass}>
              {OVERHEAD_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Amount + Date row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Amount (USD) *</FieldLabel>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  onWheel={e => e.currentTarget.blur()}
                  placeholder="e.g. 150"
                  min="0.01"
                  step="0.01"
                  className="pl-7 h-11 bg-[#111] border-white/10 focus:border-primary/40 tabular"
                />
              </div>
            </div>

            <div>
              <FieldLabel>Date *</FieldLabel>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="h-11 bg-[#111] border-white/10 focus:border-primary/40 tabular"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <FieldLabel>Payment Method *</FieldLabel>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={selectClass}>
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <FieldLabel>Notes <span className="font-normal lowercase tracking-normal text-muted-foreground/50">(optional)</span></FieldLabel>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Desi Artisan NJ — booth fee July"
              rows={3}
              className={cn(
                'w-full rounded-xl border bg-[#111] px-4 py-3 text-sm text-foreground resize-none',
                'border-white/10 focus:border-primary/40 focus:outline-none placeholder:text-muted-foreground/40',
              )}
            />
          </div>
        </div>

        {/* Summary sidebar */}
        <div>
          <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-6 sticky top-8">
            <h3 className="text-sm font-semibold mb-5 pb-4 border-b border-white/5">Summary</h3>

            <div className="space-y-3">
              <div className="rounded-xl bg-white/[0.03] px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Category</div>
                <div className="text-sm font-semibold">{category}</div>
              </div>

              <div className={cn(
                'rounded-xl border px-4 py-3',
                Number(amount) > 0
                  ? 'border-destructive/25 bg-destructive/8'
                  : 'border-white/6 bg-white/[0.03]',
              )}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Amount</div>
                <div className={cn(
                  'text-2xl font-bold num-display',
                  Number(amount) > 0 ? 'text-destructive' : 'text-muted-foreground/30',
                )}>
                  {Number(amount) > 0 ? `$${Number(amount).toFixed(2)}` : '—'}
                </div>
              </div>

              <div className="rounded-xl bg-white/[0.03] px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Date</div>
                <div className="text-sm font-semibold tabular">{date}</div>
              </div>

              <div className="rounded-xl bg-white/[0.03] px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Payment Method</div>
                <div className="text-sm font-semibold">{paymentMethod}</div>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting || success}
              className={cn(
                'w-full mt-6 h-12 font-semibold text-sm transition-all',
                success
                  ? 'bg-success/20 border border-success/30 text-success'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {success ? (
                <><CheckCircle2 className="mr-2 h-4 w-4" /> Recorded!</>
              ) : isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording…</>
              ) : (
                <><Receipt className="mr-2 h-4 w-4" /> Record Expense</>
              )}
            </Button>

            {!isValid && (
              <p className="mt-3 text-center text-[11px] text-muted-foreground/60">
                {!amount || Number(amount) <= 0 ? 'Enter a valid amount' : 'Fill all required fields'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
