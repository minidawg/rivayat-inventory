import { getBrands, getSettings } from '@/lib/dal'
import { Settings } from '@/components/panels/settings'

export default async function SettingsPage() {
  const [brands, settings] = await Promise.all([getBrands(), getSettings()])
  return <Settings brands={brands} lowStockAlerts={settings.lowStockAlerts} usdRate={settings.usdRate} />
}
