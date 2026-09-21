import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { buildInitialState, DATA_VERSION } from '../data/generate'
import { assignableStaffFrom, BRANCHES } from '../data/branches'
import { APPROVER_ROLES, isFullyApproved } from '../lib/policy'
import { registerProducts } from '../lib/derive'

const STORAGE_KEY = 'coa-ops-pass-v1'
const StoreCtx = createContext(null)

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // A browser that already has a saved session from before a seed-data
      // change (retuned alert volume, a new field) would otherwise just go
      // on serving whatever it generated the day it first opened the app —
      // editing generate.js would only ever affect a brand-new profile.
      // Throw the whole thing away and reseed once the version moves.
      if (parsed.dataVersion !== DATA_VERSION) return buildInitialState()
      // Guard against a shape saved before a field existed — someone's
      // browser can have orders/items persisted from before pick-tracking
      // and assignment notes existed, and undefined pickedQty breaks both
      // the math (NaN) and the progress bar.
      const orders = (parsed.orders ?? []).map((o) => ({
        assignmentNote: null,
        ...o,
        items: o.items.map((it) => ({ pickedQty: 0, pickedBy: null, ...it })),
      }))
      // Same guard for tasks — a browser can have tasks persisted from before
      // assignment timestamps existed, and Team.jsx's "given at" column needs
      // every task to have one.
      const tasks = (parsed.tasks ?? []).map((t) => ({ assignedAt: t.dueAt ?? new Date().toISOString(), ...t }))
      return { stockRequests: [], seenIds: {}, pendingCorrections: [], salesHistory: [], staff: [], catalog: [], ...parsed, orders, tasks }
    }
  } catch {
    /* ignore corrupt storage, fall through to a fresh seed */
  }
  return buildInitialState()
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADJUST_STOCK': {
      const { rowId, delta, note, performedBy, isReturn } = action
      const returning = isReturn && delta > 0
      const stockLevels = state.stockLevels.map((r) => {
        if (r.id !== rowId) return r
        const qtyOnHand = Math.max(0, r.qtyOnHand + delta)
        // A customer return puts the item back on the shelf, but it was
        // never actually sold-through — pull it back out of the sold-14d
        // count too, or revenue/leaderboards/top-sellers keep crediting a
        // sale that got reversed at the till.
        const soldLast14d = returning ? Math.max(0, r.soldLast14d - delta) : r.soldLast14d
        return { ...r, qtyOnHand, soldLast14d, lastCountedAt: new Date().toISOString() }
      })
      const row = stockLevels.find((r) => r.id === rowId)
      const activity = [
        {
          id: `MV-${Date.now()}`,
          variantSku: row.variantSku,
          sku: row.sku,
          branchId: row.branchId,
          type: returning ? 'return' : delta >= 0 ? 'receive' : 'count_adjustment',
          qtyDelta: delta,
          performedBy,
          note,
          at: new Date().toISOString(),
        },
        ...state.activity,
      ]
      return { ...state, stockLevels, activity }
    }

    // Same rule as a single ADJUST_STOCK, applied to every selected line at
    // once with one shared delta/note — a real delivery usually means the
    // same qty landed across several sizes, not one row at a time. Still
    // one activity entry per line, not one combined entry, so each line's
    // own history in Reports/ProductDetail stays exactly as traceable as a
    // single adjustment would have been.
    case 'BULK_ADJUST_STOCK': {
      const { rowIds, delta, note, performedBy, isReturn } = action
      const returning = isReturn && delta > 0
      const idSet = new Set(rowIds)
      const stockLevels = state.stockLevels.map((r) => {
        if (!idSet.has(r.id)) return r
        const qtyOnHand = Math.max(0, r.qtyOnHand + delta)
        const soldLast14d = returning ? Math.max(0, r.soldLast14d - delta) : r.soldLast14d
        return { ...r, qtyOnHand, soldLast14d, lastCountedAt: new Date().toISOString() }
      })
      const now = Date.now()
      const newEntries = rowIds.map((rowId, i) => {
        const row = stockLevels.find((r) => r.id === rowId)
        return {
          id: `MV-${now}-${i}`,
          variantSku: row.variantSku,
          sku: row.sku,
          branchId: row.branchId,
          type: returning ? 'return' : delta >= 0 ? 'receive' : 'count_adjustment',
          qtyDelta: delta,
          performedBy,
          note,
          at: new Date().toISOString(),
        }
      })
      return { ...state, stockLevels, activity: [...newEntries, ...state.activity] }
    }

    // Marking a task done (or un-marking it) is exactly the kind of "who did
    // what, when" moment Reports exists to answer — it goes into the same
    // activity feed as stock movements so one search covers both, instead
    // of task completion only ever being visible as a checkmark that
    // forgot who ticked it the moment the next person looks at the list.
    case 'SET_TASK_STATUS': {
      const task = state.tasks.find((t) => t.id === action.taskId)
      const tasks = state.tasks.map((t) => (t.id === action.taskId ? { ...t, status: action.status } : t))
      if (!task) return { ...state, tasks }
      const activity = [
        {
          id: `ACT-${Date.now()}`,
          type: action.status === 'done' ? 'task_completed' : 'task_reopened',
          taskId: task.id,
          title: task.title,
          branchId: task.branchId,
          performedBy: action.performedBy ?? task.assignedTo,
          note: null,
          at: new Date().toISOString(),
        },
        ...state.activity,
      ]
      return { ...state, tasks, activity }
    }

    // A manager moving a task to someone else — after they've confirmed the
    // original assignee genuinely can't do it (see ReassignTaskModal). The
    // new person gets a clean slate: a reassigned task is never handed over
    // already marked done, and 'overdue' resets to 'pending' since that
    // clock was never theirs to begin with.
    case 'REASSIGN_TASK': {
      const tasks = state.tasks.map((t) =>
        t.id === action.taskId
          ? {
              ...t,
              assignedTo: action.staffId,
              status: t.status === 'overdue' ? 'pending' : t.status,
              reassignNote: action.note ?? null,
              // The handoff is a fresh assignment as far as the new person is
              // concerned — the clock a manager tracks them by starts now, not
              // whenever the original assignee first got it.
              assignedAt: new Date().toISOString(),
            }
          : t
      )
      return { ...state, tasks }
    }

    case 'ADD_TASK': {
      return { ...state, tasks: [action.task, ...state.tasks] }
    }

    // Same activity feed a stock adjustment or a task completion lands in —
    // "who marked ORD-1044 packed, and when" belongs to the same searchable
    // record, not just a status pill that stops meaning anything once the
    // order moves past it.
    case 'SET_ORDER_STATUS': {
      const orders = state.orders.map((o) => (o.id === action.orderId ? { ...o, status: action.status } : o))
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order) return { ...state, orders }
      const activity = [
        {
          id: `ACT-${Date.now()}`,
          type: 'order_status',
          orderId: order.id,
          status: action.status,
          branchId: order.branchId,
          performedBy: action.performedBy ?? order.assignedTo,
          note: null,
          at: new Date().toISOString(),
        },
        ...state.activity,
      ]
      return { ...state, orders, activity }
    }

    // `note` carries handoff context when reassigning an order someone had
    // already started picking (see 05-DATA-MODEL.md's assignmentNote) — the
    // operator's own confirmation writes it, this just stores what it's told.
    // A clean reassignment (no note passed) clears any note left from before.
    // Every assignment change — including the very first "unassigned → me"
    // — is its own activity entry too, same reasoning as the status change
    // above: who put this order in whose hands, and when, shouldn't only
    // live as a note that the next reassignment quietly overwrites.
    case 'ASSIGN_ORDER': {
      const order = state.orders.find((o) => o.id === action.orderId)
      const orders = state.orders.map((o) =>
        o.id === action.orderId ? { ...o, assignedTo: action.staffId, assignmentNote: action.note ?? null } : o
      )
      if (!order) return { ...state, orders }
      const activity = [
        {
          id: `ACT-${Date.now()}`,
          type: 'order_reassigned',
          orderId: order.id,
          toStaffId: action.staffId,
          fromStaffId: order.assignedTo,
          branchId: order.branchId,
          performedBy: action.performedBy ?? action.staffId,
          note: action.note ?? null,
          at: new Date().toISOString(),
        },
        ...state.activity,
      ]
      return { ...state, orders, activity }
    }

    // An associate (or a manager stepping in) marking units of one order
    // line as physically picked — independent of stock counts, this is
    // purely "how far along is this order," per item.
    case 'MARK_PICKED': {
      const orders = state.orders.map((o) => {
        if (o.id !== action.orderId) return o
        const items = o.items.map((it, i) => {
          if (i !== action.itemIndex) return it
          const pickedQty = Math.max(0, Math.min(it.qty, it.pickedQty + action.delta))
          return { ...it, pickedQty, pickedBy: pickedQty > 0 ? action.staffId : null }
        })
        return { ...o, items }
      })
      return { ...state, orders }
    }

    case 'ADVANCE_TRANSFER': {
      const flow = ['suggested', 'requested', 'approved', 'in_transit', 'received']
      const transfers = state.transfers.map((t) => {
        if (t.id !== action.transferId) return t
        const idx = flow.indexOf(t.status)
        const next = flow[Math.min(idx + 1, flow.length - 1)]
        return { ...t, status: next }
      })
      let stockLevels = state.stockLevels
      const t = state.transfers.find((x) => x.id === action.transferId)
      if (t) {
        const flowIdx = flow.indexOf(t.status)
        const nextStatus = flow[Math.min(flowIdx + 1, flow.length - 1)]
        if (nextStatus === 'in_transit') {
          stockLevels = stockLevels.map((r) =>
            r.variantSku === t.variantSku && r.branchId === t.fromBranchId
              ? { ...r, qtyOnHand: Math.max(0, r.qtyOnHand - t.qty) }
              : r
          )
        }
        if (nextStatus === 'received') {
          stockLevels = stockLevels.map((r) =>
            r.variantSku === t.variantSku && r.branchId === t.toBranchId ? { ...r, qtyOnHand: r.qtyOnHand + t.qty } : r
          )
        }
      }
      return { ...state, transfers, stockLevels }
    }

    case 'ACCEPT_SUGGESTION': {
      const { suggestion } = action
      const transfer = {
        id: `TR-2026-${Math.floor(Math.random() * 900 + 100)}`,
        sku: suggestion.sku,
        variantSku: suggestion.variantSku,
        fromBranchId: suggestion.fromBranchId,
        toBranchId: suggestion.toBranchId,
        qty: suggestion.qty,
        status: 'requested',
        reason: `Accepted from a system suggestion: ${suggestion.reasonFrom}; needed — ${suggestion.reasonTo}.`,
        createdAt: new Date().toISOString(),
      }
      return { ...state, transfers: [transfer, ...state.transfers] }
    }

    // A Sales Associate flagging a shortfall — the one write path they get
    // to alerts/transfers without seeing or actioning the feed itself. Carries
    // the recommended source branch through so the manager who resolves it
    // doesn't have to re-derive it.
    case 'REQUEST_STOCK': {
      const { sku, variantSku, branchId, orderId, qty, requestedBy, note, suggestedFromBranchId } = action
      const request = {
        id: `REQ-${Date.now()}`,
        sku,
        variantSku,
        branchId,
        orderId: orderId ?? null,
        qty: qty ?? 1,
        suggestedFromBranchId: suggestedFromBranchId ?? null,
        requestedBy,
        note,
        status: 'open',
        createdAt: new Date().toISOString(),
      }
      return { ...state, stockRequests: [request, ...state.stockRequests] }
    }

    // Manager turns a staff request into a real transfer — normally sourced
    // from the branch the system recommended (one action, no re-deriving),
    // but `fromBranchId` lets a manager override that with their own pick
    // when the system found no clear recommendation at all (nothing had
    // spare stock above its own reorder point) yet the manager knows a
    // branch that can still spare a few units.
    case 'ACCEPT_REQUEST': {
      const { request } = action
      const fromBranchId = action.fromBranchId ?? request.suggestedFromBranchId
      if (!fromBranchId) return state
      const transfer = {
        id: `TR-2026-${Math.floor(Math.random() * 900 + 100)}`,
        sku: request.sku,
        variantSku: request.variantSku,
        fromBranchId,
        toBranchId: request.branchId,
        qty: request.qty,
        status: 'requested',
        reason: `Requested to cover ${request.orderId ?? 'a shortfall'} — ${request.note}`,
        createdAt: new Date().toISOString(),
      }
      const stockRequests = state.stockRequests.map((r) => (r.id === request.id ? { ...r, status: 'resolved' } : r))
      return { ...state, transfers: [transfer, ...state.transfers], stockRequests }
    }

    case 'RESOLVE_REQUEST': {
      const stockRequests = state.stockRequests.map((r) => (r.id === action.requestId ? { ...r, status: 'resolved' } : r))
      return { ...state, stockRequests }
    }

    case 'BULK_RESOLVE_REQUESTS': {
      const ids = new Set(action.requestIds)
      const stockRequests = state.stockRequests.map((r) => (ids.has(r.id) ? { ...r, status: 'resolved' } : r))
      return { ...state, stockRequests }
    }

    // ---------- staff roster ----------
    // Deactivating never deletes: historical records point at staff ids
    // (who picked this, who adjusted that), and a deleted row would turn
    // every one of those into a dangling id. Inactive people stay
    // resolvable by name forever, they just stop being assignable.
    case 'ADD_STAFF': {
      return { ...state, staff: [...state.staff, action.staff] }
    }

    case 'UPDATE_STAFF': {
      const staff = state.staff.map((s) => (s.id === action.id ? { ...s, ...action.changes } : s))
      return { ...state, staff }
    }

    case 'SET_STAFF_ACTIVE': {
      const staff = state.staff.map((s) => (s.id === action.id ? { ...s, active: action.active } : s))
      return { ...state, staff }
    }

    // ---------- product catalogue ----------
    // CSV bulk upload lands here — every new SKU gets a stock row at every
    // branch (starting at 0 on hand) so it shows up in Stock/Alerts the
    // moment it's imported, instead of only existing on the Products page
    // until someone happens to receive it in.
    case 'ADD_PRODUCTS': {
      const existing = new Set(state.catalog.map((p) => p.sku))
      const added = action.products.filter((p) => !existing.has(p.sku))
      const now = new Date().toISOString()
      const newRows = added.flatMap((p) =>
        BRANCHES.flatMap((b) =>
          p.variants.map((v) => ({
            id: `${v.variantSku}@${b.id}`,
            sku: p.sku,
            variantSku: v.variantSku,
            size: v.size,
            branchId: b.id,
            qtyOnHand: 0,
            reorderPoint: 3,
            parLevel: 6,
            soldLast14d: 0,
            lastCountedAt: now,
          }))
        )
      )
      return { ...state, catalog: [...state.catalog, ...added], stockLevels: [...state.stockLevels, ...newRows] }
    }

    case 'SET_DISCOUNT': {
      const catalog = state.catalog.map((p) => (p.sku === action.sku ? { ...p, discountPct: action.discountPct || 0 } : p))
      return { ...state, catalog }
    }

    // ---------- stock corrections needing a second pair of eyes ----------
    // Every adjustment — any size, from anyone able to propose one — parks
    // here instead of moving stock directly: the requester states what and
    // why, and it only actually applies once both named approver roles
    // (Operations Manager and Owner) have separately signed off. Nothing
    // changes on the shelf until then.
    case 'REQUEST_CORRECTION': {
      const correction = { approvals: {}, ...action.correction }
      return { ...state, pendingCorrections: [correction, ...state.pendingCorrections] }
    }

    case 'APPROVE_CORRECTION': {
      const correction = state.pendingCorrections.find((c) => c.id === action.correctionId)
      if (!correction || correction.status !== 'pending') return state
      // The requester can't also be an approver, and a role only counts once
      // — re-clicking Approve as the same role doesn't fill the other seat.
      if (!APPROVER_ROLES.includes(action.approverRole)) return state
      if (action.approverId === correction.requestedBy) return state
      if (correction.approvals?.[action.approverRole]) return state

      const approvals = { ...correction.approvals, [action.approverRole]: { by: action.approverId, at: new Date().toISOString() } }
      const nowComplete = isFullyApproved({ ...correction, approvals })

      if (!nowComplete) {
        const pendingCorrections = state.pendingCorrections.map((c) => (c.id === action.correctionId ? { ...c, approvals } : c))
        return { ...state, pendingCorrections }
      }

      const returning = correction.isReturn && correction.delta > 0
      const stockLevels = state.stockLevels.map((r) => {
        if (r.id !== correction.rowId) return r
        const qtyOnHand = Math.max(0, r.qtyOnHand + correction.delta)
        const soldLast14d = returning ? Math.max(0, r.soldLast14d - correction.delta) : r.soldLast14d
        return { ...r, qtyOnHand, soldLast14d, lastCountedAt: new Date().toISOString() }
      })
      const pendingCorrections = state.pendingCorrections.map((c) =>
        c.id === action.correctionId ? { ...c, approvals, status: 'approved', decidedAt: new Date().toISOString() } : c
      )
      // One ledger row for one stock movement — the second, completing
      // approval *is* the movement, so it doesn't also get a separate plain
      // adjustment entry that would double-count the same units.
      const activity = [
        {
          id: `ACT-${Date.now()}`,
          type: 'correction_approved',
          variantSku: correction.variantSku,
          sku: correction.sku,
          size: correction.size,
          branchId: correction.branchId,
          qtyDelta: correction.delta,
          performedBy: action.approverId,
          requestedBy: correction.requestedBy,
          note: correction.note,
          at: new Date().toISOString(),
        },
        ...state.activity,
      ]
      return { ...state, stockLevels, pendingCorrections, activity }
    }

    case 'REJECT_CORRECTION': {
      const correction = state.pendingCorrections.find((c) => c.id === action.correctionId)
      if (!correction || correction.status !== 'pending') return state
      const pendingCorrections = state.pendingCorrections.map((c) =>
        c.id === action.correctionId
          ? { ...c, status: 'rejected', decidedBy: action.rejectedBy, decidedAt: new Date().toISOString(), decisionReason: action.reason }
          : c
      )
      const activity = [
        {
          id: `ACT-${Date.now()}`,
          type: 'correction_rejected',
          variantSku: correction.variantSku,
          sku: correction.sku,
          size: correction.size,
          branchId: correction.branchId,
          qtyDelta: null, // nothing moved — that's the point of a rejection
          performedBy: action.rejectedBy,
          requestedBy: correction.requestedBy,
          note: action.reason,
          at: new Date().toISOString(),
        },
        ...state.activity,
      ]
      return { ...state, pendingCorrections, activity }
    }

    // The bell badge's "unseen since last visit" count — keyed per staff
    // member since this is a shared shop device several people sign into,
    // not tracking one person's session. Opening Alerts marks everything
    // currently in lib/alerts.js's notificationIds() as seen for whoever's
    // signed in right now; anything raised after that shows up as new
    // again next time, same as any other unread-count pattern.
    case 'MARK_SEEN': {
      return { ...state, seenIds: { ...state.seenIds, [action.staffId]: action.ids } }
    }

    case 'RESET_DEMO_DATA': {
      const fresh = buildInitialState()
      return fresh
    }

    default:
      return state
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  // Keep lib/derive.js's product lookup in sync with the live catalogue —
  // synchronously during render, not in an effect, so a component reading
  // productOf()/priceOf() in the same render that just imported or
  // discounted a product sees it immediately rather than one render behind.
  registerProducts(state.catalog ?? [])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

// The live roster and the lookups that used to be module-level functions in
// data/branches.js. They read store state now, so a person added or
// deactivated on the Staff page is reflected everywhere immediately —
// assignment dropdowns, sign-in, the names on historical records.
export function useStaff() {
  const { state } = useStore()
  return useMemo(() => {
    const list = state.staff ?? []
    const byId = new Map(list.map((s) => [s.id, s]))
    return {
      allStaff: list,
      activeStaff: list.filter((s) => s.active !== false),
      staffById: (id) => byId.get(id) ?? null,
      // Falls back to the raw id so a record pointing at someone who no
      // longer exists still renders something rather than blank.
      staffName: (id) => byId.get(id)?.name ?? id ?? '—',
      assignableStaffForBranch: (branchId) => assignableStaffFrom(list, branchId),
    }
  }, [state.staff])
}

// The live product catalogue — seeded stock plus anything imported since
// via CSV bulk upload, with per-product discounts applied. Read this (or
// lib/derive.js's productOf/priceOf, which stay in sync with it) rather
// than the static data/catalog.js export, or a freshly-imported SKU won't
// show up on the Products page.
export function useCatalog() {
  const { state } = useStore()
  return useMemo(() => {
    const list = state.catalog ?? []
    const bySku = new Map(list.map((p) => [p.sku, p]))
    return {
      catalog: list,
      productBySku: (sku) => bySku.get(sku) ?? null,
    }
  }, [state.catalog])
}
