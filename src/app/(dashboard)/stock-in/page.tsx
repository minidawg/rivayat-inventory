import { getBrands, getExchangeRate } from '@/lib/dal'
import { StockIn } from '@/components/panels/stock-in'

export default async function StockInPage() {
  const [brands, exchangeRate] = await Promise.all([
    getBrands(),
    getExchangeRate(),
  ])

  return <StockIn brands={brands} exchangeRate={exchangeRate} />
}
