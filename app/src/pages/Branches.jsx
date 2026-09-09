import React from 'react'
import { useStore } from '../state/store.jsx'
import { BRANCHES, STAFF } from '../data/branches'
import { branchRevenue14d, taskCompletion } from '../lib/derive'
import { computeAlerts } from '../lib/alerts'
import { formatZAR } from '../data/catalog'

export default function Branches() {
  const { state } = useStore()
  const alerts = computeAlerts(state.stockLevels)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Branches</h1>
        <p className="muted">{BRANCHES.length} locations</p>
      </div>

      <div className="branch-grid">
        {BRANCHES.map((b) => {
          const lines = state.stockLevels.filter((r) => r.branchId === b.id)
          const units = lines.reduce((s, r) => s + r.qtyOnHand, 0)
          const revenue = b.type === 'retail' ? branchRevenue14d(state.stockLevels, b.id) : null
          const branchAlerts = alerts.filter((a) => a.branchId === b.id).length
          const staffCount = STAFF.filter((s) => s.branchId === b.id).length
          const tasks = taskCompletion(state.tasks, (t) => t.branchId === b.id)

          return (
            <div key={b.id} className="branch-card">
              <div className="branch-card-head">
                <h3>{b.name}</h3>
                <span className="pill pill-muted">{b.type === 'warehouse' ? 'Warehouse' : 'Retail'}</span>
              </div>
              <p className="muted small">{b.city}</p>
              <div className="branch-stats">
                <div>
                  <div className="k">Units in stock</div>
                  <div className="v">{units}</div>
                </div>
                {revenue !== null && (
                  <div>
                    <div className="k">Sales, 14d</div>
                    <div className="v">{formatZAR(revenue)}</div>
                  </div>
                )}
                <div>
                  <div className="k">Staff</div>
                  <div className="v">{staffCount}</div>
                </div>
                <div>
                  <div className="k">Alerts</div>
                  <div className="v">{branchAlerts}</div>
                </div>
              </div>
              {tasks.total > 0 && (
                <div className="branch-tasks">
                  <div className="lb-track">
                    <span className="lb-fill" style={{ width: `${tasks.pct}%` }} />
                  </div>
                  <span className="muted small">
                    {tasks.done}/{tasks.total} tasks done today
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
