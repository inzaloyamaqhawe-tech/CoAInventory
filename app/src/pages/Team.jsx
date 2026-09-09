import React, { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { useScope } from '../lib/scope'
import { useBranchFilter } from '../state/branchFilter.jsx'
import { taskCompletion } from '../lib/derive'
import { STAFF, ROLES, BRANCHES, branchName, assignableStaffForBranch } from '../data/branches'
import StatusPill from '../components/StatusPill.jsx'
import Icon from '../components/Icon.jsx'
import ReassignTaskModal from '../components/ReassignTaskModal.jsx'
import StaffTasksModal from '../components/StaffTasksModal.jsx'

export default function Team() {
  const { state, dispatch } = useStore()
  const { staff, isAll } = useScope()
  const { branchId: filterBranch } = useBranchFilter()
  const effectiveBranch = isAll ? filterBranch : staff.branchId
  const isAssociate = staff.role === 'sales_associate'

  const [newTitle, setNewTitle] = useState('')
  const [newLocation, setNewLocation] = useState(effectiveBranch || '')
  const [newFor, setNewFor] = useState('')
  const [reassigning, setReassigning] = useState(null) // task | null
  const [viewingStaffId, setViewingStaffId] = useState(null) // clicked a name in Staff → opens their tasks

  // The roster shown, and who a new task can go to, are both built off the
  // same branch-scoping rule as order assignment (assignableStaffForBranch)
  // — a Sandton associate is never an option once a task's location isn't
  // Sandton, and never shows up in the roster for a branch that isn't theirs.
  const rosterBranchIds = effectiveBranch ? [effectiveBranch] : BRANCHES.map((b) => b.id)
  const people = rosterBranchIds.flatMap(assignableStaffForBranch)

  const myTasks = state.tasks.filter((t) => t.assignedTo === staff.id)

  const locationOptions = isAll ? BRANCHES : BRANCHES.filter((b) => b.id === staff.branchId)
  const assignOptions = newLocation ? assignableStaffForBranch(newLocation) : []
  const validTask = newTitle.trim() && newLocation && newFor
  const viewingPerson = viewingStaffId ? STAFF.find((s) => s.id === viewingStaffId) : null

  // A task is only ever completed by whoever it's assigned to — this is
  // the single toggle used everywhere, and it silently refuses to touch a
  // task that isn't the current person's own.
  function toggle(task) {
    if (task.assignedTo !== staff.id) return
    dispatch({ type: 'SET_TASK_STATUS', taskId: task.id, status: task.status === 'done' ? 'pending' : 'done', performedBy: staff.id })
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
    if (!validTask) return // no title, no location, or no one to hand it to — never save half a task
    dispatch({
      type: 'ADD_TASK',
      task: {
        id: `TSK-${Date.now()}`,
        title: newTitle.trim(),
        type: 'daily',
        branchId: newLocation,
        assignedTo: newFor,
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
              <div className="sub">{branchName(t.branchId)}</div>
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
          <span className="muted small">Click a name to see their tasks</span>
        </div>
        {people.map((p) => {
          const c = taskCompletion(state.tasks, (t) => t.assignedTo === p.id)
          return (
            <button key={p.id} type="button" className="row-card row-card-clickable" onClick={() => setViewingStaffId(p.id)}>
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
        {people.length === 0 && <p className="muted">No staff at this branch.</p>}
      </section>

      <section>
        <div className="section-head">
          <h3>Assign a new task</h3>
        </div>
        <form className="new-task-form" onSubmit={addTask}>
          <div>
            <span className="field-label">Task</span>
            <input className="input" placeholder="e.g. Stock counting for jackets" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </div>
          <div>
            <span className="field-label">Location</span>
            <select
              className="input"
              value={newLocation}
              onChange={(e) => {
                setNewLocation(e.target.value)
                setNewFor('') // last branch's assignee is never valid for a different one
              }}
              disabled={locationOptions.length <= 1}
            >
              <option value="">Choose a branch…</option>
              {locationOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="field-label">Assigned to</span>
            <select className="input" value={newFor} onChange={(e) => setNewFor(e.target.value)} disabled={!newLocation}>
              <option value="">{newLocation ? 'Choose someone…' : 'Pick a location first'}</option>
              {assignOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-small" type="submit" disabled={!validTask}>
            Add task
          </button>
        </form>
        <p className="muted small" style={{ marginTop: 6 }}>
          A task needs a location and someone at that location before it can be saved — that's what keeps a Gateway task from ever landing on a Sandton associate.
        </p>
      </section>

      {viewingPerson && (
        <StaffTasksModal
          person={viewingPerson}
          tasks={state.tasks.filter((t) => t.assignedTo === viewingPerson.id)}
          currentStaffId={staff.id}
          onToggle={toggle}
          onReassign={(task) => setReassigning(task)}
          onClose={() => setViewingStaffId(null)}
        />
      )}

      {reassigning && (
        <ReassignTaskModal
          task={reassigning}
          options={assignableStaffForBranch(reassigning.branchId).filter((p) => p.id !== reassigning.assignedTo)}
          onClose={() => setReassigning(null)}
          onConfirm={confirmReassign}
        />
      )}
    </div>
  )
}
