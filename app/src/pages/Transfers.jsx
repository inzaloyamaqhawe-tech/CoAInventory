import React, { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { useScope } from '../lib/scope'
import { useBranchFilter } from '../state/branchFilter.jsx'
import { computeTransferSuggestions, TRANSFER_NEXT_LABEL } from '../lib/alerts'
import { productOf } from '../lib/derive'
import { exportExcel, exportPDF } from '../lib/exportDocs'
import { branchName } from '../data/branches'
import { timeAgo } from '../lib/scope'
import StatusPill from '../components/StatusPill.jsx'
import Icon from '../components/Icon.jsx'
import Pagination from '../components/Pagination.jsx'

const COLUMNS = [
  { key: 'suggested', label: 'Suggested' },
  { key: 'requested', label: 'Requested' },
  { key: 'approved', label: 'Approved' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'received', label: 'Received' },
]

const NEXT_LABEL = TRANSFER_NEXT_LABEL
const STATUS_FILTERS = ['All', 'Suggested', 'Accepted']

export default function Transfers() {
  const { state, dispatch } = useStore()
  const { staff, isAll } = useScope()
  const { branchId: filterBranch } = useBranchFilter()
  const effectiveBranch = isAll ? filterBranch : staff.branchId

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const touches = (t) => !effectiveBranch || t.fromBranchId === effectiveBranch || t.toBranchId === effectiveBranch

  function name(t) {
    const p = productOf(t.sku)
    return t.size && t.size !== 'One Size' ? `${p?.name ?? t.sku} (${t.size})` : p?.name ?? t.sku
  }

  const allSuggestions = useMemo(
    () => computeTransferSuggestions(state.stockLevels, state.transfers).filter(touches),
    [state.stockLevels, state.transfers, effectiveBranch]
  )

  // Live search + status narrow the same set the pager slices, so a search
  // never has to look past a page boundary to find what it's after — this
  // is the pattern every list in the app follows, since any of these can
  // realistically grow into hundreds or thousands of rows off a real DB.
  const suggestions = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return allSuggestions
      .filter((s) => statusFilter === 'All' || (statusFilter === 'Accepted' ? s.linkedTransfer : !s.linkedTransfer))
      .filter((s) => !needle || name({ sku: s.sku, size: s.size }).toLowerCase().includes(needle) || s.sku.toLowerCase().includes(needle))
  }, [allSuggestions, q, statusFilter])

  useEffect(() => setPage(1), [q, statusFilter, effectiveBranch, pageSize])
  const pageSuggestions = suggestions.slice((page - 1) * pageSize, page * pageSize)

  const transfers = state.transfers.filter(touches)

  const stamp = () => new Date().toISOString().slice(0, 10)

  function exportAllExcel() {
    const header = ['ID', 'Item', 'From', 'To', 'Qty', 'Status', 'Created']
    const rows = transfers.map((t) => [t.id, name(t), branchName(t.fromBranchId), branchName(t.toBranchId), t.qty, t.status.replace('_', ' '), t.createdAt.slice(0, 10)])
    exportExcel(`transfers-${stamp()}.xlsx`, 'Transfers', header, rows)
  }

  function downloadNote(t) {
    exportPDF({
      title: 'Transfer Note',
      subtitle: t.id,
      meta: `${branchName(t.fromBranchId)} → ${branchName(t.toBranchId)} · ${t.status.replace('_', ' ')}${t.reason ? ' · ' + t.reason : ''}`,
      headerRow: ['Qty', 'Item', 'SKU'],
      rows: [[t.qty, name(t), t.variantSku]],
      filename: `transfer-${t.id}-${stamp()}.pdf`,
    })
  }

  return (
    <div className="page">
      <div className="page-head">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1>Transfers</h1>
            <p className="muted">{effectiveBranch ? `Touching ${branchName(effectiveBranch)}` : 'All branches'}</p>
          </div>
          <button className="btn-small btn-ghost btn-xs" onClick={exportAllExcel}>
            <Icon name="download" size={12} /> Excel
          </button>
        </div>
      </div>

      <section>
        <div className="section-head">
          <h3>System suggestions</h3>
          <span className="muted">{suggestions.length}</span>
        </div>

        <div className="toolbar">
          <input className="input" placeholder="Search product or SKU…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 200 }} />
          {STATUS_FILTERS.map((s) => (
            <button key={s} className={'chip' + (statusFilter === s ? ' chip-active' : '')} onClick={() => setStatusFilter(s)}>
              {s}
            </button>
          ))}
        </div>

        {pageSuggestions.map((s) => {
          const linked = s.linkedTransfer
          return (
            <div key={s.id} className="alert alert-suggestion">
              <StatusPill status={linked?.status ?? 'suggested'}>
                {!linked ? 'Suggested' : linked.status === 'requested' ? 'Accepted' : linked.status.replace('_', ' ')}
              </StatusPill>
              <div className="body">
                <p>
                  {(linked?.qty ?? s.qty)}&times; {name({ sku: s.sku, size: s.size })} — {branchName(s.fromBranchId)} &rarr; {branchName(s.toBranchId)}
                </p>
                <p className="meta">
                  {branchName(s.fromBranchId)}: {s.reasonFrom} · {branchName(s.toBranchId)}: {s.reasonTo}
                </p>
              </div>
              {linked ? (
                NEXT_LABEL[linked.status] && (
                  <button className="btn-small btn-xs" onClick={() => dispatch({ type: 'ADVANCE_TRANSFER', transferId: linked.id })}>
                    {NEXT_LABEL[linked.status]}
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
        {suggestions.length === 0 && <p className="muted">No suggestions match.</p>}
        {suggestions.length > 0 && <Pagination page={page} pageSize={pageSize} total={suggestions.length} onPage={setPage} onPageSize={setPageSize} />}
      </section>

      <div className="kanban">
        {COLUMNS.map((col) => {
          const items = transfers.filter((t) => t.status === col.key)
          return (
            <div key={col.key} className="kanban-col">
              <h4>
                {col.label} <span>{items.length}</span>
              </h4>
              {items.map((t) => (
                <div key={t.id} className="tcard">
                  <div className="tcard-top">
                    <div className="tcard-name">{name(t)}</div>
                    <button className="tcard-print" onClick={() => downloadNote(t)} aria-label="Download transfer note" title="Download transfer note (PDF)">
                      <Icon name="download" size={13} />
                    </button>
                  </div>
                  <div className="tcard-route">
                    {branchName(t.fromBranchId)} &rarr; {branchName(t.toBranchId)}
                  </div>
                  <div className="tcard-reason">
                    {t.qty} units · {timeAgo(t.createdAt)}
                  </div>
                  {t.reason && <div className="tcard-why">{t.reason}</div>}
                  {NEXT_LABEL[t.status] && (
                    <button className="btn-small btn-block" onClick={() => dispatch({ type: 'ADVANCE_TRANSFER', transferId: t.id })}>
                      {NEXT_LABEL[t.status]}
                    </button>
                  )}
                </div>
              ))}
              {items.length === 0 && <div className="muted small">None right now</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
