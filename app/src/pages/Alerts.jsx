import React, { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { useScope } from '../lib/scope'
import { useBranchFilter } from '../state/branchFilter.jsx'
import { computeAlerts, computeTransferSuggestions, TRANSFER_NEXT_LABEL } from '../lib/alerts'
import { productOf } from '../lib/derive'
import { exportExcel, exportPDF } from '../lib/exportDocs'
import { BRANCHES, branchName, staffName } from '../data/branches'
import { timeAgo } from '../lib/scope'
import StatusPill from '../components/StatusPill.jsx'
import Pagination from '../components/Pagination.jsx'
import Icon from '../components/Icon.jsx'

const SEVERITIES = ['All', 'critical', 'warning', 'info']

// The rare case where nothing cleared the bar to be an automatic
// recommendation (no branch had spare stock above its own reorder point) —
// Dismiss can't be the only option here either, so a manager gets a manual
// pick of any other branch, shown with what it actually has on hand for
// this exact variant so the choice is informed, not a blind guess.
function ManualPullPicker({ request, stockLevels, onPull }) {
  const [fromBranchId, setFromBranchId] = useState('')
  const options = BRANCHES.filter((b) => b.id !== request.branchId).map((b) => {
    const row = stockLevels.find((r) => r.variantSku === request.variantSku && r.branchId === b.id)
    return { branch: b, qty: row?.qtyOnHand ?? 0 }
  })

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <select className="input" style={{ minWidth: 190 }} value={fromBranchId} onChange={(e) => setFromBranchId(e.target.value)}>
        <option value="">No branch has spare — pull from…</option>
        {options.map(({ branch, qty }) => (
          <option key={branch.id} value={branch.id}>
            {branch.name} ({qty} on hand)
          </option>
        ))}
      </select>
      <button className="btn-small btn-xs" disabled={!fromBranchId} onClick={() => onPull(fromBranchId)}>
        Pull
      </button>
    </div>
  )
}

export default function Alerts() {
  const { state, dispatch } = useStore()
  const { staff, isAll } = useScope()
  const { branchId: filterBranch } = useBranchFilter()
  const effectiveBranch = isAll ? filterBranch : staff.branchId
  const [severity, setSeverity] = useState('All')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const alerts = useMemo(() => {
    let a = computeAlerts(state.stockLevels)
    if (effectiveBranch) a = a.filter((x) => x.branchId === effectiveBranch)
    if (severity !== 'All') a = a.filter((x) => x.severity === severity)
    return a
  }, [state.stockLevels, effectiveBranch, severity])

  useEffect(() => setPage(1), [severity, effectiveBranch, pageSize])
  const pageAlerts = alerts.slice((page - 1) * pageSize, page * pageSize)

  const suggestions = useMemo(() => {
    let s = computeTransferSuggestions(state.stockLevels, state.transfers)
    if (effectiveBranch) s = s.filter((x) => x.fromBranchId === effectiveBranch || x.toBranchId === effectiveBranch)
    return s
  }, [state.stockLevels, state.transfers, effectiveBranch])

  const staffRequests = useMemo(
    () => state.stockRequests.filter((r) => r.status === 'open' && (!effectiveBranch || r.branchId === effectiveBranch)),
    [state.stockRequests, effectiveBranch]
  )

  // The out-of-stock report is its own fixed view — regardless of which
  // severity chip is active on screen, "what's out" always means exactly
  // out_of_stock + low_stock, nothing else.
  const outOfStockReport = useMemo(() => {
    const all = computeAlerts(state.stockLevels).filter((a) => a.type === 'out_of_stock' || a.type === 'low_stock')
    return effectiveBranch ? all.filter((a) => a.branchId === effectiveBranch) : all
  }, [state.stockLevels, effectiveBranch])

  const stamp = () => new Date().toISOString().slice(0, 10)
  const scopeLabel = effectiveBranch ? branchName(effectiveBranch) : 'all-branches'

  function toExcel() {
    const header = ['Type', 'Severity', 'Item', 'Branch', 'Detail']
    const rows = alerts.map((a) => [a.type.replace('_', ' '), a.severity, a.title, branchName(a.branchId), a.meta])
    exportExcel(`alerts-${scopeLabel}-${stamp()}.xlsx`, 'Alerts', header, rows)
  }

  function outOfStockToPDF() {
    exportPDF({
      title: 'Out-of-Stock Report',
      subtitle: effectiveBranch ? branchName(effectiveBranch) : 'All branches',
      headerRow: ['Status', 'Item', 'Branch', 'Detail'],
      rows: outOfStockReport.map((a) => [a.type === 'out_of_stock' ? 'Out of stock' : 'Low stock', a.title, branchName(a.branchId), a.detail]),
      filename: `out-of-stock-${scopeLabel}-${stamp()}.pdf`,
    })
  }

  return (
    <div className="page">
      <div className="page-head">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1>Alerts</h1>
            <p className="muted">
              {alerts.length + suggestions.length} open · computed live from current stock · Operations Manager &amp; Branch Manager tool
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn-small btn-ghost btn-xs" onClick={toExcel}>
              <Icon name="download" size={12} /> Excel
            </button>
            <button className="btn-small btn-xs" onClick={outOfStockToPDF} disabled={outOfStockReport.length === 0}>
              <Icon name="download" size={12} /> Out-of-stock PDF
            </button>
          </div>
        </div>
      </div>

      {staffRequests.length > 0 && (
        <section>
          <div className="section-head">
            <h3>Staff requests</h3>
            <span className="muted small">{staffRequests.length}</span>
          </div>
          {staffRequests.map((r) => {
            const p = productOf(r.sku)
            return (
              <div key={r.id} className="alert alert-suggestion">
                <StatusPill status="new">Request</StatusPill>
                <div className="body">
                  <p>
                    {p?.name ?? r.sku} — {branchName(r.branchId)}
                  </p>
                  <p className="meta">
                    {staffName(r.requestedBy)} · {r.note} · {timeAgo(r.createdAt)}
                    {r.suggestedFromBranchId && (
                      <>
                        {' '}
                        · <b style={{ color: 'var(--suggest)' }}>Recommended source: {branchName(r.suggestedFromBranchId)}</b>
                      </>
                    )}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {r.suggestedFromBranchId ? (
                    <button className="btn-small btn-xs" onClick={() => dispatch({ type: 'ACCEPT_REQUEST', request: r })}>
                      Transfer from {branchName(r.suggestedFromBranchId)}
                    </button>
                  ) : (
                    <ManualPullPicker
                      request={r}
                      stockLevels={state.stockLevels}
                      onPull={(fromBranchId) => dispatch({ type: 'ACCEPT_REQUEST', request: r, fromBranchId })}
                    />
                  )}
                  <button className="btn-small btn-ghost btn-xs" onClick={() => dispatch({ type: 'RESOLVE_REQUEST', requestId: r.id })}>
                    Dismiss
                  </button>
                </div>
              </div>
            )
          })}
        </section>
      )}

      <div className="toolbar">
        {SEVERITIES.map((s) => (
          <button key={s} className={'chip' + (severity === s ? ' chip-active' : '')} onClick={() => setSeverity(s)}>
            {s === 'All' ? 'All' : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <section>
        {pageAlerts.map((a) => (
          <div key={a.id} className={`alert alert-${a.severity}`}>
            <StatusPill status={a.type} />
            <div className="body">
              <p>{a.title}</p>
              <p className="meta">{a.meta}</p>
            </div>
          </div>
        ))}
        {alerts.length === 0 && <p className="muted">No stock alerts right now.</p>}
        {alerts.length > 0 && <Pagination page={page} pageSize={pageSize} total={alerts.length} onPage={setPage} onPageSize={setPageSize} />}
      </section>

      {(severity === 'All' || severity === 'info') && suggestions.length > 0 && (
        <section>
          <div className="section-head">
            <h3>Transfer suggestions</h3>
          </div>
          {suggestions.map((s) => {
            const p = productOf(s.sku)
            const name = s.size && s.size !== 'One Size' ? `${p?.name ?? s.sku} (${s.size})` : p?.name ?? s.sku
            const linked = s.linkedTransfer
            return (
              <div key={s.id} className="alert alert-suggestion">
                <StatusPill status={linked?.status ?? 'suggested'}>
                  {!linked ? 'Suggested' : linked.status === 'requested' ? 'Accepted' : linked.status.replace('_', ' ')}
                </StatusPill>
                <div className="body">
                  <p>
                    {(linked?.qty ?? s.qty)}&times; {name} — {branchName(s.fromBranchId)} &rarr; {branchName(s.toBranchId)}
                  </p>
                  <p className="meta">
                    {branchName(s.fromBranchId)}: {s.reasonFrom} · {branchName(s.toBranchId)}: {s.reasonTo}
                  </p>
                </div>
                {linked ? (
                  TRANSFER_NEXT_LABEL[linked.status] && (
                    <button className="btn-small btn-xs" onClick={() => dispatch({ type: 'ADVANCE_TRANSFER', transferId: linked.id })}>
                      {TRANSFER_NEXT_LABEL[linked.status]}
                    </button>
                  )
                ) : (
                  <button className="btn-small" onClick={() => dispatch({ type: 'ACCEPT_SUGGESTION', suggestion: s })}>
                    Accept
                  </button>
                )}
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
