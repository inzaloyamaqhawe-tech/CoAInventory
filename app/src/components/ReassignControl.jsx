import React, { useState } from 'react'
import { useStore, useStaff } from '../state/store.jsx'
import { useScope } from '../lib/scope'

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
  const { staffById, staffName } = useStaff()
  const { staff } = useScope()
  const [pendingId, setPendingId] = useState(undefined) // undefined = no confirm open
  const [reason, setReason] = useState('')

  const owner = staffById(order.assignedTo)
  const pickedItems = order.items.filter((it) => it.pickedQty > 0)
  const hasProgress = pickedItems.length > 0 && !order.items.every((it) => it.pickedQty >= it.qty)
  // Taking half-picked work off someone is the one reassignment that always
  // needs a stated reason — it's the case where somebody will later ask why
  // their box moved, and "it just did" isn't an answer.
  const reasonValid = reason.trim().length >= 3

  function handleChange(e) {
    const newId = e.target.value || null
    if (newId === order.assignedTo) return
    if (hasProgress && order.assignedTo) {
      setPendingId(newId) // ask first — someone's mid-pick on this order
    } else {
      dispatch({ type: 'ASSIGN_ORDER', orderId: order.id, staffId: newId, performedBy: staff.id })
    }
  }

  function closeConfirm() {
    setPendingId(undefined)
    setReason('')
  }

  function confirmReassign() {
    if (!reasonValid) return
    const lines = pickedItems
      .map((it) => `${it.pickedQty}/${it.qty}× ${productOf(it.sku)?.name ?? it.sku}`)
      .join(', ')
    // The automatic part (what's already picked) and the human part (why
    // it's moving) both travel with the handoff — the new assignee needs
    // the first to finish the box, and everyone after needs the second to
    // understand why the order changed hands mid-pick.
    const note = `${owner?.name ?? 'Previous assignee'} already picked ${lines} — check with them before continuing. Reason: ${reason.trim()}`
    dispatch({ type: 'ASSIGN_ORDER', orderId: order.id, staffId: pendingId, note, performedBy: staff.id })
    closeConfirm()
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
          onClose={closeConfirm}
          footer={
            <>
              <button className="btn-small btn-ghost" onClick={closeConfirm}>
                Cancel
              </button>
              <button className="btn-small" disabled={!reasonValid} onClick={confirmReassign}>
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

          <div style={{ marginTop: 14 }}>
            <span className="field-label">Why is it moving? (required)</span>
            <textarea
              className="textarea"
              placeholder="e.g. Shift ended, or called to the till"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
            {!reasonValid && (
              <p className="muted small" style={{ marginTop: 6 }}>
                This goes on the record with the handoff, so {owner?.name?.split(' ')[0] ?? 'the current assignee'} and
                anyone reading it later can see why.
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
