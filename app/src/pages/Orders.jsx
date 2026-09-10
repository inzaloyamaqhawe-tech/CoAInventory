import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../state/store.jsx'
import { useScope } from '../lib/scope'
import { useBranchFilter } from '../state/branchFilter.jsx'
import { productOf } from '../lib/derive'
import { recommendSourceBranch } from '../lib/alerts'
import { STAFF, branchName, assignableStaffForBranch } from '../data/branches'
import { timeAgo } from '../lib/scope'
import StatusPill from '../components/StatusPill.jsx'
import Icon from '../components/Icon.jsx'
import ReassignControl from '../components/ReassignControl.jsx'
import Pagination from '../components/Pagination.jsx'

const FLOW = ['new', 'packed', 'ready', 'fulfilled']
const NEXT_LABEL = { new: 'Mark packed', packed: 'Mark ready', ready: 'Mark fulfilled' }
const STATUSES = [
  { key: 'All', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'packed', label: 'Packed' },
  { key: 'ready', label: 'Ready' },
  { key: 'fulfilled', label: 'Fulfilled' },
]

export default function Orders() {
  const { state, dispatch } = useStore()
  const { staff, isAll } = useScope()
  const { branchId: filterBranch } = useBranchFilter()
  const effectiveBranch = isAll ? filterBranch : staff.branchId
  const isAssociate = staff.role === 'sales_associate'
  const canAssign = !isAssociate // Ops Manager / Branch Manager

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [assignFilter, setAssignFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return state.orders
      .filter((o) => !effectiveBranch || o.branchId === effectiveBranch)
      .filter((o) => statusFilter === 'All' || o.status === statusFilter)
      .filter((o) => assignFilter === 'All' || (assignFilter === 'unassigned' ? !o.assignedTo : !!o.assignedTo))
      .filter((o) => !needle || o.id.toLowerCase().includes(needle) || o.customer.toLowerCase().includes(needle))
      // Oldest first — whatever's been sitting longest belongs at the top of
      // the queue so it actually gets picked up, not the newest arrival.
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  }, [state.orders, effectiveBranch, statusFilter, assignFilter, q])

  useEffect(() => setPage(1), [q, statusFilter, assignFilter, effectiveBranch, pageSize])
  const orders = filtered.slice((page - 1) * pageSize, page * pageSize)

  function advance(order) {
    const idx = FLOW.indexOf(order.status)
    if (idx === -1 || idx === FLOW.length - 1) return
    dispatch({ type: 'SET_ORDER_STATUS', orderId: order.id, status: FLOW[idx + 1], performedBy: staff.id })
  }

  function assign(orderId, staffId) {
    dispatch({ type: 'ASSIGN_ORDER', orderId, staffId: staffId || null, performedBy: staff.id })
  }

  function requestStock(order, item) {
    const product = productOf(item.sku)
    // A request needs a recommended source branch the moment it's raised —
    // without it, all a manager can do with it later is Dismiss. Same
    // recommendation OrderDetail's own Request button uses.
    const rec = recommendSourceBranch(state.stockLevels, item.variantSku, item.qty, order.branchId)
    dispatch({
      type: 'REQUEST_STOCK',
      sku: item.sku,
      variantSku: item.variantSku,
      branchId: order.branchId,
      orderId: order.id,
      qty: item.qty,
      requestedBy: staff.id,
      note: `Short for ${order.id} (${order.customer}) — need ${item.qty}× ${product?.name ?? item.sku}.`,
      suggestedFromBranchId: rec?.row.branchId ?? null,
    })
  }

  function alreadyRequested(order, item) {
    return state.stockRequests.some((r) => r.orderId === order.id && r.variantSku === item.variantSku && r.status === 'open')
  }

  const unassignedCount = filtered.filter((o) => !o.assignedTo && o.status !== 'fulfilled').length

  return (
    <div className="page">
      <div className="page-head">
        <h1>Orders</h1>
        <p className="muted">
          {effectiveBranch ? branchName(effectiveBranch) : 'All branches'} · {filtered.length} order{filtered.length !== 1 ? 's' : ''}, oldest first
          {unassignedCount > 0 && <span className="text-critical"> · {unassignedCount} unassigned</span>}
        </p>
      </div>

      <div className="toolbar">
        <input className="input" placeholder="Search order #, customer…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 200 }} />
        {STATUSES.map((s) => (
          <button key={s.key} className={'chip' + (statusFilter === s.key ? ' chip-active' : '')} onClick={() => setStatusFilter(s.key)}>
            {s.label}
          </button>
        ))}
        <span className="toolbar-divider" />
        {['All', 'unassigned', 'assigned'].map((k) => (
          <button key={k} className={'chip' + (assignFilter === k ? ' chip-active' : '')} onClick={() => setAssignFilter(k)}>
            {k === 'All' ? 'Any owner' : k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>

      {orders.map((o) => {
        const owner = STAFF.find((s) => s.id === o.assignedTo)
        const isMine = o.assignedTo === staff.id
        const isDone = o.status === 'fulfilled'
        const options = assignableStaffForBranch(o.branchId)

        return (
          <div key={o.id} className={'order-card' + (!owner && !isDone ? ' order-unowned' : '')}>
            <div className="order-top">
              <div>
                <Link to={`/orders/${o.id}`} className="table-name">
                  {o.id}
                </Link>
                <div className="sub">
                  {o.customer} · {o.source === 'online' ? 'Online' : 'In-store'} · {branchName(o.branchId)} · {timeAgo(o.createdAt)}
                </div>
              </div>
              <StatusPill status={o.status} />
            </div>

            <div className="order-owner">
              {isDone ? (
                <div className="assignee-chip">
                  <span className="avatar avatar-sm">{owner ? owner.initials : '—'}</span>
                  <span>{owner ? `Fulfilled by ${isMine ? 'you' : owner.name}` : 'Fulfilled'}</span>
                </div>
              ) : canAssign ? (
                <ReassignControl order={o} options={options} />
              ) : owner ? (
                <div className="assignee-chip">
                  <span className="avatar avatar-sm">{owner.initials}</span>
                  <span>{isMine ? 'You' : owner.name}</span>
                </div>
              ) : (
                <button className="btn-small btn-ghost btn-xs" onClick={() => assign(o.id, staff.id)}>
                  <Icon name="tag" size={11} /> Unassigned — take it
                </button>
              )}
            </div>

            {o.assignmentNote && (
              <div className="handoff-note">
                <Icon name="bell" size={13} />
                <span>{o.assignmentNote}</span>
              </div>
            )}

            <div className="order-item-list">
              {o.items.map((it, i) => {
                const p = productOf(it.sku)
                const requested = alreadyRequested(o, it)
                // Same "short" math as OrderDetail's own line-by-line check —
                // only an item this branch genuinely can't cover right now
                // gets a request action; one that's fully on hand shouldn't
                // invite a request nobody needs to make.
                const ownRow = state.stockLevels.find((r) => r.variantSku === it.variantSku && r.branchId === o.branchId)
                const short = Math.max(0, it.qty - (ownRow?.qtyOnHand ?? 0))
                return (
                  <div key={i} className="order-item-row">
                    <span>
                      {it.qty}&times; {p?.name ?? it.sku}
                    </span>
                    {isAssociate &&
                      !isDone &&
                      short > 0 &&
                      (requested ? (
                        <span className="pill pill-suggest">Requested</span>
                      ) : (
                        <button className="btn-small btn-ghost btn-xs" onClick={() => requestStock(o, it)}>
                          <Icon name="tag" size={11} /> Short — request
                        </button>
                      ))}
                  </div>
                )
              })}
            </div>

            <div className="order-bottom">
              <span className="muted small">{o.items.length} item{o.items.length !== 1 ? 's' : ''}</span>
              {NEXT_LABEL[o.status] && (
                <button className="btn-small" onClick={() => advance(o)}>
                  {NEXT_LABEL[o.status]}
                </button>
              )}
            </div>
          </div>
        )
      })}
      {filtered.length === 0 && <p className="muted">No orders match.</p>}
      {filtered.length > 0 && <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} />}
    </div>
  )
}
