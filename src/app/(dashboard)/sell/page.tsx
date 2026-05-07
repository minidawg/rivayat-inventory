import { getInventory, getExchangeRate } from '@/lib/dal'
import { Sell } from '@/components/panels/sell'

export default async function SellPage() {
  const [inventory, exchangeRate] = await Promise.all([
    getInventory(),
    getExchangeRate(),
  ])

  return <Sell inventory={inventory} exchangeRate={exchangeRate} />
}
