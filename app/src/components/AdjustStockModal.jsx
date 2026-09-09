import React, { useState } from 'react'
import Modal from './Modal.jsx'
import { branchName } from '../data/branches'

export default function AdjustStockModal({ row, product, onClose, onConfirm }) {
  const [direction, setDirection] = useState('add') // 'add' | 'remove'
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')

  const amount = Math.max(0, Math.floor(Number(qty) || 0))
  const delta = direction === 'add' ? amount : -amount
  const nextQty = Math.max(0, row.qtyOnHand + delta)
  const valid = amount > 0 && (direction === 'add' || amount <= row.qtyOnHand)

  function confirm() {
    if (!valid) return
    onConfirm(delta, note.trim() || (direction === 'add' ? 'Stock received' : 'Stock removed'))
  }

  return (
    <Modal
      title="Adjust stock"
      subtitle={`${product.name} (${row.size}) · ${branchName(row.branchId)}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-small btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-small" disabled={!valid} onClick={confirm}>
            {direction === 'add' ? 'Add to stock' : 'Remove from stock'}
          </button>
        </>
      }
    >
      <div className="segmented">
        <button className={'on-add' + (direction === 'add' ? ' active' : '')} onClick={() => setDirection('add')}>
          + Received
        </button>
        <button className={'on-remove' + (direction === 'remove' ? ' active' : '')} onClick={() => setDirection('remove')}>
          &minus; Removed
        </button>
      </div>

      <div>
        <span className="field-label">How many units?</span>
        <div className="qty-input-row">
          <button className="qty-nudge" onClick={() => setQty(String(Math.max(0, amount - 1)))} aria-label="One fewer">
            &minus;
          </button>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            autoFocus
          />
          <button className="qty-nudge" onClick={() => setQty(String(amount + 1))} aria-label="One more">
            +
          </button>
        </div>
        {direction === 'remove' && amount > row.qtyOnHand && (
          <p className="small" style={{ color: 'var(--critical)', marginTop: 6 }}>
            Only {row.qtyOnHand} on hand — can't remove more than that.
          </p>
        )}
      </div>

      <div className="qty-preview">
        <span className="from">{row.qtyOnHand} on hand</span>
        <span>&rarr;</span>
        <span className={'to ' + direction}>{nextQty}</span>
      </div>

      <div>
        <span className="field-label">Note (optional)</span>
        <textarea
          className="textarea"
          placeholder={direction === 'add' ? 'e.g. Delivery from warehouse' : 'e.g. Damaged, returned, count correction'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>
  )
}
