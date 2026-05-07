'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addBrand, deleteBrand, addCollection, deleteCollection, clearAllData } from '@/lib/actions'
import type { BrandWithCollections } from '@/lib/types'
import { ChevronDown, ChevronUp, Plus, X, Loader2, Settings as SettingsIcon, AlertTriangle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsProps {
  brands: BrandWithCollections[]
  onSuccess?: () => void
}

export function Settings({ brands, onSuccess }: SettingsProps) {
  const router = useRouter()
  
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null)
  const [newBrandName, setNewBrandName] = useState('')
  const [newCollectionNames, setNewCollectionNames] = useState<Record<string, string>>({})
  const [isAddingBrand, setIsAddingBrand] = useState(false)
  const [addingCollectionFor, setAddingCollectionFor] = useState<string | null>(null)
  const [isClearing, setIsClearing] = useState(false)

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) return
    
    setIsAddingBrand(true)
    try {
      await addBrand(newBrandName.trim())
      router.refresh()
      setNewBrandName('')
      onSuccess?.()
    } catch (error) {
      console.error('Error adding brand:', error)
    } finally {
      setIsAddingBrand(false)
    }
  }

  const handleDeleteBrand = async (brandId: string) => {
    if (!confirm('Delete this brand and all its collections? Articles and stock will remain.')) return
    
    try {
      await deleteBrand(brandId)
      router.refresh()
      onSuccess?.()
    } catch (error) {
      console.error('Error deleting brand:', error)
    }
  }

  const handleAddCollection = async (brandId: string) => {
    const name = newCollectionNames[brandId]?.trim()
    if (!name) return
    
    setAddingCollectionFor(brandId)
    try {
      await addCollection(name, brandId)
      router.refresh()
      setNewCollectionNames({ ...newCollectionNames, [brandId]: '' })
      onSuccess?.()
    } catch (error) {
      console.error('Error adding collection:', error)
    } finally {
      setAddingCollectionFor(null)
    }
  }

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm('Delete this collection? Articles and stock will remain.')) return
    
    try {
      await deleteCollection(collectionId)
      router.refresh()
      onSuccess?.()
    } catch (error) {
      console.error('Error deleting collection:', error)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Delete ALL inventory data? This includes all SKUs, purchases, and sales. Brands will be kept.')) return
    if (!confirm('Are you absolutely sure? This cannot be undone.')) return
    
    setIsClearing(true)
    try {
      await clearAllData()
      router.refresh()
      onSuccess?.()
    } catch (error) {
      console.error('Error clearing data:', error)
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight mb-1">
          Brands & Settings
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage your brands, collections, and system preferences
        </p>
      </div>

      {/* Brands Management */}
      <div className="glass rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Brands & Collections</h3>
            <p className="text-xs text-muted-foreground">Organize your inventory by brands</p>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          {brands.map(brand => (
            <div 
              key={brand.id} 
              className={cn(
                "rounded-xl border transition-all overflow-hidden",
                expandedBrand === brand.id 
                  ? "border-primary/30 bg-primary/5" 
                  : "border-white/10 bg-white/[0.02]"
              )}
            >
              {/* Brand Header */}
              <button
                onClick={() => setExpandedBrand(expandedBrand === brand.id ? null : brand.id)}
                className="flex w-full items-center justify-between px-5 py-4"
              >
                <span className="text-base font-semibold">{brand.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {brand.collections.length} collections
                  </span>
                  {expandedBrand === brand.id ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Collections */}
              {expandedBrand === brand.id && (
                <div className="border-t border-white/5 px-5 py-4">
                  {/* Collection Tags */}
                  <div className="mb-4 flex flex-wrap gap-2">
                    {brand.collections.map(coll => (
                      <span
                        key={coll.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm"
                      >
                        {coll.name}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteCollection(coll.id)
                          }}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                    {brand.collections.length === 0 && (
                      <span className="text-sm text-muted-foreground">No collections yet</span>
                    )}
                  </div>

                  {/* Add Collection */}
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      value={newCollectionNames[brand.id] || ''}
                      onChange={(e) => setNewCollectionNames({ ...newCollectionNames, [brand.id]: e.target.value })}
                      placeholder="New collection name..."
                      className="h-10 min-w-[180px] flex-1 bg-white/[0.03] border-white/10 focus:border-primary/40"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCollection(brand.id)
                      }}
                    />
                    <Button
                      onClick={() => handleAddCollection(brand.id)}
                      disabled={!newCollectionNames[brand.id]?.trim() || addingCollectionFor === brand.id}
                      size="sm"
                      className="h-10 gap-2 bg-success/20 border border-success/30 text-success hover:bg-success/30"
                    >
                      {addingCollectionFor === brand.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Add Collection
                    </Button>
                  </div>

                  {/* Delete Brand */}
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <Button
                      onClick={() => handleDeleteBrand(brand.id)}
                      size="sm"
                      className="gap-2 bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20"
                    >
                      <X className="h-4 w-4" />
                      Delete Brand
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Brand */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/5">
          <Input
            value={newBrandName}
            onChange={(e) => setNewBrandName(e.target.value)}
            placeholder="New brand name..."
            className="h-11 flex-1 bg-white/[0.03] border-white/10 focus:border-primary/40"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddBrand()
            }}
          />
          <Button
            onClick={handleAddBrand}
            disabled={!newBrandName.trim() || isAddingBrand}
            className="h-11 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isAddingBrand ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Brand
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-destructive/20">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/20 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-destructive">Danger Zone</h3>
            <p className="text-xs text-destructive/70">Irreversible actions that affect your data</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button
            onClick={handleClearAll}
            disabled={isClearing}
            className="gap-2 bg-destructive/20 border border-destructive/30 text-destructive hover:bg-destructive/30"
          >
            {isClearing && <Loader2 className="h-4 w-4 animate-spin" />}
            Clear All Data
          </Button>
          <span className="text-sm text-destructive/70">
            Deletes all SKUs, purchases, and sales. Brands will be kept.
          </span>
        </div>
      </div>
    </div>
  )
}
