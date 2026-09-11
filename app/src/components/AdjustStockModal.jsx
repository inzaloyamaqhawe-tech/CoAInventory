import React, { useState } from 'react'
import Modal from './Modal.jsx'
import { branchName } from '../data/branches'

export default function AdjustStockModal({ row, product, approvalThreshold, onClose, onConfirm }) {
  const [direction, setDirection] = useState('add') // 'add' | 'remove'
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [isReturn, setIsReturn] = useState(false) // a customer return, not fresh stock in

  const amount = Math.max(0, Math.floor(Number(qty) || 0))
  const delta = direction === 'add' ? amount : -amount
  const nextQty = Math.max(0, row.qtyOnHand + delta)
  const valid = amount > 0 && (direction === 'add' || amount <= row.qtyOnHand)
  // Past this, the change becomes a request for the Ops Manager rather
  // than something that moves stock straight away.
  const willNeedApproval = approvalThreshold != null && amount >= approvalThreshold
  const soldLast14d = row.soldLast14d ?? 0
  const soldAfterReturn = isReturn ? Math.max(0, soldLast14d - amount) : soldLast14d

  function setDir(next) {
    setDirection(next)
    if (next !== 'add') setIsReturn(false) // "return" only makes sense when stock is coming back in
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
      title="Adjust stock"
      subtitle={`${product.name} (${row.size}) · ${branchName(row.branchId)}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-small btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-small" disabled={!valid} onClick={confirm}>
            {willNeedApproval ? 'Send for approval' : isReturn ? 'Record return' : direction === 'add' ? 'Add to stock' : 'Remove from stock'}
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
          <span>This is a customer return, not new stock in</span>
        </label>
      )}

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

      {isReturn && amount > 0 && (
        <p className="small muted" style={{ marginTop: -8 }}>
          Counted as a return, not a sale — units sold (14d) drops from {soldLast14d} to {soldAfterReturn}.
        </p>
      )}

      {willNeedApproval && (
        <p className="small" style={{ color: 'var(--warn)', margin: 0 }}>
          {amount} units is at or over the {approvalThreshold}-unit mark, so this goes to the Ops Manager to approve
          before the count changes. Stock stays as it is until then.
        </p>
      )}

      <div>
        <span className="field-label">Note{willNeedApproval ? ' — say what happened' : ' (optional)'}</span>
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
