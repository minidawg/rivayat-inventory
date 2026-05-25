import { getOverheads } from '@/lib/dal'
import { CostLog } from '@/components/panels/cost-log'

export default async function CostsPage() {
  const overheads = await getOverheads()
  return <CostLog overheads={overheads} />
}
