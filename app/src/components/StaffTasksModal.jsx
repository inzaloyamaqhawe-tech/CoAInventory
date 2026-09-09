import React from 'react'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import StatusPill from './StatusPill.jsx'
import { ROLES, branchName } from '../data/branches'
import { timeAgo } from '../lib/scope'

// Clicking a name on Team & Tasks opens this instead of a second list on
// the page — it's the one place that shows what a specific person has on,
// and when it was actually handed to them, without duplicating the same
// rows a second time below the roster.
export default function StaffTasksModal({ person, tasks, currentStaffId, onToggle, onReassign, onClose }) {
  const sorted = [...tasks].sort((a, b) => new Date(b.assignedAt ?? b.dueAt) - new Date(a.assignedAt ?? a.dueAt))
  const isSelf = person.id === currentStaffId

  return (
    <Modal title={`${person.name} — tasks`} subtitle={`${ROLES[person.role].label} · ${branchName(person.branchId)}`} onClose={onClose}>
      {sorted.length === 0 && <p className="muted">Nothing assigned to {person.name}.</p>}
      {sorted.map((t) => (
        <div key={t.id}>
          <div
            className={'task-row' + (t.status === 'done' ? ' done' : '') + (isSelf ? '' : ' task-row-readonly')}
            onClick={() => isSelf && onToggle(t)}
          >
            <span className="check">{t.status === 'done' && <Icon name="check" size={12} />}</span>
            <div>
              <div className="name">{t.title}</div>
              <div className="sub">
                {branchName(t.branchId)} · Given {timeAgo(t.assignedAt ?? t.dueAt)}
              </div>
            </div>
            {!isSelf && t.status !== 'done' && (
              <button
                className="btn-small btn-ghost btn-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  onReassign(t)
                }}
              >
                Reassign
              </button>
            )}
            <StatusPill status={t.status} />
          </div>
          {t.reassignNote && (
            <div className="handoff-note" style={{ marginTop: -4, marginBottom: 8 }}>
              <Icon name="bell" size={13} />
              <span>{t.reassignNote}</span>
            </div>
          )}
        </div>
      ))}
    </Modal>
  )
}
