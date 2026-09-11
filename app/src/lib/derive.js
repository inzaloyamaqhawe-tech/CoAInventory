import { CATALOG } from '../data/catalog'
import { BRANCHES } from '../data/branches'

const productBySku = Object.fromEntries(CATALOG.map((p) => [p.sku, p]))

const SWATCH_CLASS = {
  Accessories: 'swatch-accessories',
  Loungewear: 'swatch-loungewear',
  Outerwear: 'swatch-outerwear',
  'Denim & Bottoms': 'swatch-denim',
  Skirts: 'swatch-skirts',
}
export function swatchClass(category) {
  return SWATCH_CLASS[category] ?? 'swatch-loungewear'
}
export function priceOf(sku) {
  const p = productBySku[sku]
  return p?.salePriceCents ?? p?.priceCents ?? 0
}
export function productOf(sku) {
  return productBySku[sku]
}

// "Revenue" here is a straightforward proxy — soldLast14d × price, summed —
// not a full sales-ledger rollup (that's sales_daily in 05-DATA-MODEL.md,
// left for the real backend). Real enough to rank branches and products.
export function branchRevenue14d(stockLevels, branchId) {
  return stockLevels
    .filter((r) => r.branchId === branchId)
    .reduce((sum, r) => sum + r.soldLast14d * priceOf(r.sku), 0)
}

export function branchUnits14d(stockLevels, branchId) {
  return stockLevels.filter((r) => r.branchId === branchId).reduce((sum, r) => sum + r.soldLast14d, 0)
}

// Top-selling products by units, last 14 days — summed across every size
// and, unless scoped to one branchId, every retail branch at once. This is
// "what's actually flying off the shelf company-wide," not a per-branch
// view (that's topMover below).
export function topProducts(stockLevels, branchId, limit = 5) {
  const scoped = stockLevels.filter((r) => r.branchId !== 'WH' && (!branchId || r.branchId === branchId))
  const unitsBySku = {}
  for (const r of scoped) {
    unitsBySku[r.sku] = (unitsBySku[r.sku] ?? 0) + r.soldLast14d
  }
  return Object.entries(unitsBySku)
    .map(([sku, units]) => ({ product: productOf(sku), units }))
    .filter((x) => x.units > 0)
    .sort((a, b) => b.units - a.units)
    .slice(0, limit)
}

export function leaderboard(stockLevels) {
  return BRANCHES.filter((b) => b.type === 'retail')
    .map((b) => ({ branch: b, revenue: branchRevenue14d(stockLevels, b.id), units: branchUnits14d(stockLevels, b.id) }))
    .sort((a, b) => b.revenue - a.revenue)
}

export function topMover(stockLevels, branchId) {
  const rows = stockLevels.filter((r) => r.branchId === branchId && r.soldLast14d > 0)
  if (!rows.length) return null
  const best = rows.reduce((a, b) => (b.soldLast14d > a.soldLast14d ? b : a))
  return { row: best, product: productOf(best.sku) }
}

export function coldest(stockLevels, branchId) {
  const rows = stockLevels.filter((r) => r.branchId === branchId && r.soldLast14d === 0 && r.qtyOnHand > r.reorderPoint)
  if (!rows.length) return null
  const worst = rows.reduce((a, b) => (b.qtyOnHand > a.qtyOnHand ? b : a))
  return { row: worst, product: productOf(worst.sku) }
}

// A 14-day daily series for charting, built by spreading the known 14-day
// total across days with a smooth deterministic weekly pattern (weekends
// busier) rather than a flat line — this is presentation shaping of a real
// aggregate, not a separate invented number.
function dayWeight(offsetFromToday) {
  const d = new Date()
  d.setDate(d.getDate() - offsetFromToday)
  const dow = d.getDay() // 0 Sun .. 6 Sat
  const weekend = dow === 0 || dow === 6
  const seed = Math.sin(offsetFromToday * 12.9898) * 43758.5453
  const noise = seed - Math.floor(seed) // 0..1 deterministic pseudo-random
  return (weekend ? 1.35 : 0.9) * (0.75 + noise * 0.5)
}

export function dailySeries(totalRevenue, days = 14) {
  const weights = Array.from({ length: days }, (_, i) => dayWeight(days - 1 - i))
  const sum = weights.reduce((s, w) => s + w, 0)
  const today = new Date()
  return weights.map((w, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (days - 1 - i))
    return {
      date: d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }),
      revenue: Math.round((w / sum) * totalRevenue),
    }
  })
}

// Rolls the stored per-branch monthly history up into one series for the
// trend chart — every branch summed when looking at the whole business, or
// just the one when the branch switcher is narrowed. Unlike dailySeries
// above, nothing is being shaped here: these are the stored monthly totals.
export function monthlySeries(salesHistory, branchId) {
  const scoped = branchId ? (salesHistory ?? []).filter((p) => p.branchId === branchId) : salesHistory ?? []
  const byMonth = new Map()
  for (const p of scoped) {
    const cur = byMonth.get(p.month) ?? { month: p.month, label: p.label, revenue: 0, units: 0 }
    cur.revenue += p.revenue
    cur.units += p.units
    byMonth.set(p.month, cur)
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
}

export function taskCompletion(tasks, filterFn) {
  const rows = tasks.filter(filterFn)
  const done = rows.filter((t) => t.status === 'done').length
  return { done, total: rows.length, pct: rows.length ? Math.round((done / rows.length) * 100) : 0 }
}
