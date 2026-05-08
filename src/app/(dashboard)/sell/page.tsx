import { getInventory, getSales, getExchangeRate } from '@/lib/dal'
import { Sell } from '@/components/panels/sell'

export default async function SellPage() {
  const [inventory, sales, exchangeRate] = await Promise.all([
    getInventory(),
    getSales(),
    getExchangeRate(),
  ])

  const previousClients = Array.from(
    new Set(sales.map(s => s.clientName).filter((n): n is string => !!n))
  ).sort()

  return (
    <Sell
      inventory={inventory}
      exchangeRate={exchangeRate}
      previousClients={previousClients}
    />
  )
}
