import React, { useMemo, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { useScope, timeAgo } from '../lib/scope'
import { useBranchFilter } from '../state/branchFilter.jsx'
import { taskCompletion } from '../lib/derive'
import { STAFF, ROLES, branchName } from '../data/branches'
import StatusPill from '../components/StatusPill.jsx'
import Icon from '../components/Icon.jsx'
import ReassignTaskModal from '../components/ReassignTaskModal.jsx'

export default function Team() {
  const { state, dispatch } = useStore()
  const { staff, isAll } = useScope()
  const { branchId: filterBranch } = useBranchFilter()
  const effectiveBranch = isAll ? filterBranch : staff.branchId
  const isAssociate = staff.role === 'sales_associate'

  const [newTitle, setNewTitle] = useState('')
  const [newFor, setNewFor] = useState('')
  const [reassigning, setReassigning] = useState(null) // task | null
  const [focusStaffId, setFocusStaffId] = useState(null) // clicked a name in Staff → filters Tasks below

  const people = STAFF.filter((s) => s.role !== 'ops_manager' && s.role !== 'stock_controller' && (!effectiveBranch || s.branchId === effectiveBranch))

  const myTasks = state.tasks.filter((t) => t.assignedTo === staff.id)
  const branchTasks = state.tasks.filter((t) => (effectiveBranch ? t.branchId === effectiveBranch : true))
  const teamTasks = useMemo(
    () =>
      [...branchTasks].sort((a, b) => new Date(b.assignedAt ?? b.dueAt) - new Date(a.assignedAt ?? a.dueAt)).filter((t) => !focusStaffId || t.assignedTo === focusStaffId),
    [branchTasks, focusStaffId]
  )
  const focusPerson = focusStaffId ? STAFF.find((s) => s.id === focusStaffId) : null

  // A task is only ever completed by whoever it's assigned to — this is
  // the single toggle used everywhere, and it silently refuses to touch a
  // task that isn't the current person's own.
  function toggle(task) {
    if (task.assignedTo !== staff.id) return
    dispatch({ type: 'SET_TASK_STATUS', taskId: task.id, status: task.status === 'done' ? 'pending' : 'done' })
  }

  function confirmReassign(newStaffId, note) {
    const person = STAFF.find((s) => s.id === newStaffId)
    dispatch({
      type: 'REASSIGN_TASK',
      taskId: reassigning.id,
      staffId: newStaffId,
      note: note ? `Reassigned to ${person?.name} — ${note}` : `Reassigned to ${person?.name}.`,
    })
    setReassigning(null)
  }

  function addTask(e) {
    e.preventDefault()
    if (!newTitle.trim() || !newFor) return
    const person = STAFF.find((s) => s.id === newFor)
    dispatch({
      type: 'ADD_TASK',
      task: {
        id: `TSK-${Date.now()}`,
        title: newTitle.trim(),
        type: 'daily',
        branchId: person.branchId,
        assignedTo: person.id,
        status: 'pending',
        dueAt: new Date().toISOString(),
        assignedAt: new Date().toISOString(),
        createdBy: staff.id,
      },
    })
    setNewTitle('')
    setNewFor('')
  }

  if (isAssociate) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>My Tasks</h1>
          <p className="muted">Tap the circle to mark done — only you can complete your own tasks.</p>
        </div>
        {myTasks.map((t) => (
          <div key={t.id} className={'task-row' + (t.status === 'done' ? ' done' : '')} onClick={() => toggle(t)}>
            <span className="check">{t.status === 'done' && <Icon name="check" size={12} />}</span>
            <div>
              <div className="name">{t.title}</div>
              <div className="sub">{t.type}</div>
            </div>
            <StatusPill status={t.status} />
          </div>
        ))}
        {myTasks.length === 0 && <p className="muted">Nothing assigned.</p>}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Team &amp; Tasks</h1>
        <p className="muted">{effectiveBranch ? branchName(effectiveBranch) : 'All branches'}</p>
      </div>

      <section>
        <div className="section-head">
          <h3>Staff</h3>
          <span className="muted small">Click a name to see just their tasks</span>
        </div>
        {people.map((p) => {
          const c = taskCompletion(state.tasks, (t) => t.assignedTo === p.id)
          const isFocused = focusStaffId === p.id
          return (
            <button
              key={p.id}
              type="button"
              className={'row-card row-card-clickable' + (isFocused ? ' row-card-active' : '')}
              onClick={() => setFocusStaffId(isFocused ? null : p.id)}
            >
              <div className="who">
                <span className="avatar">{p.initials}</span>
                <span>
                  <span className="n">{p.name}</span>
                  <span className="r">
                    {ROLES[p.role].label} · {branchName(p.branchId)}
                  </span>
                </span>
              </div>
              <span className="mono muted">
                {c.done}/{c.total}
              </span>
            </button>
          )
        })}
      </section>

      <section>
        <div className="section-head">
          <h3>{focusPerson ? `Tasks — ${focusPerson.name}` : 'Tasks'}</h3>
          {focusPerson ? (
            <button className="btn-small btn-ghost btn-xs" onClick={() => setFocusStaffId(null)}>
              <Icon name="x" size={11} /> Clear, show everyone
            </button>
          ) : (
            <span className="muted small">Newest assignment first</span>
          )}
        </div>
        {teamTasks.map((t) => {
          const isMine = t.assignedTo === staff.id
          return (
            <div key={t.id}>
              <div
                className={'task-row' + (t.status === 'done' ? ' done' : '') + (isMine ? '' : ' task-row-readonly')}
                onClick={() => toggle(t)}
              >
                <span className="check">{t.status === 'done' && <Icon name="check" size={12} />}</span>
                <div>
                  <div className="name">{t.title}</div>
                  <div className="sub">
                    {focusPerson ? branchName(t.branchId) : `${STAFF.find((s) => s.id === t.assignedTo)?.name ?? '—'} · ${branchName(t.branchId)}`}
                    {' · Given '}
                    {timeAgo(t.assignedAt ?? t.dueAt)}
                  </div>
                </div>
                {!isMine && t.status !== 'done' && (
                  <button
                    className="btn-small btn-ghost btn-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      setReassigning(t)
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
          )
        })}
        {teamTasks.length === 0 && <p className="muted">{focusPerson ? `Nothing assigned to ${focusPerson.name}.` : 'No tasks match.'}</p>}

        <form className="new-task-form" onSubmit={addTask}>
          <input className="input" placeholder="New task…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <select className="input" value={newFor} onChange={(e) => setNewFor(e.target.value)}>
            <option value="">Assign to…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="btn-small" type="submit">
            Add
          </button>
        </form>
      </section>

      {reassigning && (
        <ReassignTaskModal
          task={reassigning}
          options={people.filter((p) => p.id !== reassigning.assignedTo)}
          onClose={() => setReassigning(null)}
          onConfirm={confirmReassign}
        />
      )}
    </div>
  )
}
