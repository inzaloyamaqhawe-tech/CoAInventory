import React, { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { useScope, formatGivenAt } from '../lib/scope'
import { useBranchFilter } from '../state/branchFilter.jsx'
import { topMover, coldest, taskCompletion, productOf } from '../lib/derive'
import { exportExcel, exportPDF } from '../lib/exportDocs'
import { STAFF, BRANCHES, branchName, staffName } from '../data/branches'
import StatusPill from '../components/StatusPill.jsx'
import Pagination from '../components/Pagination.jsx'
import Icon from '../components/Icon.jsx'

// Every stock movement and every task completion lands in state.activity —
// this turns that raw record into one flat, searchable shape regardless of
// which kind of event it started as, since a manager searching "Amahle"
// wants both her stock adjustments and her finished tasks in one list.
function toRow(a) {
  const isTask = a.type === 'task_completed' || a.type === 'task_reopened'
  const product = isTask ? null : productOf(a.sku)
  const subject = isTask ? a.title : a.size && a.size !== 'One Size' ? `${product?.name ?? a.sku} (${a.size})` : product?.name ?? a.sku
  return {
    id: a.id,
    at: a.at,
    type: a.type,
    branchId: a.branchId,
    performedBy: a.performedBy,
    subject,
    note: a.note,
    qtyDelta: isTask ? null : a.qtyDelta,
  }
}

const TYPE_FILTERS = [
  { key: 'All', match: () => true },
  { key: 'Stock in', match: (r) => r.type === 'receive' },
  // A sale and a manual count/damage adjustment are both "stock went down"
  // from the point of view of someone auditing what left the shelf — group
  // them, since a real till sale showing up under "Stock out" is a feature
  // (it's stock going out), not a miscategorization.
  { key: 'Stock out', match: (r) => r.type === 'sale' || r.type === 'count_adjustment' },
  { key: 'Returns', match: (r) => r.type === 'return' },
  { key: 'Tasks', match: (r) => r.type === 'task_completed' || r.type === 'task_reopened' },
]

export default function Reports() {
  const { state } = useStore()
  const { staff, isAll } = useScope()
  const { branchId: filterBranch } = useBranchFilter()
  const effectiveBranch = isAll ? filterBranch : staff.branchId

  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const staffRows = STAFF.filter((s) => (isAll ? s.role !== 'ops_manager' && s.role !== 'stock_controller' : s.branchId === staff.branchId))
  const staffCompletionRows = staffRows
    .map((s) => ({ s, c: taskCompletion(state.tasks, (t) => t.assignedTo === s.id) }))
    .filter(({ c }) => c.total > 0)
  const scopedBranches = isAll ? BRANCHES : BRANCHES.filter((b) => b.id === staff.branchId)

  // The full audit trail — who did what, where, and when, unfiltered — is
  // what "numbers balance every time with proof" actually means: a place
  // that shows every stock movement and every task sign-off, not just the
  // running totals those movements added up to (that's what the Dashboard
  // and Stock pages are for).
  const allRows = useMemo(() => {
    const rows = state.activity.map(toRow)
    return effectiveBranch ? rows.filter((r) => r.branchId === effectiveBranch) : rows
  }, [state.activity, effectiveBranch])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const typeMatch = TYPE_FILTERS.find((f) => f.key === typeFilter)?.match ?? (() => true)
    return allRows.filter((r) => {
      if (!typeMatch(r)) return false
      if (!needle) return true
      const haystack = [staffName(r.performedBy), r.subject, r.note, branchName(r.branchId), formatGivenAt(r.at), r.at.slice(0, 10)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [allRows, q, typeFilter])

  useEffect(() => setPage(1), [q, typeFilter, effectiveBranch, pageSize])
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize)

  const stamp = () => new Date().toISOString().slice(0, 10)
  const scopeLabel = effectiveBranch ? branchName(effectiveBranch) : 'all-branches'

  function logToExcel() {
    const header = ['Date & time', 'Who', 'Branch', 'Event', 'Item / Task', 'Qty', 'Note']
    const data = rows.map((r) => [
      formatGivenAt(r.at),
      staffName(r.performedBy),
      branchName(r.branchId),
      r.type.replace('_', ' '),
      r.subject,
      r.qtyDelta ?? '',
      r.note ?? '',
    ])
    exportExcel(`activity-log-${scopeLabel}-${stamp()}.xlsx`, 'Activity log', header, data)
  }

  function reportToPDF() {
    exportPDF({
      title: 'Operations Report',
      subtitle: effectiveBranch ? branchName(effectiveBranch) : 'All branches',
      filename: `operations-report-${scopeLabel}-${stamp()}.pdf`,
      sections: [
        {
          heading: 'Staff task completion',
          headerRow: ['Staff', 'Branch', 'Completion'],
          rows: staffCompletionRows.map(({ s, c }) => [s.name, branchName(s.branchId), `${c.pct}%`]),
        },
        {
          heading: `Activity log (${rows.length} entries)`,
          headerRow: ['Date & time', 'Who', 'Branch', 'Event', 'Item / Task', 'Qty'],
          rows: rows.map((r) => [formatGivenAt(r.at), staffName(r.performedBy), branchName(r.branchId), r.type.replace('_', ' '), r.subject, r.qtyDelta ?? '']),
        },
      ],
    })
  }

  return (
    <div className="page">
      <div className="page-head">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1>Reports</h1>
            <p className="muted">Who did what, where, and when — every stock movement and task sign-off, with proof.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn-small btn-ghost btn-xs" onClick={logToExcel}>
              <Icon name="download" size={12} /> Excel
            </button>
            <button className="btn-small btn-xs" onClick={reportToPDF}>
              <Icon name="download" size={12} /> PDF
            </button>
          </div>
        </div>
      </div>

      <section>
        <div className="section-head">
          <h3>Sell-through highlights</h3>
        </div>
        {scopedBranches.map((b) => {
          const top = topMover(state.stockLevels, b.id)
          const cold = coldest(state.stockLevels, b.id)
          return (
            <div key={b.id} className="taped-row">
              {top && (
                <div className="taped">
                  <div className="k">Top mover — {b.name}</div>
                  <p>
                    {top.product?.name}, {top.row.soldLast14d} units in 14 days
                  </p>
                </div>
              )}
              {cold && (
                <div className="taped">
                  <div className="k">Cold — {b.name}</div>
                  <p>
                    {cold.product?.name}, no sale in 14 days ({cold.row.qtyOnHand} on hand)
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </section>

      <section>
        <div className="section-head">
          <h3>Staff task completion</h3>
        </div>
        {staffCompletionRows.map(({ s, c }) => (
          <div key={s.id} className="row-card">
            <div className="who">
              <span className="avatar">{s.initials}</span>
              <span>
                <span className="n">{s.name}</span>
                <span className="r">{branchName(s.branchId)}</span>
              </span>
            </div>
            <span className="mono">{c.pct}%</span>
          </div>
        ))}
      </section>

      <section>
        <div className="section-head">
          <h3>Activity log</h3>
          <span className="muted small">{rows.length} entries</span>
        </div>

        <div className="toolbar">
          <input
            className="input"
            placeholder="Search worker, task, item, date…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 220 }}
          />
          {TYPE_FILTERS.map((f) => (
            <button key={f.key} className={'chip' + (typeFilter === f.key ? ' chip-active' : '')} onClick={() => setTypeFilter(f.key)}>
              {f.key}
            </button>
          ))}
        </div>

        {pageRows.map((r) => (
          <div key={r.id} className="row-card">
            <div className="who">
              <span className="avatar avatar-sm">{STAFF.find((s) => s.id === r.performedBy)?.initials ?? '—'}</span>
              <span>
                <span className="n">
                  {r.subject}
                  {typeof r.qtyDelta === 'number' && (
                    <span className={'mono ' + (r.qtyDelta >= 0 ? 'sale-pos' : 'sale-neg')} style={{ marginLeft: 8 }}>
                      {r.qtyDelta >= 0 ? '+' : ''}
                      {r.qtyDelta}
                    </span>
                  )}
                </span>
                <span className="r report-meta">
                  {staffName(r.performedBy)} · {branchName(r.branchId)} · {formatGivenAt(r.at)}
                  {r.note && ` · ${r.note}`}
                </span>
              </span>
            </div>
            <StatusPill status={r.type} />
          </div>
        ))}
        {rows.length === 0 && <p className="muted">No activity matches.</p>}
        {rows.length > 0 && <Pagination page={page} pageSize={pageSize} total={rows.length} onPage={setPage} onPageSize={setPageSize} />}
      </section>
    </div>
  )
}
