// Client-safe utility functions used by the v0 panels.
// No server-only imports here.

export { formatPKR, formatUSD } from '@/lib/format'

export function totalCostPKR(costPKR: number, commissionPKR: number, shippingPKR: number): number {
  return costPKR + commissionPKR + shippingPKR
}

export function suggestedSellPrice(costPKR: number, commissionPKR: number, shippingPKR: number): number {
  return Math.round(totalCostPKR(costPKR, commissionPKR, shippingPKR) * 1.35)
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
