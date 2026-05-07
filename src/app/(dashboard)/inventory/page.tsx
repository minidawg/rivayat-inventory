import { getInventory, getBrands, getExchangeRate } from '@/lib/dal'
import { Inventory } from '@/components/panels/inventory'

export default async function InventoryPage() {
  const [inventory, brands, exchangeRate] = await Promise.all([
    getInventory(),
    getBrands(),
    getExchangeRate(),
  ])

  return (
    <Inventory
      inventory={inventory}
      brands={brands}
      exchangeRate={exchangeRate}
    />
  )
}
