import { getSkuStats, getSales, getPurchases, getExchangeRate } from '@/lib/dal'
import { Dashboard } from '@/components/panels/dashboard'

export default async function DashboardPage() {
  const [skus, sales, purchases, exchangeRate] = await Promise.all([
    getSkuStats(),
    getSales(),
    getPurchases(),
    getExchangeRate(),
  ])

  return (
    <Dashboard
      skus={skus}
      sales={sales}
      purchases={purchases}
      exchangeRate={exchangeRate}
    />
  )
}
