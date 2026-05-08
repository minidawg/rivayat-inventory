'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addBrand, deleteBrand, addCollection, deleteCollection, clearAllData } from '@/lib/actions'
import type { BrandWithCollections } from '@/lib/types'
import { ChevronDown, ChevronUp, Plus, X, Loader2, AlertTriangle, Sparkles, Search, Check, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsProps {
  brands: BrandWithCollections[]
  onSuccess?: () => void
}

export function Settings({ brands, onSuccess }: SettingsProps) {
  const router = useRouter()

  const [expandedBrand,      setExpandedBrand]      = useState<string | null>(null)
  const [brandSearch,        setBrandSearch]         = useState('')
  const [newBrandName,       setNewBrandName]        = useState('')
  const [isAddingBrand,      setIsAddingBrand]       = useState(false)
  const [confirmDeleteBrand, setConfirmDeleteBrand]  = useState<string | null>(null)
  const [deletingBrandId,    setDeletingBrandId]     = useState<string | null>(null)
  const [newColNames,        setNewColNames]         = useState<Record<string, string>>({})
  const [addingColFor,       setAddingColFor]        = useState<string | null>(null)
  const [confirmDeleteCol,   setConfirmDeleteCol]    = useState<string | null>(null)
  const [deletingColId,      setDeletingColId]       = useState<string | null>(null)

  // Danger zone
  const [clearInput,  setClearInput]  = useState('')
  const [isClearing,  setIsClearing]  = useState(false)
  const [showClearBox, setShowClearBox] = useState(false)

  const filteredBrands = useMemo(() => {
    if (!brandSearch.trim()) return brands
    const t = brandSearch.toLowerCase()
    return brands.filter(b =>
      b.name.toLowerCase().includes(t) ||
      b.collections.some(c => c.name.toLowerCase().includes(t))
    )
  }, [brands, brandSearch])

  // ── Brand actions ─────────────────────────────────────────────────────────
  async function handleAddBrand() {
    if (!newBrandName.trim()) return
    setIsAddingBrand(true)
    try {
      await addBrand(newBrandName.trim())
      router.refresh(); setNewBrandName(''); onSuccess?.()
    } catch (err) { console.error(err) }
    finally { setIsAddingBrand(false) }
  }

  async function handleDeleteBrand(brandId: string) {
    setDeletingBrandId(brandId)
    try {
      await deleteBrand(brandId)
      router.refresh(); setConfirmDeleteBrand(null); onSuccess?.()
    } catch (err) { console.error(err) }
    finally { setDeletingBrandId(null) }
  }

  // ── Collection actions ────────────────────────────────────────────────────
  async function handleAddCollection(brandId: string) {
    const name = newColNames[brandId]?.trim()
    if (!name) return
    setAddingColFor(brandId)
    try {
      await addCollection(name, brandId)
      router.refresh()
      setNewColNames(prev => ({ ...prev, [brandId]: '' }))
      onSuccess?.()
    } catch (err) { console.error(err) }
    finally { setAddingColFor(null) }
  }

  async function handleDeleteCollection(colId: string) {
    setDeletingColId(colId)
    try {
      await deleteCollection(colId)
      router.refresh(); setConfirmDeleteCol(null); onSuccess?.()
    } catch (err) { console.error(err) }
    finally { setDeletingColId(null) }
  }

  // ── Clear all ─────────────────────────────────────────────────────────────
  async function handleClearAll() {
    if (clearInput !== 'DELETE') return
    setIsClearing(true)
    try {
      await clearAllData()
      router.refresh(); setClearInput(''); setShowClearBox(false); onSuccess?.()
    } catch (err) { console.error(err) }
    finally { setIsClearing(false) }
  }

  const totalCollections = brands.reduce((s, b) => s + b.collections.length, 0)

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-[family-name:var(--font-display)] text-[1.9rem] font-semibold tracking-tight leading-none mb-1">
          Brands & Settings
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage brands, collections, and system preferences
        </p>
      </div>

      {/* Brands & Collections */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-6 mb-5">
        {/* Section header */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-none">Brands & Collections</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {brands.length} brands · {totalCollections} collections
            </p>
          </div>
        </div>

        {/* Search */}
        {brands.length > 4 && (
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={brandSearch}
              onChange={e => setBrandSearch(e.target.value)}
              placeholder="Filter brands or collections…"
              className="pl-10 h-9 bg-[#111] border-white/10 focus:border-primary/40 text-sm"
            />
          </div>
        )}

        {/* Brand list */}
        <div className="space-y-2 mb-5">
          {filteredBrands.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No brands match your search</p>
          ) : (
            filteredBrands.map(brand => {
              const isExpanded = expandedBrand === brand.id
              const isConfirmingDelete = confirmDeleteBrand === brand.id

              return (
                <div
                  key={brand.id}
                  className={cn(
                    'rounded-xl border overflow-hidden transition-all duration-200',
                    isExpanded
                      ? 'border-primary/20 bg-[#1A1A1A]'
                      : 'border-white/6 bg-[#111]/60 hover:border-white/10',
                  )}
                >
                  {/* Brand row */}
                  <button
                    onClick={() => {
                      setExpandedBrand(isExpanded ? null : brand.id)
                      setConfirmDeleteBrand(null)
                      setConfirmDeleteCol(null)
                    }}
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isExpanded && (
                        <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      )}
                      <span className={cn('text-sm font-semibold truncate', isExpanded && 'text-primary')}>
                        {brand.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-[11px] text-muted-foreground tabular">
                        {brand.collections.length} {brand.collections.length === 1 ? 'collection' : 'collections'}
                      </span>
                      {isExpanded
                        ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      }
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-white/5 px-4 py-4 space-y-4">
                      {/* Collection chips */}
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2">
                          Collections
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {brand.collections.map(col => {
                            const isConfirmingColDelete = confirmDeleteCol === col.id
                            const isDeletingThis = deletingColId === col.id
                            return (
                              <span
                                key={col.id}
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all',
                                  isConfirmingColDelete
                                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                                    : 'border-white/8 bg-white/[0.04] text-foreground',
                                )}
                              >
                                {col.name}
                                {isConfirmingColDelete ? (
                                  // Confirm state: show check + cancel
                                  <span className="flex items-center gap-1 ml-0.5">
                                    <button
                                      onClick={() => handleDeleteCollection(col.id)}
                                      disabled={isDeletingThis}
                                      className="text-destructive hover:text-destructive/70 transition-colors"
                                      title="Confirm delete"
                                    >
                                      {isDeletingThis
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : <Check className="h-3 w-3" />
                                      }
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteCol(null)}
                                      className="text-muted-foreground hover:text-foreground transition-colors"
                                      title="Cancel"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteCol(col.id)}
                                    className="text-muted-foreground/50 hover:text-destructive transition-colors ml-0.5"
                                    title="Delete collection"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            )
                          })}
                          {brand.collections.length === 0 && (
                            <span className="text-xs text-muted-foreground/50 italic">No collections yet</span>
                          )}
                        </div>
                      </div>

                      {/* Add collection */}
                      <div className="flex items-center gap-2">
                        <Input
                          value={newColNames[brand.id] || ''}
                          onChange={e => setNewColNames(prev => ({ ...prev, [brand.id]: e.target.value }))}
                          placeholder="New collection name…"
                          className="h-9 flex-1 bg-[#111] border-white/10 focus:border-primary/40 text-sm"
                          onKeyDown={e => { if (e.key === 'Enter') handleAddCollection(brand.id) }}
                        />
                        <Button
                          onClick={() => handleAddCollection(brand.id)}
                          disabled={!newColNames[brand.id]?.trim() || addingColFor === brand.id}
                          size="sm"
                          className="h-9 gap-1.5 shrink-0 bg-success/10 border border-success/20 text-success hover:bg-success/20 hover:border-success/30"
                        >
                          {addingColFor === brand.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Plus className="h-3.5 w-3.5" />
                          }
                          Add
                        </Button>
                      </div>

                      {/* Delete brand */}
                      <div className="pt-3 border-t border-white/5">
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-destructive/80">Delete "{brand.name}" and all its collections?</span>
                            <Button
                              onClick={() => handleDeleteBrand(brand.id)}
                              disabled={deletingBrandId === brand.id}
                              size="sm"
                              className="h-7 gap-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs"
                            >
                              {deletingBrandId === brand.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Trash2 className="h-3 w-3" />
                              }
                              Confirm
                            </Button>
                            <Button
                              onClick={() => setConfirmDeleteBrand(null)}
                              size="sm"
                              variant="outline"
                              className="h-7 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteBrand(brand.id)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete brand
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Add brand */}
        <div className="flex items-center gap-3 pt-4 border-t border-white/5">
          <Input
            value={newBrandName}
            onChange={e => setNewBrandName(e.target.value)}
            placeholder="New brand name…"
            className="h-11 flex-1 bg-[#111] border-white/10 focus:border-primary/40"
            onKeyDown={e => { if (e.key === 'Enter') handleAddBrand() }}
          />
          <Button
            onClick={handleAddBrand}
            disabled={!newBrandName.trim() || isAddingBrand}
            className="h-11 gap-2 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isAddingBrand
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Plus className="h-4 w-4" />
            }
            Add Brand
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-6">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-destructive/15">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-destructive leading-none">Danger Zone</h3>
            <p className="text-[11px] text-destructive/60 mt-0.5">Irreversible actions — proceed with care</p>
          </div>
        </div>

        {!showClearBox ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-destructive/80">Clear All Inventory Data</p>
              <p className="text-xs text-destructive/50 mt-0.5">
                Deletes all SKUs, purchases, and sales. Brands and collections are kept.
              </p>
            </div>
            <Button
              onClick={() => setShowClearBox(true)}
              className="gap-2 border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 shrink-0"
            >
              <Trash2 className="h-4 w-4" />
              Clear All Data
            </Button>
          </div>
        ) : (
          <div className="space-y-3 animate-slide-up">
            <p className="text-sm text-destructive/80">
              This will permanently delete all SKUs, purchase records, and sales. Brands and collections will remain intact.
            </p>
            <p className="text-xs font-semibold text-destructive/70 uppercase tracking-wider">
              Type <span className="font-mono bg-destructive/10 px-1.5 py-0.5 rounded">DELETE</span> to confirm
            </p>
            <div className="flex items-center gap-3">
              <Input
                value={clearInput}
                onChange={e => setClearInput(e.target.value)}
                placeholder="Type DELETE…"
                className="h-10 bg-[#111] border-destructive/20 focus:border-destructive/50 font-mono text-destructive placeholder:text-destructive/30"
                onKeyDown={e => { if (e.key === 'Enter') handleClearAll() }}
                autoFocus
              />
              <Button
                onClick={handleClearAll}
                disabled={clearInput !== 'DELETE' || isClearing}
                className="h-10 shrink-0 bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
              >
                {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
              <Button
                onClick={() => { setShowClearBox(false); setClearInput('') }}
                variant="outline"
                className="h-10 shrink-0 border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
