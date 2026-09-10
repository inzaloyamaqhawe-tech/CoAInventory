import React, { useState } from 'react'
import Modal from './Modal.jsx'
import { branchName } from '../data/branches'

// Same shape as AdjustStockModal, applied to every selected line with one
// shared quantity/direction instead of one row at a time — a delivery
// usually lands the same qty across several sizes at once. No single
// "X on hand → Y" preview here since every selected row starts from a
// different on-hand count; the table below carries that per line instead.
export default function BulkAdjustModal({ rows, onClose, onConfirm }) {
  const [direction, setDirection] = useState('add') // 'add' | 'remove'
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [isReturn, setIsReturn] = useState(false)

  const amount = Math.max(0, Math.floor(Number(qty) || 0))
  const delta = direction === 'add' ? amount : -amount
  const valid = amount > 0 && (direction === 'add' || rows.every(({ row }) => amount <= row.qtyOnHand))

  function setDir(next) {
    setDirection(next)
    if (next !== 'add') setIsReturn(false)
  }

  function confirm() {
    if (!valid) return
    onConfirm(
      delta,
      note.trim() || (isReturn ? 'Customer return' : direction === 'add' ? 'Stock received' : 'Stock removed'),
      { isReturn: direction === 'add' && isReturn }
    )
  }

  return (
    <Modal
      title="Bulk adjust stock"
      subtitle={`${rows.length} line${rows.length !== 1 ? 's' : ''} selected`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-small btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-small" disabled={!valid} onClick={confirm}>
            {direction === 'add' ? `Add to ${rows.length} lines` : `Remove from ${rows.length} lines`}
          </button>
        </>
      }
    >
      <div className="segmented">
        <button className={'on-add' + (direction === 'add' ? ' active' : '')} onClick={() => setDir('add')}>
          + Received
        </button>
        <button className={'on-remove' + (direction === 'remove' ? ' active' : '')} onClick={() => setDir('remove')}>
          &minus; Removed
        </button>
      </div>

      {direction === 'add' && (
        <label className="checkbox-row">
          <input type="checkbox" checked={isReturn} onChange={(e) => setIsReturn(e.target.checked)} />
          <span>These are customer returns, not new stock in</span>
        </label>
      )}

      <div>
        <span className="field-label">How many units — applied to each selected line?</span>
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
        {direction === 'remove' && amount > 0 && !rows.every(({ row }) => amount <= row.qtyOnHand) && (
          <p className="small" style={{ color: 'var(--critical)', marginTop: 6 }}>
            At least one selected line has fewer than {amount} on hand — can't remove that many from every line.
          </p>
        )}
      </div>

      <div className="table-wrap" style={{ maxHeight: 200 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Size</th>
              <th>Branch</th>
              <th>On hand</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, product }) => (
              <tr key={row.id}>
                <td>{product?.name ?? row.sku}</td>
                <td className="mono">{row.size}</td>
                <td>{branchName(row.branchId)}</td>
                <td className="mono">
                  {row.qtyOnHand} <span className="muted">&rarr;</span> <b>{Math.max(0, row.qtyOnHand + delta)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <span className="field-label">Note (optional)</span>
        <textarea
          className="textarea"
          placeholder={isReturn ? 'e.g. Wrong size, no matching size in stock — refunded' : direction === 'add' ? 'e.g. Delivery from warehouse' : 'e.g. Damaged, count correction'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>
  )
}
