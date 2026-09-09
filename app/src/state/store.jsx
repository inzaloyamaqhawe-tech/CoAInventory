import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { buildInitialState, DATA_VERSION } from '../data/generate'

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
      return { stockRequests: [], ...parsed, orders, tasks }
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

    case 'SET_ORDER_STATUS': {
      const orders = state.orders.map((o) => (o.id === action.orderId ? { ...o, status: action.status } : o))
      return { ...state, orders }
    }

    // `note` carries handoff context when reassigning an order someone had
    // already started picking (see 05-DATA-MODEL.md's assignmentNote) — the
    // operator's own confirmation writes it, this just stores what it's told.
    // A clean reassignment (no note passed) clears any note left from before.
    case 'ASSIGN_ORDER': {
      const orders = state.orders.map((o) =>
        o.id === action.orderId ? { ...o, assignedTo: action.staffId, assignmentNote: action.note ?? null } : o
      )
      return { ...state, orders }
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

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
