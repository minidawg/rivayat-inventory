/**
 * Seed script: Pakistani fashion brands + collections
 * Uses the Supabase Management API (same as apply-schema.mjs).
 * Run: node --env-file=.env.local scripts/seed-brands.mjs
 */

// ─── Brand / collection data ──────────────────────────────────────────────────

const BRANDS = [
  // Luxury / High-End
  { name: 'Sammy K',               collections: ['Formals', 'Bridals', 'Luxury Pret', 'Couture'] },
  { name: 'Faiza Saqlain',         collections: ['Luxury Formals', 'Bridals', 'Pret', 'Couture'] },
  { name: 'Suffuse by Sana Yasir', collections: ['Bridals', 'Luxury Formals', 'Pret'] },
  { name: 'Elan',                  collections: ['Lawn', 'Luxury Formals', 'Bridals', 'Pret', 'Festive'] },
  { name: 'Republic Womenswear',   collections: ['Luxury Formals', 'Bridals', 'Pret'] },
  { name: 'Misha Lakhani',         collections: ['Bridals', 'Luxury Formals', 'Resort'] },
  { name: 'Fahad Hussayn',         collections: ['Couture', 'Bridals', 'Luxury Formals'] },
  { name: 'HSY',                   collections: ['Bridals', 'Couture', 'Luxury Formals', 'Menswear'] },
  { name: 'Karma',                 collections: ['Luxury Formals', 'Pret', 'Festive'] },
  { name: 'Zara Shahjahan',        collections: ['Lawn', 'Luxury Formals', 'Pret', 'Festive', 'Winter'] },
  // Premium
  { name: 'Sana Safinaz',  collections: ['Lawn', 'Festive', 'Winter', 'Pret', 'Luxury Formals', 'Muzlin'] },
  { name: 'Maria B',        collections: ['Lawn', 'Linen', 'Mbroidered', 'Pret', 'Bridals', 'Evening Wear'] },
  { name: 'Asim Jofa',      collections: ['Lawn', 'Luxury Formals', 'Pret', 'Festive', 'Orne'] },
  { name: 'Mushq',          collections: ['Lawn', 'Luxury Formals', 'Pret', 'Festive', 'Chikankari'] },
  { name: 'Rang Rasiya',    collections: ['Lawn', 'Premium Lawn', 'Festive', 'Winter', 'Pret'] },
  { name: 'Cross Stitch',   collections: ['Lawn', 'Pret', 'Winter', 'Festive'] },
  { name: 'Emaan Adeel',    collections: ['Luxury Formals', 'Bridals', 'Pret', 'Festive'] },
  { name: 'Jazmin',         collections: ['Lawn', 'Luxury Formals', 'Pret', 'Festive', 'Chiffon'] },
  { name: 'Nureh',          collections: ['Lawn', 'Luxury Formals', 'Festive', 'Wedding'] },
  { name: 'Qalamkar',       collections: ['Lawn', 'Luxury Formals', 'Pret', 'Festive', 'Bridals'] },
  { name: 'Sapphire',       collections: ['Lawn', 'Pret', 'Winter', 'Unstitched', 'Daily Wear'] },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ref   = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
const token = process.env.SUPABASE_ACCESS_TOKEN

if (!ref)   { console.error('NEXT_PUBLIC_SUPABASE_URL missing'); process.exit(1) }
if (!token) { console.error('SUPABASE_ACCESS_TOKEN missing');    process.exit(1) }

async function sql(query) {
  const res  = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query }),
  })
  const body = await res.json()
  if (!res.ok) {
    const msg = body?.message || body?.error || JSON.stringify(body)
    throw new Error(`SQL error: ${msg}\nQuery: ${query.slice(0, 200)}`)
  }
  return body   // array of row objects
}

function esc(s) { return s.replace(/'/g, "''") }

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n🔗  Project: ${ref}\n`)

// Fetch ALL existing brands (limit 1000 to bypass any default pagination)
const existingBrands = await sql('SELECT id, name FROM brands LIMIT 1000')
const brandByName    = Object.fromEntries(existingBrands.map(b => [b.name.toLowerCase(), b]))
console.log(`Existing brands (${existingBrands.length}): ${existingBrands.map(b => b.name).join(', ') || '(none)'}`)

// Fetch ALL existing collections
const existingCols = await sql('SELECT brand_id, name FROM collections LIMIT 5000')
const collSet = new Set(existingCols.map(c => `${c.brand_id}::${c.name.toLowerCase()}`))
console.log(`Existing collections: ${existingCols.length}\n`)

let brandsAdded = 0, brandsSkipped = 0, colsAdded = 0, colsSkipped = 0

for (const entry of BRANDS) {
  const nameKey = entry.name.toLowerCase()
  let brand     = brandByName[nameKey]

  if (!brand) {
    // Upsert: insert or return existing row — handles any race / pre-existing data
    const rows = await sql(`
      INSERT INTO brands (name) VALUES ('${esc(entry.name)}')
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name
    `)
    brand = rows[0]
    brandByName[nameKey] = brand

    // Was it really new or did it conflict?
    const alreadyExisted = existingBrands.some(b => b.name.toLowerCase() === nameKey)
    if (alreadyExisted) {
      // Upsert hit the conflict path — treat as existing
      console.log(`  ○ Brand exists:  ${brand.name}`)
      brandsSkipped++
    } else {
      console.log(`  ✚ Brand added:   ${brand.name}`)
      brandsAdded++
    }
  } else {
    console.log(`  ○ Brand exists:  ${brand.name}`)
    brandsSkipped++
  }

  // Collections — upsert each to be safe
  for (const colName of entry.collections) {
    const colKey = `${brand.id}::${colName.toLowerCase()}`
    if (collSet.has(colKey)) {
      colsSkipped++
    } else {
      await sql(`
        INSERT INTO collections (brand_id, name) VALUES ('${brand.id}', '${esc(colName)}')
        ON CONFLICT (brand_id, name) DO NOTHING
      `)
      collSet.add(colKey)
      console.log(`    ✚ Collection:  ${colName}`)
      colsAdded++
    }
  }
}

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Brands       added: ${String(brandsAdded).padStart(3)}   skipped: ${String(brandsSkipped).padStart(3)}
  Collections  added: ${String(colsAdded).padStart(3)}   skipped: ${String(colsSkipped).padStart(3)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Done.
`)
