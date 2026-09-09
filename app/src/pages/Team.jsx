import React, { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { useScope } from '../lib/scope'
import { useBranchFilter } from '../state/branchFilter.jsx'
import { taskCompletion } from '../lib/derive'
import { STAFF, ROLES, branchName } from '../data/branches'
import StatusPill from '../components/StatusPill.jsx'
import Icon from '../components/Icon.jsx'

export default function Team() {
  const { state, dispatch } = useStore()
  const { staff, isAll } = useScope()
  const { branchId: filterBranch } = useBranchFilter()
  const effectiveBranch = isAll ? filterBranch : staff.branchId
  const isAssociate = staff.role === 'sales_associate'

  const [newTitle, setNewTitle] = useState('')
  const [newFor, setNewFor] = useState('')

  const people = STAFF.filter((s) => s.role !== 'ops_manager' && s.role !== 'stock_controller' && (!effectiveBranch || s.branchId === effectiveBranch))

  const myTasks = state.tasks.filter((t) => t.assignedTo === staff.id)
  const teamTasks = state.tasks.filter((t) => (effectiveBranch ? t.branchId === effectiveBranch : true))

  function toggle(taskId, current) {
    dispatch({ type: 'SET_TASK_STATUS', taskId, status: current === 'done' ? 'pending' : 'done' })
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
          <p className="muted">Swipe isn't wired up in this build — tap the circle to mark done.</p>
        </div>
        {myTasks.map((t) => (
          <div key={t.id} className={'task-row' + (t.status === 'done' ? ' done' : '')} onClick={() => toggle(t.id, t.status)}>
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
        </div>
        {people.map((p) => {
          const c = taskCompletion(state.tasks, (t) => t.assignedTo === p.id)
          return (
            <div key={p.id} className="row-card">
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
            </div>
          )
        })}
      </section>

      <section>
        <div className="section-head">
          <h3>Tasks</h3>
        </div>
        {teamTasks.map((t) => (
          <div key={t.id} className={'task-row' + (t.status === 'done' ? ' done' : '')} onClick={() => toggle(t.id, t.status)}>
            <span className="check">{t.status === 'done' && <Icon name="check" size={12} />}</span>
            <div>
              <div className="name">{t.title}</div>
              <div className="sub">
                {STAFF.find((s) => s.id === t.assignedTo)?.name ?? '—'} · {branchName(t.branchId)}
              </div>
            </div>
            <StatusPill status={t.status} />
          </div>
        ))}

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
    </div>
  )
}
