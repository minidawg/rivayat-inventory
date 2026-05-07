import { getBrands } from '@/lib/dal'
import { Settings } from '@/components/panels/settings'

export default async function SettingsPage() {
  const brands = await getBrands()
  return <Settings brands={brands} />
}
