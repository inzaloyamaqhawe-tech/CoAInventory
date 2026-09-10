// Implements the rules from 04-ALERTS-AND-INTELLIGENCE.md against whatever
// the current stock state actually is — this recomputes live, so adjusting
// a count in the Stock screen changes what shows up here.

import { CATALOG } from '../data/catalog'
import { branchName } from '../data/branches'

const productBySku = Object.fromEntries(CATALOG.map((p) => [p.sku, p]))

function label(row) {
  const p = productBySku[row.sku]
  const name = p ? p.name : row.sku
  return row.size && row.size !== 'One Size' ? `${name} (${row.size})` : name
}

export function daysOfCover(row) {
  const perDay = row.soldLast14d / 14
  if (perDay <= 0) return Infinity
  return row.qtyOnHand / perDay
}

export function computeAlerts(stockLevels) {
  const alerts = []

  for (const row of stockLevels) {
    if (row.branchId === 'WH') continue // warehouse feeds transfers, not branch alerts
    const cover = daysOfCover(row)

    if (row.qtyOnHand === 0 && row.soldLast14d > 0) {
      alerts.push({
        id: `A-OOS-${row.id}`,
        type: 'out_of_stock',
        severity: 'critical',
        branchId: row.branchId,
        row,
        title: label(row),
        meta: `${branchName(row.branchId)} · sold out, still selling`,
        detail: 'Sold out, still selling',
      })
    } else if (row.qtyOnHand <= row.reorderPoint && row.qtyOnHand > 0) {
      alerts.push({
        id: `A-LOW-${row.id}`,
        type: 'low_stock',
        severity: 'critical',
        branchId: row.branchId,
        row,
        title: label(row),
        meta: `${branchName(row.branchId)} · ${row.qtyOnHand} on hand, reorder at ${row.reorderPoint}`,
        detail: `${row.qtyOnHand} on hand, reorder at ${row.reorderPoint}`,
      })
    } else if (row.qtyOnHand >= row.parLevel * 2 && row.soldLast14d === 0) {
      alerts.push({
        id: `A-OVER-${row.id}`,
        type: 'overstock',
        severity: 'info',
        branchId: row.branchId,
        row,
        title: label(row),
        meta: `${branchName(row.branchId)} · ${row.qtyOnHand} on hand, no sale in 14 days`,
      })
    } else if (Number.isFinite(cover) && cover < 5 && row.soldLast14d >= row.reorderPoint) {
      alerts.push({
        id: `A-SPIKE-${row.id}`,
        type: 'demand_spike',
        severity: 'warning',
        branchId: row.branchId,
        row,
        title: label(row),
        meta: `${branchName(row.branchId)} · ~${cover.toFixed(1)} days of cover left at current pace`,
      })
    }
  }

  return alerts
}

// What the "advance this transfer" button says at each stage — shared by
// every screen that lets a transfer move forward (Transfers board, and the
// suggestions list on Transfers/Alerts once a suggestion has a linked one).
export const TRANSFER_NEXT_LABEL = {
  suggested: 'Request',
  requested: 'Approve',
  approved: 'Mark dispatched',
  in_transit: 'Mark received',
}

// Transfer-suggestion algorithm (04-ALERTS-AND-INTELLIGENCE.md): pair a
// needy branch (low/out, still selling) against the branch holding the
// same variant with the largest surplus and the least recent movement.
//
// `existingTransfers` matters because accepting a suggestion doesn't touch
// stockLevels at all — only actually *receiving* the transfer does. A
// suggestion someone already accepted is never dropped from this list —
// dropping it read as "Accept did nothing." Instead it comes back tagged
// with `linkedTransfer`, so the UI can show its real progress (Requested →
// Approved → In Transit) in place of the Accept button. It only actually
// stops being generated once that transfer is received and the underlying
// imbalance it was raised for is gone — which also keeps this list from
// growing without bound as transfers pile up.
export function computeTransferSuggestions(stockLevels, existingTransfers = []) {
  const openByRoute = new Map()
  for (const t of existingTransfers) {
    if (t.status === 'received' || t.status === 'cancelled') continue
    openByRoute.set(`${t.variantSku}|${t.fromBranchId}|${t.toBranchId}`, t)
  }

  const byVariant = {}
  for (const row of stockLevels) {
    ;(byVariant[row.variantSku] ??= []).push(row)
  }

  const suggestions = []
  for (const [variantSku, rows] of Object.entries(byVariant)) {
    const needy = rows
      .filter((r) => r.branchId !== 'WH' && r.qtyOnHand <= r.reorderPoint)
      .sort((a, b) => daysOfCover(a) - daysOfCover(b))
    if (!needy.length) continue

    // Largest surplus above its own reorder point first; among ties,
    // whichever branch has sold the least of it recently (stock sitting
    // still is a better transfer source than stock that's merely ahead).
    const surplus = rows
      .filter((r) => r.qtyOnHand > r.reorderPoint * 2)
      .sort((a, b) => (b.qtyOnHand - b.reorderPoint) - (a.qtyOnHand - a.reorderPoint) || a.soldLast14d - b.soldLast14d)
    if (!surplus.length) continue

    const from = surplus[0]
    const need = needy[0]
    if (from.branchId === need.branchId) continue

    const moveQty = Math.max(1, Math.min(from.qtyOnHand - from.reorderPoint, need.reorderPoint - need.qtyOnHand + 1))
    suggestions.push({
      id: `SUG-${variantSku}-${from.branchId}-${need.branchId}`,
      sku: from.sku,
      variantSku,
      size: from.size,
      fromBranchId: from.branchId,
      toBranchId: need.branchId,
      qty: moveQty,
      reasonFrom: `${from.qtyOnHand} on hand${from.soldLast14d === 0 ? ', no sale in 14 days' : ''}`,
      reasonTo: `${need.qtyOnHand} on hand, reorder at ${need.reorderPoint}`,
      linkedTransfer: openByRoute.get(`${variantSku}|${from.branchId}|${need.branchId}`) ?? null,
    })
  }
  return suggestions
}

// Given a specific order line that's short at its own branch, rank every
// other branch that could cover it — used by the order fulfilment check,
// not the general transfer-suggestion feed above (this is "who can cover
// *this* shortfall right now", not "what's structurally imbalanced").
// Ranking: (1) can fully cover the shortfall beats a partial cover, (2) the
// warehouse is the natural source before drawing down another shopfloor's
// stock, (3) among retail branches, the one with the most room above its
// own reorder point — never recommends a branch down to its own shortage.
export function recommendSourceBranch(stockLevels, variantSku, neededQty, excludeBranchId) {
  const candidates = stockLevels
    .filter((r) => r.variantSku === variantSku && r.branchId !== excludeBranchId && r.qtyOnHand > r.reorderPoint)
    .map((r) => ({ row: r, spare: r.qtyOnHand - r.reorderPoint, covers: r.qtyOnHand >= neededQty }))
    .sort((a, b) => {
      if (a.covers !== b.covers) return a.covers ? -1 : 1
      if (a.row.branchId === 'WH' && b.row.branchId !== 'WH') return -1
      if (b.row.branchId === 'WH' && a.row.branchId !== 'WH') return 1
      return b.spare - a.spare
    })
  return candidates[0] ?? null
}

// Every id currently sitting in the same bucket the Alerts page shows —
// stock alerts, un-accepted transfer suggestions, open staff requests —
// scoped the same way the nav's own alert count already is. Shared by the
// bell's "unseen since last visit" badge (Layout) and the mark-as-seen
// call (Alerts) so the two can never drift into counting different things.
export function notificationIds(state, staff, isAll) {
  const inScope = (branchId) => isAll || branchId === staff.branchId
  const alerts = computeAlerts(state.stockLevels).filter((a) => inScope(a.branchId))
  const suggestions = computeTransferSuggestions(state.stockLevels, state.transfers)
    .filter((s) => !s.linkedTransfer)
    .filter((s) => inScope(s.fromBranchId) || inScope(s.toBranchId))
  const requests = state.stockRequests.filter((r) => r.status === 'open' && inScope(r.branchId))
  return [...alerts.map((a) => a.id), ...suggestions.map((s) => s.id), ...requests.map((r) => r.id)]
}
