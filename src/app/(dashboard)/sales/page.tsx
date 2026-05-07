import { getSales, getExchangeRate } from '@/lib/dal'
import { SalesLog } from '@/components/panels/sales-log'

export default async function SalesPage() {
  const [sales, exchangeRate] = await Promise.all([
    getSales(),
    getExchangeRate(),
  ])

  return <SalesLog sales={sales} exchangeRate={exchangeRate} />
}
