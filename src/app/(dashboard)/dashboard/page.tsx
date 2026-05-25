import { getSkuStats, getSales, getPurchases, getExchangeRate, getSettings, getTotalOverheads } from '@/lib/dal'
import { Dashboard } from '@/components/panels/dashboard'

export default async function DashboardPage() {
  const [skus, sales, purchases, exchangeRate, settings, totalOverheadsUSD] = await Promise.all([
    getSkuStats(),
    getSales(),
    getPurchases(),
    getExchangeRate(),
    getSettings(),
    getTotalOverheads(),
  ])

  return (
    <Dashboard
      skus={skus}
      sales={sales}
      purchases={purchases}
      exchangeRate={exchangeRate}
      lowStockAlertsEnabled={settings.lowStockAlerts}
      totalOverheadsUSD={totalOverheadsUSD}
    />
  )
}
