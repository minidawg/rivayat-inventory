import { getPurchases, getExchangeRate } from '@/lib/dal'
import { PurchaseLog } from '@/components/panels/purchase-log'

export default async function PurchasesPage() {
  const [purchases, exchangeRate] = await Promise.all([
    getPurchases(),
    getExchangeRate(),
  ])

  return <PurchaseLog purchases={purchases} exchangeRate={exchangeRate} />
}
