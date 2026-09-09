import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { buildInitialState } from '../data/generate'

const STORAGE_KEY = 'coa-ops-pass-v1'
const StoreCtx = createContext(null)

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Guard against a shape saved before a field existed — someone's
      // browser can have orders/items persisted from before pick-tracking
      // and assignment notes existed, and undefined pickedQty breaks both
      // the math (NaN) and the progress bar.
      const orders = (parsed.orders ?? []).map((o) => ({
        assignmentNote: null,
        ...o,
        items: o.items.map((it) => ({ pickedQty: 0, pickedBy: null, ...it })),
      }))
      return { stockRequests: [], ...parsed, orders }
    }
  } catch {
    /* ignore corrupt storage, fall through to a fresh seed */
  }
  return buildInitialState()
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADJUST_STOCK': {
      const { rowId, delta, note, performedBy } = action
      const stockLevels = state.stockLevels.map((r) =>
        r.id === rowId ? { ...r, qtyOnHand: Math.max(0, r.qtyOnHand + delta), lastCountedAt: new Date().toISOString() } : r
      )
      const row = stockLevels.find((r) => r.id === rowId)
      const activity = [
        {
          id: `MV-${Date.now()}`,
          variantSku: row.variantSku,
          sku: row.sku,
          branchId: row.branchId,
          type: delta >= 0 ? 'receive' : 'count_adjustment',
          qtyDelta: delta,
          performedBy,
          note,
          at: new Date().toISOString(),
        },
        ...state.activity,
      ]
      return { ...state, stockLevels, activity }
    }

    case 'SET_TASK_STATUS': {
      const tasks = state.tasks.map((t) => (t.id === action.taskId ? { ...t, status: action.status } : t))
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

    // Manager turns a staff request into a real transfer, sourced from the
    // branch it recommended — one action instead of re-deriving the move.
    case 'ACCEPT_REQUEST': {
      const { request } = action
      if (!request.suggestedFromBranchId) return state
      const transfer = {
        id: `TR-2026-${Math.floor(Math.random() * 900 + 100)}`,
        sku: request.sku,
        variantSku: request.variantSku,
        fromBranchId: request.suggestedFromBranchId,
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
