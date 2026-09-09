import React, { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '../state/store.jsx'
import { useScope } from '../lib/scope'
import { productOf } from '../lib/derive'
import { recommendSourceBranch } from '../lib/alerts'
import { STAFF, branchName, staffName } from '../data/branches'
import { timeAgo } from '../lib/scope'
import StatusPill from '../components/StatusPill.jsx'
import Icon from '../components/Icon.jsx'
import ReassignControl from '../components/ReassignControl.jsx'
import RecordPickedModal from '../components/RecordPickedModal.jsx'

const FLOW = ['new', 'packed', 'ready', 'fulfilled']
const NEXT_LABEL = { new: 'Mark packed', packed: 'Mark ready', ready: 'Mark fulfilled' }

function assignableStaff(branchId) {
  if (branchId === 'WH') return STAFF.filter((s) => s.role === 'stock_controller')
  return STAFF.filter((s) => s.branchId === branchId && (s.role === 'sales_associate' || s.role === 'branch_manager'))
}

export default function OrderDetail() {
  const { id } = useParams()
  const { state, dispatch } = useStore()
  const { staff } = useScope()
  const isAssociate = staff.role === 'sales_associate'
  const order = state.orders.find((o) => o.id === id)
  const [recordingIndex, setRecordingIndex] = useState(null)

  const lines = useMemo(() => {
    if (!order) return []
    return order.items.map((it) => {
      const product = productOf(it.sku)
      const ownRow = state.stockLevels.find((r) => r.variantSku === it.variantSku && r.branchId === order.branchId)
      const onHand = ownRow?.qtyOnHand ?? 0
      const short = Math.max(0, it.qty - onHand)
      const recommendation = short > 0 ? recommendSourceBranch(state.stockLevels, it.variantSku, short, order.branchId) : null
      const openRequest = state.stockRequests.find((r) => r.orderId === order.id && r.variantSku === it.variantSku && r.status === 'open')
      // A manager's "Pull" skips the request inbox and creates the transfer
      // directly — without this, the button would just reappear next
      // render since the transfer alone doesn't change stockLevels yet,
      // the exact "Accept kept appearing" bug this mirrors on Transfers.
      const inFlightTransfer = state.transfers.find(
        (t) => t.variantSku === it.variantSku && t.toBranchId === order.branchId && t.status !== 'received' && t.status !== 'cancelled'
      )
      return { item: it, product, onHand, short, recommendation, openRequest, inFlightTransfer }
    })
  }, [order, state.stockLevels, state.stockRequests, state.transfers])

  if (!order) {
    return (
      <div className="page">
        <p>Order not found.</p>
        <Link to="/orders" className="link">
          &larr; Back to Orders
        </Link>
      </div>
    )
  }

  const owner = STAFF.find((s) => s.id === order.assignedTo)
  const canFulfil = lines.every((l) => l.short === 0)
  const options = assignableStaff(order.branchId)
  const isDone = order.status === 'fulfilled'
  // The assigned person does their own picking; a manager can step in too
  // (covering, correcting a miscount) — nobody else touches someone else's order.
  const canPick = !isDone && (staff.id === order.assignedTo || !isAssociate)

  function advance() {
    const idx = FLOW.indexOf(order.status)
    if (idx === -1 || idx === FLOW.length - 1) return
    dispatch({ type: 'SET_ORDER_STATUS', orderId: order.id, status: FLOW[idx + 1] })
  }

  function markPicked(itemIndex, delta) {
    dispatch({ type: 'MARK_PICKED', orderId: order.id, itemIndex, delta, staffId: staff.id })
  }

  function requestLine(line) {
    const rec = line.recommendation
    dispatch({
      type: 'REQUEST_STOCK',
      sku: line.item.sku,
      variantSku: line.item.variantSku,
      branchId: order.branchId,
      orderId: order.id,
      qty: line.short,
      suggestedFromBranchId: rec?.row.branchId ?? null,
      requestedBy: staff.id,
      note: `Short ${line.short}× ${line.product?.name ?? line.item.sku} for ${order.id} (${order.customer}).`,
    })
  }

  function pullFromRecommended(line) {
    // Manager path: skip the request inbox, create the transfer directly.
    dispatch({
      type: 'ACCEPT_REQUEST',
      request: {
        id: `direct-${line.item.variantSku}`,
        sku: line.item.sku,
        variantSku: line.item.variantSku,
        branchId: order.branchId,
        orderId: order.id,
        qty: line.short,
        suggestedFromBranchId: line.recommendation.row.branchId,
        note: `Short ${line.short}× ${line.product?.name ?? line.item.sku} for ${order.id}.`,
      },
    })
  }

  return (
    <div className="page">
      <Link to="/orders" className="link back">
        &larr; Orders
      </Link>

      <div className="page-head">
        <div className="order-detail-head">
          <div>
            <h1>{order.id}</h1>
            <p className="muted">
              {order.customer} · {order.source === 'online' ? 'Online' : 'In-store'} · {branchName(order.branchId)} · {timeAgo(order.createdAt)}
            </p>
          </div>
          <StatusPill status={order.status} />
        </div>
      </div>

      {order.assignmentNote && (
        <div className="handoff-note">
          <Icon name="bell" size={13} />
          <span>{order.assignmentNote}</span>
        </div>
      )}

      <div className="stat-row">
        <div className="stat">
          <div className="k">Can fulfil now</div>
          <div className="v" style={{ color: canFulfil ? 'var(--ok)' : 'var(--critical)' }}>
            {canFulfil ? 'Yes' : `No — ${lines.filter((l) => l.short > 0).length} short`}
          </div>
        </div>
        <div className="stat">
          <div className="k">Assigned to</div>
          <div className="v" style={{ fontSize: 16 }}>
            {isDone ? (
              <span>{owner ? `Fulfilled by ${owner.name}` : 'Fulfilled'}</span>
            ) : !isAssociate ? (
              <div style={{ marginTop: 2 }}>
                <ReassignControl order={order} options={options} />
              </div>
            ) : (
              owner?.name ?? 'Unassigned'
            )}
          </div>
        </div>
        {NEXT_LABEL[order.status] && (
          <div className="stat" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button className="btn-small" onClick={advance}>
              {NEXT_LABEL[order.status]}
            </button>
          </div>
        )}
      </div>

      <section>
        <div className="section-head">
          <h3>Items on this order</h3>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="fulfil-line">
            <div className="fulfil-line-top">
              <div>
                <div className="name">
                  {l.item.qty}&times; {l.product?.name ?? l.item.sku}
                </div>
                <div className="sub mono">{l.item.variantSku}</div>
              </div>
              {l.short === 0 ? (
                <span className="pill pill-ok">Available · {l.onHand} on hand</span>
              ) : (
                <span className="pill pill-critical">
                  Short by {l.short} · {l.onHand} on hand
                </span>
              )}
            </div>

            <div className="pick-row">
              <div className="pick-progress">
                <div className="pick-track">
                  <div className="pick-fill" style={{ width: `${(l.item.pickedQty / l.item.qty) * 100}%` }} />
                </div>
                <span className="mono small">
                  Picked {l.item.pickedQty}/{l.item.qty}
                </span>
                {l.item.pickedQty > 0 && l.item.pickedQty < l.item.qty && (
                  <span className="muted small">· by {staffName(l.item.pickedBy)}</span>
                )}
              </div>
              {canPick && (
                <button className="adjust-btn" onClick={() => setRecordingIndex(i)}>
                  Record
                </button>
              )}
            </div>

            {l.short > 0 && (
              <div className="fulfil-reco">
                {l.recommendation ? (
                  <>
                    <div className="fulfil-reco-text">
                      <Icon name="swap" size={14} />
                      <span>
                        Recommended: <b>{branchName(l.recommendation.row.branchId)}</b> has {l.recommendation.row.qtyOnHand} on hand
                        {l.recommendation.covers ? ' — enough to cover this' : ' — only a partial cover'}
                        {l.recommendation.row.branchId === 'WH' ? ' (warehouse)' : ` (${l.recommendation.spare} spare above their reorder point)`}
                      </span>
                    </div>
                    {l.inFlightTransfer ? (
                      <span className="pill pill-suggest">
                        Transfer {l.inFlightTransfer.status.replace('_', ' ')} from {branchName(l.inFlightTransfer.fromBranchId)}
                      </span>
                    ) : l.openRequest ? (
                      <span className="pill pill-suggest">Requested — awaiting manager</span>
                    ) : isAssociate ? (
                      <button className="btn-small btn-xs" onClick={() => requestLine(l)}>
                        Request {l.short} from {branchName(l.recommendation.row.branchId)}
                      </button>
                    ) : (
                      <button className="btn-small btn-xs" onClick={() => pullFromRecommended(l)}>
                        Pull {l.short} from {branchName(l.recommendation.row.branchId)}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="fulfil-reco-text">
                    <Icon name="bell" size={14} />
                    <span>No branch has spare stock of this right now — nothing to recommend.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </section>

      {recordingIndex !== null && (
        <RecordPickedModal
          line={lines[recordingIndex]}
          onClose={() => setRecordingIndex(null)}
          onConfirm={(delta) => {
            markPicked(recordingIndex, delta)
            setRecordingIndex(null)
          }}
        />
      )}
    </div>
  )
}
