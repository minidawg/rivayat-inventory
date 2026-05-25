import { getInventory, getBrands, getExchangeRate, getSettings } from '@/lib/dal'
import { Inventory } from '@/components/panels/inventory'

export default async function InventoryPage() {
  const [inventory, brands, exchangeRate, settings] = await Promise.all([
    getInventory(),
    getBrands(),
    getExchangeRate(),
    getSettings(),
  ])

  return (
    <Inventory
      inventory={inventory}
      brands={brands}
      exchangeRate={exchangeRate}
      lowStockAlertsEnabled={settings.lowStockAlerts}
    />
  )
}
