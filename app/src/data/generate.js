// Builds the starting dataset for every entity in the data model
// (05-DATA-MODEL.md) across the full 46-product catalogue and all four
// branches. Deterministic (seeded PRNG) so the starting state is stable,
// then persisted to localStorage and mutated for real from there on —
// see state/store.jsx.

import { CATALOG } from './catalog'
import { BRANCHES, STAFF } from './branches'

function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Bump this whenever the seed-generation logic changes in a way that should
// actually reach someone who already has a browser with a persisted state —
// store.jsx's load() compares this against what's saved and throws the old
// data away instead of quietly keeping serving whatever tier probabilities
// were live the day they first opened the app. Without this, editing this
// file only ever affects a brand-new browser profile.
export const DATA_VERSION = 3

const rand = mulberry32(20260908)
const ri = (min, max) => Math.floor(rand() * (max - min + 1)) + min
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const WH = 'WH'

// Category-level stocking behaviour: the warehouse buffer and the reorder
// point staff would actually set for that category. Retail quantities are
// drawn from the tiered distribution below rather than one flat range —
// most lines sit healthy, with a deliberate minority genuinely low or
// genuinely overstocked, so the alert feed reads as real signal instead of
// noise from half the catalogue tripping a threshold at once.
const CATEGORY_PROFILE = {
  Accessories: { wh: [10, 26], reorder: 3 },
  Loungewear: { wh: [8, 24], reorder: 3 },
  Outerwear: { wh: [2, 9], reorder: 1 },
  'Denim & Bottoms': { wh: [3, 15], reorder: 2 },
  Skirts: { wh: [2, 6], reorder: 1 },
}

// ~0.3% of retail lines run low/out (and are, definitionally, still selling —
// that's why they're low), ~1.5% sit deliberately overstocked (and
// definitionally aren't selling — that's why nobody's reordered them down),
// the rest are healthy with an occasional cold spell.
//
// Both the Alerts feed and the transfer-suggestions feed are driven off
// these same two tiers, and the Alerts total in particular is the number a
// manager sees first (the nav badge) — it needs to read as "a handful of
// real things to look at today," not a wall of unread mail. At 9%/16% this
// was 40-85 simultaneous transfer suggestions and ~80 alerts across the
// ~480 retail-branch lines in the catalogue. At 1%/8% that came down to
// ~44 alerts — better, but still not the "at most ~10" a first-day preview
// should show. These numbers land it around single digits to low teens.
function retailLine(reorder) {
  const roll = rand()
  if (roll < 0.003) return { qty: ri(0, reorder), tier: 'low' }
  if (roll < 0.018) return { qty: ri(reorder * 4, reorder * 6), tier: 'over' }
  return { qty: ri(reorder + 1, reorder * 3), tier: 'healthy' }
}

export function generateStockLevels() {
  const rows = []
  for (const product of CATALOG) {
    const profile = CATEGORY_PROFILE[product.category]
    for (const variant of product.variants) {
      for (const branchId of BRANCHES.map((b) => b.id)) {
        const isWarehouse = branchId === WH
        const { qty, tier } = isWarehouse ? { qty: ri(...profile.wh), tier: 'wh' } : retailLine(profile.reorder)
        // Recent sell-through follows directly from why the line is at the
        // qty it's at, rather than being re-rolled independently of it.
        const soldLast14d =
          tier === 'wh' ? 0 : tier === 'low' ? ri(1, profile.reorder * 2) : tier === 'over' ? 0 : rand() < 0.3 ? 0 : ri(1, profile.reorder * 3)
        rows.push({
          id: `${variant.variantSku}@${branchId}`,
          sku: product.sku,
          variantSku: variant.variantSku,
          size: variant.size,
          branchId,
          qtyOnHand: qty,
          reorderPoint: profile.reorder,
          parLevel: profile.reorder * 2,
          soldLast14d,
          lastCountedAt: daysAgo(ri(0, 6)),
        })
      }
    }
  }
  return rows
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(ri(8, 18), ri(0, 59), 0, 0)
  return d.toISOString()
}

const FIRST_NAMES = ['Thandi', 'Bongani', 'Aisha', 'Michael', 'Zanele', 'Ethan', 'Palesa', 'Liam', 'Nomvula', 'Kayla', 'Sibusiso', 'Grace']
const LAST_INITIALS = ['M.', 'K.', 'V.', 'P.', 'D.', 'N.', 'S.', 'R.']

function randomCustomer() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_INITIALS)}`
}

export function generateOrders(stockRows) {
  const withStock = stockRows.filter((r) => r.qtyOnHand > 0)
  // 'new' is deliberately the most common status — that's the queue an
  // Operations Manager actually works from every morning.
  const statuses = ['new', 'new', 'new', 'packed', 'ready', 'fulfilled', 'fulfilled']
  const orders = []
  for (let i = 0; i < 16; i++) {
    const branchId = pick(BRANCHES.map((b) => b.id))
    const source = branchId === 'WH' ? 'online' : rand() < 0.55 ? 'in_store' : 'online'
    const status = pick(statuses)
    // A brand-new order has nobody on it yet — assigning it is the
    // operator's own call, not something the system decides for them.
    // Anything further along the flow was necessarily assigned to get there.
    const assignedTo = status === 'new' ? null : branchId === 'WH' ? 'tumi' : pick(STAFF.filter((s) => s.branchId === branchId).map((s) => s.id)) ?? null
    const nItems = ri(1, 3)
    const items = []
    for (let j = 0; j < nItems; j++) {
      const row = pick(withStock)
      // ~30% of lines deliberately ask for more than this branch actually
      // has on hand right now — a real order can't always be fully picked
      // from its own shelf, which is exactly what the fulfilment check on
      // the order detail page exists to catch.
      const ownQty = stockRows.find((r) => r.variantSku === row.variantSku && r.branchId === branchId)?.qtyOnHand ?? 0
      const short = rand() < 0.3
      const qty = short ? ownQty + ri(1, 3) : ri(1, 2)
      // No assignee yet means nobody's picking yet either; anything packed
      // or further has necessarily been fully picked already.
      const pickedQty = status === 'new' ? 0 : qty
      items.push({ variantSku: row.variantSku, sku: row.sku, qty, pickedQty, pickedBy: pickedQty > 0 ? assignedTo : null })
    }
    orders.push({
      id: `ORD-${1030 + i}`,
      source,
      branchId,
      customer: source === 'online' ? `Online · #WOO-${8800 + i}` : randomCustomer(),
      status,
      assignedTo,
      assignmentNote: null,
      items,
      createdAt: daysAgo(ri(0, 4)),
    })
  }

  // One illustrative in-progress order: assigned and partway picked while
  // still 'new' — the exact scenario the reassign-warning modal exists for.
  const candidate = orders.find((o) => o.status === 'new' && o.branchId !== 'WH' && o.items.some((it) => it.qty >= 2))
  if (candidate) {
    const associate = pick(STAFF.filter((s) => s.branchId === candidate.branchId && s.role === 'sales_associate').map((s) => s.id))
    candidate.assignedTo = associate
    const line = candidate.items.find((it) => it.qty >= 2)
    line.pickedQty = ri(1, line.qty - 1)
    line.pickedBy = associate
  }

  return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

const TASK_LIBRARY = [
  ['Open till float', 'daily'],
  ['Daily stock count — Accessories wall', 'daily'],
  ['Restock front table', 'daily'],
  ['Steam new arrivals for floor', 'daily'],
  ['Count Denim & Bottoms shelf', 'weekly'],
  ['Reconcile weekly stock take', 'weekly'],
  ['Update window display', 'weekly'],
  ['Set up Spring Drop launch display', 'event'],
  ['Brief team on new arrivals', 'event'],
  ['Close till & reconcile', 'daily'],
]

export function generateTasks() {
  const tasks = []
  let n = 1
  for (const s of STAFF) {
    if (s.role === 'ops_manager' || s.role === 'stock_controller') continue
    const count = ri(2, 4)
    for (let i = 0; i < count; i++) {
      const [title, type] = pick(TASK_LIBRARY)
      const done = rand() < 0.45
      tasks.push({
        id: `TSK-${String(n++).padStart(3, '0')}`,
        title,
        type,
        branchId: s.branchId,
        assignedTo: s.id,
        status: done ? 'done' : rand() < 0.15 ? 'overdue' : 'pending',
        dueAt: daysAgo(done ? ri(0, 1) : 0),
        assignedAt: daysAgo(ri(1, 5)),
        createdBy: s.branchId ? STAFF.find((m) => m.branchId === s.branchId && m.role === 'branch_manager')?.id ?? 'naledi' : 'naledi',
      })
    }
  }
  return tasks
}

export function generateTransfers(stockRows) {
  const bySku = (sku) => stockRows.filter((r) => r.sku === sku)
  const pool = ['LNG-003', 'ACC-004', 'LNG-007', 'OUT-001', 'OUT-011', 'SKT-001', 'DEN-004', 'LNG-009']
  const statuses = ['suggested', 'suggested', 'requested', 'approved', 'in_transit', 'received']
  const reasons = {
    suggested: 'System-suggested: sending branch has surplus with no recent sale; receiving branch is close to its reorder point.',
    requested: 'Requested by branch manager.',
    approved: 'Approved — dispatching from source branch.',
    in_transit: 'Dispatched — courier en route.',
    received: 'Received and counted in.',
  }
  const transfers = []
  let n = 100
  statuses.forEach((status, idx) => {
    const sku = pool[idx % pool.length]
    const rows = bySku(sku)
    const from = pick(rows.filter((r) => r.branchId !== 'WH'))
    const to = pick(rows.filter((r) => r.branchId !== from?.branchId))
    if (!from || !to) return
    transfers.push({
      id: `TR-2026-${n++}`,
      sku,
      variantSku: from.variantSku,
      fromBranchId: from.branchId,
      toBranchId: to.branchId,
      qty: ri(2, 6),
      status,
      reason: reasons[status],
      createdAt: daysAgo(ri(0, 6)),
    })
  })
  return transfers
}

export function generateActivity(stockRows) {
  const types = ['receive', 'sale', 'sale', 'sale', 'count_adjustment']
  const entries = []
  for (let i = 0; i < 60; i++) {
    const row = pick(stockRows)
    const type = pick(types)
    const delta = type === 'sale' ? -ri(1, 2) : type === 'receive' ? ri(2, 10) : ri(-2, 2)
    const staff = pick(STAFF.filter((s) => s.branchId === row.branchId || s.role === 'stock_controller'))
    entries.push({
      id: `MV-${1000 + i}`,
      variantSku: row.variantSku,
      sku: row.sku,
      branchId: row.branchId,
      type,
      qtyDelta: delta,
      performedBy: staff?.id ?? 'naledi',
      at: daysAgo(ri(0, 13)),
    })
  }
  return entries.sort((a, b) => new Date(b.at) - new Date(a.at))
}

// A couple of starting requests so a manager's "Staff requests" inbox in
// Alerts isn't empty on first load — this is the channel Sales Associates
// actually have: flag a shortfall against an order, not act on the alert
// feed itself (see 04-ALERTS-AND-INTELLIGENCE.md's "who sees it" column).
function generateStockRequests(orders, stockLevels) {
  const rowByVariant = (variantSku, branchId) => stockLevels.find((r) => r.variantSku === variantSku && r.branchId === branchId)
  const candidates = orders.filter((o) => o.source === 'in_store' && o.branchId !== 'WH').slice(0, 2)
  return candidates.map((o, i) => {
    const item = o.items[0]
    const row = rowByVariant(item.variantSku, o.branchId)
    const associate = STAFF.find((s) => s.branchId === o.branchId && s.role === 'sales_associate')
    return {
      id: `REQ-${100 + i}`,
      sku: item.sku,
      variantSku: item.variantSku,
      branchId: o.branchId,
      orderId: o.id,
      requestedBy: associate?.id ?? 'naledi',
      note: `Customer wants it for ${o.customer}, only ${row?.qtyOnHand ?? 0} on hand here.`,
      status: 'open',
      createdAt: daysAgo(ri(0, 2)),
    }
  })
}

export function buildInitialState() {
  const stockLevels = generateStockLevels()
  const orders = generateOrders(stockLevels)
  return {
    dataVersion: DATA_VERSION,
    stockLevels,
    orders,
    tasks: generateTasks(),
    transfers: generateTransfers(stockLevels),
    activity: generateActivity(stockLevels),
    stockRequests: generateStockRequests(orders, stockLevels),
    alertsDismissed: [],
  }
}
