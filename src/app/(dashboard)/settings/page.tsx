import { getBrands, getSettings, getAuditLog, getAppChangelog } from '@/lib/dal'
import { Settings } from '@/components/panels/settings'

export default async function SettingsPage() {
  const [brands, settings, auditLog, changelog] = await Promise.all([
    getBrands(),
    getSettings(),
    getAuditLog(50),
    getAppChangelog(),
  ])
  return (
    <Settings
      brands={brands}
      lowStockAlerts={settings.lowStockAlerts}
      usdRate={settings.usdRate}
      auditLog={auditLog}
      changelog={changelog}
    />
  )
}
