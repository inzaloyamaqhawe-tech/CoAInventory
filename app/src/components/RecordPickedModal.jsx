import React, { useState } from 'react'
import Modal from './Modal.jsx'

// Types the actual picked count in one go — a client ordering 100 caps for
// an event can't be a hundred taps on a plus button. Replaces the stepper
// on the order-detail line items.
export default function RecordPickedModal({ line, onClose, onConfirm }) {
  const { item, product } = line
  const [qty, setQty] = useState(String(item.pickedQty))

  const amount = Math.max(0, Math.min(item.qty, Math.floor(Number(qty) || 0)))
  const valid = qty !== '' && amount !== item.pickedQty

  function confirm() {
    if (!valid) return
    onConfirm(amount - item.pickedQty)
  }

  return (
    <Modal
      title="Record picked"
      subtitle={`${item.qty}× ${product?.name ?? item.sku} · ${item.variantSku}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-small btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-small" disabled={!valid} onClick={confirm}>
            Save
          </button>
        </>
      }
    >
      <div>
        <span className="field-label">How many of {item.qty} have been picked?</span>
        <div className="qty-input-row">
          <button className="qty-nudge" onClick={() => setQty(String(Math.max(0, amount - 1)))} aria-label="One fewer">
            &minus;
          </button>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max={item.qty}
            placeholder="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            autoFocus
            onFocus={(e) => e.target.select()}
          />
          <button className="qty-nudge" onClick={() => setQty(String(Math.min(item.qty, amount + 1)))} aria-label="One more">
            +
          </button>
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>
          Type the total picked so far — not just what changed. Enter {item.qty} to mark the whole line done.
        </p>
      </div>

      <div className="qty-preview">
        <span className="from">{item.pickedQty} picked</span>
        <span>&rarr;</span>
        <span className={'to ' + (amount >= item.pickedQty ? 'add' : 'remove')}>{amount} picked</span>
      </div>
    </Modal>
  )
}
