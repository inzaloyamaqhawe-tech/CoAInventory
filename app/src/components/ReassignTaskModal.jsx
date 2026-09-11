import React, { useState } from 'react'
import Modal from './Modal.jsx'
import { useStaff } from '../state/store.jsx'

// A task only ever gets marked done by the person it's assigned to — a
// manager's only lever on someone else's task is to move it, and only
// after actually confirming that person can't do it (absent, whatever the
// reason). No silent "mark done for them," no reassigning without saying why.
export default function ReassignTaskModal({ task, options, currentStaffId, onClose, onConfirm }) {
  const { staffName } = useStaff()
  const [confirmed, setConfirmed] = useState(false)
  const [newStaffId, setNewStaffId] = useState('')
  const [note, setNote] = useState('')

  const isOwnTask = task.assignedTo === currentStaffId
  const valid = confirmed && newStaffId

  return (
    <Modal
      title="Reassign this task"
      subtitle={`${task.title} · currently with ${staffName(task.assignedTo)}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-small btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-small" disabled={!valid} onClick={() => onConfirm(newStaffId, note.trim())}>
            Reassign
          </button>
        </>
      }
    >
      <label className="checkbox" style={{ alignItems: 'flex-start', gap: 9 }}>
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: 2 }} />
        <span style={{ fontSize: 13, color: 'var(--ink)' }}>
          {isOwnTask ? (
            <>I confirm I won't be able to finish this myself (busy elsewhere, or any other reason) — it genuinely needs to move to someone else.</>
          ) : (
            <>
              I've confirmed <b>{staffName(task.assignedTo)}</b> hasn't started this and won't be able to finish it
              (absent, or any other reason) — this task genuinely needs to move.
            </>
          )}
        </span>
      </label>

      <div>
        <span className="field-label">Reassign to</span>
        <select className="input" style={{ width: '100%' }} value={newStaffId} onChange={(e) => setNewStaffId(e.target.value)}>
          <option value="">Choose someone…</option>
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="field-label">Note (optional)</span>
        <textarea className="textarea" placeholder="e.g. Called in sick this morning" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  )
}
