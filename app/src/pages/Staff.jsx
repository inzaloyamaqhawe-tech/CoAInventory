import React, { useMemo, useState } from 'react'
import { useStore, useStaff } from '../state/store.jsx'
import { useScope } from '../lib/scope'
import { BRANCHES, ROLES, branchName, initialsFor } from '../data/branches'
import StatusPill from '../components/StatusPill.jsx'
import Modal from '../components/Modal.jsx'
import Icon from '../components/Icon.jsx'

const ROLE_KEYS = ['ops_manager', 'stock_controller', 'branch_manager', 'sales_associate']

// The Ops Manager works across every branch, and the Stock Controller runs
// the warehouse — neither is "at" a shop floor, so the branch picker only
// applies to the two roles that actually stand in one.
function branchRequired(role) {
  return role === 'branch_manager' || role === 'sales_associate'
}
function branchForRole(role, picked) {
  if (role === 'ops_manager') return null
  if (role === 'stock_controller') return 'WH'
  return picked || ''
}

function StaffForm({ initial, onCancel, onSave, saveLabel }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [role, setRole] = useState(initial?.role ?? 'sales_associate')
  const [branchId, setBranchId] = useState(initial?.branchId ?? '')

  const resolvedBranch = branchForRole(role, branchId)
  const valid = name.trim().length >= 2 && (!branchRequired(role) || !!resolvedBranch)

  return (
    <>
      <div>
        <span className="field-label">Full name</span>
        <input className="input" style={{ width: '100%' }} placeholder="e.g. Thandi Mahlangu" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>

      <div>
        <span className="field-label">Role</span>
        <select className="input" style={{ width: '100%' }} value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLE_KEYS.map((r) => (
            <option key={r} value={r}>
              {ROLES[r].label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="field-label">Branch</span>
        {branchRequired(role) ? (
          <select className="input" style={{ width: '100%' }} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Choose a branch…</option>
            {BRANCHES.filter((b) => b.type === 'retail').map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            {role === 'ops_manager' ? 'Works across all branches — no single branch to set.' : 'Runs Online Fulfilment (the warehouse).'}
          </p>
        )}
      </div>

      <div className="modal-foot" style={{ padding: 0, borderTop: 'none', marginTop: 4 }}>
        <button className="btn-small btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn-small"
          disabled={!valid}
          onClick={() => onSave({ name: name.trim(), role, branchId: resolvedBranch || null })}
        >
          {saveLabel}
        </button>
      </div>
    </>
  )
}

export default function Staff() {
  const { state, dispatch } = useStore()
  const { allStaff } = useStaff()
  const { staff: me } = useScope()

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null) // staff | null
  const [deactivating, setDeactivating] = useState(null) // staff | null
  const [q, setQ] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // How much live work would be left behind if this person went inactive —
  // the thing a manager actually needs to know before deactivating someone,
  // rather than discovering it later as orders nobody is holding.
  const openWorkFor = useMemo(() => {
    const map = new Map()
    for (const s of allStaff) {
      const orders = state.orders.filter((o) => o.assignedTo === s.id && o.status !== 'fulfilled').length
      const tasks = state.tasks.filter((t) => t.assignedTo === s.id && t.status !== 'done').length
      map.set(s.id, { orders, tasks })
    }
    return map
  }, [allStaff, state.orders, state.tasks])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return allStaff
      .filter((s) => showInactive || s.active !== false)
      .filter((s) => !needle || s.name.toLowerCase().includes(needle) || ROLES[s.role].label.toLowerCase().includes(needle))
      .sort((a, b) => ROLE_KEYS.indexOf(a.role) - ROLE_KEYS.indexOf(b.role) || a.name.localeCompare(b.name))
  }, [allStaff, q, showInactive])

  function addStaff({ name, role, branchId }) {
    const base = name.toLowerCase().split(/\s+/)[0].replace(/[^a-z]/g, '') || 'staff'
    dispatch({
      type: 'ADD_STAFF',
      staff: {
        // Suffixed so a second Thandi doesn't collide with the first — ids
        // are referenced by every historical record, so they can never be
        // reused or reassigned to a different person.
        id: `${base}-${Date.now().toString(36)}`,
        name,
        role,
        branchId,
        initials: initialsFor(name),
        active: true,
      },
    })
    setAdding(false)
  }

  function saveEdit({ name, role, branchId }) {
    dispatch({ type: 'UPDATE_STAFF', id: editing.id, changes: { name, role, branchId, initials: initialsFor(name) } })
    setEditing(null)
  }

  function confirmDeactivate() {
    dispatch({ type: 'SET_STAFF_ACTIVE', id: deactivating.id, active: false })
    setDeactivating(null)
  }

  const pendingWork = deactivating ? openWorkFor.get(deactivating.id) ?? { orders: 0, tasks: 0 } : null

  return (
    <div className="page">
      <div className="page-head">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1>Staff</h1>
            <p className="muted">
              {allStaff.filter((s) => s.active !== false).length} active · who can sign in, and what they can reach
            </p>
          </div>
          <button className="btn-small btn-xs" onClick={() => setAdding(true)}>
            <Icon name="plus" size={12} /> Add staff
          </button>
        </div>
      </div>

      <div className="toolbar">
        <input className="input" placeholder="Search name or role…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 200 }} />
        <label className="checkbox">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show deactivated
        </label>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Branch</th>
              <th>Open work</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const work = openWorkFor.get(s.id) ?? { orders: 0, tasks: 0 }
              const inactive = s.active === false
              const isMe = s.id === me.id
              return (
                <tr key={s.id} style={inactive ? { opacity: 0.55 } : undefined}>
                  <td>
                    <span className="who">
                      <span className="avatar avatar-sm">{s.initials}</span>
                      <span>
                        <span className="n">
                          {s.name}
                          {isMe && <span className="muted small"> · you</span>}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td>{ROLES[s.role].label}</td>
                  <td>{s.branchId ? branchName(s.branchId) : 'All branches'}</td>
                  <td className="mono muted">
                    {work.orders + work.tasks === 0 ? '—' : `${work.orders} orders · ${work.tasks} tasks`}
                  </td>
                  <td>{inactive ? <StatusPill status="pending">Deactivated</StatusPill> : <StatusPill status="done">Active</StatusPill>}</td>
                  <td className="adjust-cell">
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="adjust-btn" onClick={() => setEditing(s)}>
                        Edit
                      </button>
                      {inactive ? (
                        <button className="adjust-btn" onClick={() => dispatch({ type: 'SET_STAFF_ACTIVE', id: s.id, active: true })}>
                          Reactivate
                        </button>
                      ) : (
                        <button
                          className="adjust-btn"
                          disabled={isMe}
                          title={isMe ? "You can't deactivate yourself while you're signed in" : undefined}
                          onClick={() => setDeactivating(s)}
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                  Nobody matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="muted small" style={{ marginTop: 10 }}>
        Deactivating keeps someone's history intact — their name stays on every order they packed and every count they
        made. It only stops them signing in and being assigned new work.
      </p>

      {adding && (
        <Modal title="Add staff" subtitle="They'll be able to sign in straight away" onClose={() => setAdding(false)}>
          <StaffForm onCancel={() => setAdding(false)} onSave={addStaff} saveLabel="Add staff" />
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit ${editing.name}`} subtitle={ROLES[editing.role].label} onClose={() => setEditing(null)}>
          <StaffForm initial={editing} onCancel={() => setEditing(null)} onSave={saveEdit} saveLabel="Save changes" />
        </Modal>
      )}

      {deactivating && (
        <Modal
          title={`Deactivate ${deactivating.name}?`}
          subtitle={`${ROLES[deactivating.role].label} · ${deactivating.branchId ? branchName(deactivating.branchId) : 'All branches'}`}
          onClose={() => setDeactivating(null)}
          footer={
            <>
              <button className="btn-small btn-ghost" onClick={() => setDeactivating(null)}>
                Cancel
              </button>
              <button className="btn-small" onClick={confirmDeactivate}>
                Deactivate
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13.5, margin: 0 }}>
            They'll stop appearing on the sign-in screen and in any assignment list. Nothing they've already done is
            removed.
          </p>
          {pendingWork.orders + pendingWork.tasks > 0 && (
            <p className="small" style={{ color: 'var(--warn)', marginTop: 12, marginBottom: 0 }}>
              They still have {pendingWork.orders > 0 && `${pendingWork.orders} open order${pendingWork.orders !== 1 ? 's' : ''}`}
              {pendingWork.orders > 0 && pendingWork.tasks > 0 ? ' and ' : ''}
              {pendingWork.tasks > 0 && `${pendingWork.tasks} unfinished task${pendingWork.tasks !== 1 ? 's' : ''}`} assigned. That work
              stays where it is — reassign it on Orders and Team, or it'll sit with nobody holding it.
            </p>
          )}
        </Modal>
      )}
    </div>
  )
}
