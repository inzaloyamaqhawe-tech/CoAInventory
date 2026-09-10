import React, { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { useScope } from '../lib/scope'
import { STAFF, staffName } from '../data/branches'
import { productOf } from '../lib/derive'
import Icon from './Icon.jsx'
import Modal from './Modal.jsx'

// The one place an order's assignedTo ever changes — used by both the
// Orders list and the Order Detail page so the reassignment guard can't be
// bypassed by going through the other screen. See 04-ALERTS-AND-INTELLIGENCE
// note in the Orders spec: reassigning work already started needs a human
// decision, not a silent overwrite.
export default function ReassignControl({ order, options }) {
  const { dispatch } = useStore()
  const { staff } = useScope()
  const [pendingId, setPendingId] = useState(undefined) // undefined = no confirm open

  const owner = STAFF.find((s) => s.id === order.assignedTo)
  const pickedItems = order.items.filter((it) => it.pickedQty > 0)
  const hasProgress = pickedItems.length > 0 && !order.items.every((it) => it.pickedQty >= it.qty)

  function handleChange(e) {
    const newId = e.target.value || null
    if (newId === order.assignedTo) return
    if (hasProgress && order.assignedTo) {
      setPendingId(newId) // ask first — someone's mid-pick on this order
    } else {
      dispatch({ type: 'ASSIGN_ORDER', orderId: order.id, staffId: newId, performedBy: staff.id })
    }
  }

  function confirmReassign() {
    const newOwner = STAFF.find((s) => s.id === pendingId)
    const lines = pickedItems
      .map((it) => `${it.pickedQty}/${it.qty}× ${productOf(it.sku)?.name ?? it.sku}`)
      .join(', ')
    const note = `${owner?.name ?? 'Previous assignee'} already picked ${lines} — check with them before continuing.`
    dispatch({ type: 'ASSIGN_ORDER', orderId: order.id, staffId: pendingId, note, performedBy: staff.id })
    setPendingId(undefined)
  }

  return (
    <>
      <div className="assignee-select">
        <span className="avatar avatar-sm">{owner ? owner.initials : '?'}</span>
        <select value={order.assignedTo ?? ''} onChange={handleChange}>
          <option value="">Unassigned</option>
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Icon name="chevron" size={12} className="assignee-caret" />
      </div>

      {pendingId !== undefined && (
        <Modal
          title="Reassign an order already in progress"
          subtitle={`${order.id} · currently with ${owner?.name ?? 'someone'}`}
          onClose={() => setPendingId(undefined)}
          footer={
            <>
              <button className="btn-small btn-ghost" onClick={() => setPendingId(undefined)}>
                Cancel
              </button>
              <button className="btn-small" onClick={confirmReassign}>
                Reassign to {staffName(pendingId) || 'Unassigned'} anyway
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13.5, margin: 0 }}>
            <b>{owner?.name}</b> has already started picking this order:
          </p>
          <ul style={{ margin: '10px 0', paddingLeft: 20, fontSize: 13 }}>
            {pickedItems.map((it, i) => (
              <li key={i}>
                <span className="mono">{it.pickedQty}</span> of {it.qty} × {productOf(it.sku)?.name ?? it.sku}
              </li>
            ))}
          </ul>
          <p className="muted small" style={{ margin: 0 }}>
            If you proceed, {staffName(pendingId) || 'the new assignee'} takes over with a note about what's already
            picked — they'll need to check with {owner?.name?.split(' ')[0]} for those items before finishing the box.
          </p>
        </Modal>
      )}
    </>
  )
}
