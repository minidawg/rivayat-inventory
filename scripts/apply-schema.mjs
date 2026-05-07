import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// Prefer process.env (set via --env-file); fall back to manual parse for direct `node` invocations
function loadEnv() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env

  const raw = readFileSync(join(root, '.env.local'), 'utf-8').replace(/\r\n/g, '\n')
  const parsed = Object.fromEntries(
    raw.split('\n')
      .filter(l => l && !l.startsWith('#') && l.includes('='))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
  )
  return { ...process.env, ...parsed }
}

const env = loadEnv()

const token = env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN in .env.local')
  console.error('Get it from: https://supabase.com/dashboard/account/tokens')
  process.exit(1)
}

const ref = env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
if (!ref) { console.error('Cannot parse project ref from NEXT_PUBLIC_SUPABASE_URL'); process.exit(1) }

const sql = readFileSync(join(root, 'supabase', 'migrations', '0001_initial_schema.sql'), 'utf-8')

console.log(`Applying schema to project ${ref} …`)

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})

const body = await res.json()
if (!res.ok) {
  console.error('Failed:', JSON.stringify(body, null, 2))
  process.exit(1)
}
console.log('Schema applied successfully.')
