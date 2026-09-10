import React from 'react'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import StatusPill from './StatusPill.jsx'
import { ROLES, branchName } from '../data/branches'
import { formatGivenAt } from '../lib/scope'

// Overdue first, then whatever's due soonest, then done tasks last — the
// point of a separate due date is exactly this: what needs attention right
// now shouldn't be buried under whatever happened to be assigned most
// recently.
function urgencyRank(t) {
  if (t.status === 'done') return 2
  if (t.status === 'overdue') return 0
  return 1
}

// Clicking a name on Team & Tasks opens this instead of a second list on
// the page — it's the one place that shows what a specific person has on,
// and when it was actually handed to them, without duplicating the same
// rows a second time below the roster. This modal only ever opens for a
// manager (branch_manager or ops_manager — Team's associate view never
// reaches it), so `isSelf` here always means "a manager looking at their
// own row," and reassigning is exactly as valid there as anywhere else —
// it just gates the done/pending toggle, never a manager's own means of
// moving work off their own plate.
export default function StaffTasksModal({ person, tasks, currentStaffId, onToggle, onReassign, onClose }) {
  const sorted = [...tasks].sort((a, b) => {
    const rank = urgencyRank(a) - urgencyRank(b)
    if (rank !== 0) return rank
    return new Date(a.dueAt ?? a.assignedAt) - new Date(b.dueAt ?? b.assignedAt)
  })
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
                {branchName(t.branchId)} · Given {formatGivenAt(t.assignedAt ?? t.dueAt)}
                {t.dueAt && t.status !== 'done' && <> · Due {formatGivenAt(t.dueAt)}</>}
              </div>
            </div>
            {t.status !== 'done' && (
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
