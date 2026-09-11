import React, { useEffect, useMemo, useState } from 'react'
import { useStore, useStaff } from '../state/store.jsx'
import { useScope, formatGivenAt } from '../lib/scope'
import { useBranchFilter } from '../state/branchFilter.jsx'
import { topMover, coldest, taskCompletion, productOf } from '../lib/derive'
import { exportExcel, exportPDF } from '../lib/exportDocs'
import { BRANCHES, branchName } from '../data/branches'
import StatusPill from '../components/StatusPill.jsx'
import Pagination from '../components/Pagination.jsx'
import Icon from '../components/Icon.jsx'

// Every stock movement, task completion and order change lands in
// state.activity — this turns that raw record into one flat, searchable
// shape regardless of which kind of event it started as, since a manager
// searching "Amahle" wants her stock adjustments, her finished tasks and
// the orders she's touched all in one list. `pillStatus` is separate from
// `type` on purpose: an order-status event's *type* is what the Orders
// filter chip matches on, but its *badge* should show the actual
// destination status (Packed, Fulfilled…), reusing the same status-pill
// vocabulary the Orders page itself uses rather than a generic label.
function toRow(a, orders, staffName) {
  if (a.type === 'task_completed' || a.type === 'task_reopened') {
    return { id: a.id, at: a.at, type: a.type, pillStatus: a.type, branchId: a.branchId, performedBy: a.performedBy, subject: a.title, note: a.note, qtyDelta: null }
  }
  if (a.type === 'order_status') {
    const order = orders.find((o) => o.id === a.orderId)
    return {
      id: a.id,
      at: a.at,
      type: 'order_status',
      pillStatus: a.status,
      branchId: a.branchId,
      performedBy: a.performedBy,
      subject: order ? `${a.orderId} — ${order.customer}` : a.orderId,
      note: `Marked ${a.status}`,
      qtyDelta: null,
    }
  }
  if (a.type === 'order_reassigned') {
    const order = orders.find((o) => o.id === a.orderId)
    const toName = a.toStaffId ? staffName(a.toStaffId) : 'Unassigned'
    return {
      id: a.id,
      at: a.at,
      type: 'order_reassigned',
      pillStatus: 'order_reassigned',
      branchId: a.branchId,
      performedBy: a.performedBy,
      subject: order ? `${a.orderId} — ${order.customer}` : a.orderId,
      note: `Reassigned to ${toName}${a.note ? ' — ' + a.note : ''}`,
      qtyDelta: null,
    }
  }
  if (a.type === 'correction_approved' || a.type === 'correction_rejected') {
    const p = productOf(a.sku)
    const name = a.size && a.size !== 'One Size' ? `${p?.name ?? a.sku} (${a.size})` : p?.name ?? a.sku
    const who = a.requestedBy ? `Raised by ${staffName(a.requestedBy)}` : null
    return {
      id: a.id,
      at: a.at,
      type: a.type,
      pillStatus: a.type,
      branchId: a.branchId,
      performedBy: a.performedBy,
      subject: name,
      note: [who, a.note].filter(Boolean).join(' — '),
      qtyDelta: a.qtyDelta ?? null,
    }
  }
  // a stock movement (receive / sale / count_adjustment / return)
  const product = productOf(a.sku)
  const subject = a.size && a.size !== 'One Size' ? `${product?.name ?? a.sku} (${a.size})` : product?.name ?? a.sku
  return { id: a.id, at: a.at, type: a.type, pillStatus: a.type, branchId: a.branchId, performedBy: a.performedBy, subject, note: a.note, qtyDelta: a.qtyDelta }
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
  { key: 'Orders', match: (r) => r.type === 'order_status' || r.type === 'order_reassigned' },
  { key: 'Corrections', match: (r) => r.type === 'correction_approved' || r.type === 'correction_rejected' },
]

export default function Reports() {
  const { state } = useStore()
  const { allStaff, staffName } = useStaff()
  const { staff, isAll } = useScope()
  const { branchId: filterBranch } = useBranchFilter()
  const effectiveBranch = isAll ? filterBranch : staff.branchId

  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const staffRows = allStaff.filter((s) => (isAll ? s.role !== 'ops_manager' && s.role !== 'stock_controller' : s.branchId === staff.branchId))
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
    const rows = state.activity.map((a) => toRow(a, state.orders, staffName))
    return effectiveBranch ? rows.filter((r) => r.branchId === effectiveBranch) : rows
  }, [state.activity, state.orders, effectiveBranch, staffName])

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
      r.pillStatus.replace(/_/g, ' '),
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
          rows: rows.map((r) => [formatGivenAt(r.at), staffName(r.performedBy), branchName(r.branchId), r.pillStatus.replace(/_/g, ' '), r.subject, r.qtyDelta ?? '']),
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

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date &amp; time</th>
                <th>Who</th>
                <th>Branch</th>
                <th>Event</th>
                <th>Item / task</th>
                <th>Qty</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id}>
                  <td className="mono muted">{formatGivenAt(r.at)}</td>
                  <td>{staffName(r.performedBy)}</td>
                  <td>{branchName(r.branchId)}</td>
                  <td>
                    <StatusPill status={r.pillStatus} />
                  </td>
                  <td>{r.subject}</td>
                  <td className={'mono' + (typeof r.qtyDelta === 'number' ? r.qtyDelta >= 0 ? ' sale-pos' : ' sale-neg' : '')}>
                    {typeof r.qtyDelta === 'number' ? (r.qtyDelta >= 0 ? `+${r.qtyDelta}` : r.qtyDelta) : '—'}
                  </td>
                  <td className="muted">{r.note || '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: 'center' }}>
                    No activity matches.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && <Pagination page={page} pageSize={pageSize} total={rows.length} onPage={setPage} onPageSize={setPageSize} />}
      </section>
    </div>
  )
}
