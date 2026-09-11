import React, { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { useScope } from '../lib/scope'
import { useBranchFilter } from '../state/branchFilter.jsx'
import { productOf } from '../lib/derive'
import { CATEGORIES } from '../data/catalog'
import { BRANCHES, branchName } from '../data/branches'
import { daysOfCover } from '../lib/alerts'
import { needsApproval, approvalThresholdFor } from '../lib/policy'
import { exportExcel, exportPDF } from '../lib/exportDocs'
import StatusPill from '../components/StatusPill.jsx'
import Pagination from '../components/Pagination.jsx'
import AdjustStockModal from '../components/AdjustStockModal.jsx'
import BulkAdjustModal from '../components/BulkAdjustModal.jsx'
import Icon from '../components/Icon.jsx'

export default function Stock() {
  const { state, dispatch } = useStore()
  const { staff, isAll } = useScope()
  const { branchId: filterBranch } = useBranchFilter()
  const effectiveBranch = isAll ? filterBranch : staff.branchId

  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [onlyAlerts, setOnlyAlerts] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [adjusting, setAdjusting] = useState(null) // { row, product } | null
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkAdjusting, setBulkAdjusting] = useState(false)

  const filtered = useMemo(() => {
    return state.stockLevels
      .filter((r) => (effectiveBranch ? r.branchId === effectiveBranch : true))
      .map((r) => ({ row: r, product: productOf(r.sku) }))
      .filter(({ product }) => product && (cat === 'All' || product.category === cat))
      .filter(({ product }) => product.name.toLowerCase().includes(q.toLowerCase()) || product.sku.toLowerCase().includes(q.toLowerCase()))
      .filter(({ row }) => !onlyAlerts || row.qtyOnHand <= row.reorderPoint)
      .sort((a, b) => a.product.name.localeCompare(b.product.name) || a.row.size.localeCompare(b.row.size))
  }, [state.stockLevels, effectiveBranch, cat, q, onlyAlerts])

  // Any filter change invalidates the current page — land back on page 1
  // rather than showing an empty page 6 of a now-12-row result. A changed
  // filter also invalidates whatever was selected — rows that just
  // scrolled out of view shouldn't stay silently selected for a bulk
  // action the operator can no longer see.
  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [q, cat, onlyAlerts, effectiveBranch, pageSize])

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const selectedRows = pageRows.filter(({ row }) => selectedIds.has(row.id))
  const allOnPageSelected = pageRows.length > 0 && pageRows.every(({ row }) => selectedIds.has(row.id))

  function toggleRow(rowId) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  function toggleAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) pageRows.forEach(({ row }) => next.delete(row.id))
      else pageRows.forEach(({ row }) => next.add(row.id))
      return next
    })
  }

  function confirmBulkAdjust(delta, note, meta) {
    if (needsApproval(delta, staff.role)) {
      // Each line is its own stock movement, so each gets its own request —
      // the approver can wave through the sizes that check out and reject
      // the one that doesn't, instead of it being all-or-nothing.
      selectedRows.forEach(({ row, product }) => submitAdjustment({ row, product, delta, note, isReturn: meta?.isReturn }))
    } else {
      dispatch({ type: 'BULK_ADJUST_STOCK', rowIds: selectedRows.map(({ row }) => row.id), delta, performedBy: staff.id, note, isReturn: meta?.isReturn })
    }
    setBulkAdjusting(false)
    setSelectedIds(new Set())
  }

  function status(row) {
    if (row.qtyOnHand === 0) return 'out_of_stock'
    if (row.qtyOnHand <= row.reorderPoint) return 'low_stock'
    if (row.qtyOnHand >= row.parLevel * 2 && row.soldLast14d === 0) return 'overstock'
    return null
  }

  // One helper for both paths so bulk can't become the way around the
  // approval rule — a 40-unit write-off is a 40-unit write-off whether it
  // was typed on one line or twenty.
  function submitAdjustment({ row, product, delta, note, isReturn }) {
    if (needsApproval(delta, staff.role)) {
      dispatch({
        type: 'REQUEST_CORRECTION',
        correction: {
          id: `COR-${Date.now()}-${row.id}`,
          rowId: row.id,
          variantSku: row.variantSku,
          sku: row.sku,
          size: row.size,
          productName: product?.name ?? row.sku,
          branchId: row.branchId,
          qtyBefore: row.qtyOnHand,
          delta,
          note,
          isReturn: !!isReturn,
          requestedBy: staff.id,
          requestedAt: new Date().toISOString(),
          status: 'pending',
        },
      })
      return true // went to the queue rather than the shelf
    }
    dispatch({ type: 'ADJUST_STOCK', rowId: row.id, delta, performedBy: staff.id, note, isReturn })
    return false
  }

  function confirmAdjust(delta, note, meta) {
    submitAdjustment({ row: adjusting.row, product: adjusting.product, delta, note, isReturn: meta?.isReturn })
    setAdjusting(null)
  }

  function exportRows() {
    const header = ['Product', 'SKU', 'Size', 'Branch', 'On hand', 'Reorder point', 'Sold 14d', 'Status']
    return filtered.map(({ row, product }) => [
      product.name,
      row.variantSku,
      row.size,
      branchName(row.branchId),
      row.qtyOnHand,
      row.reorderPoint,
      row.soldLast14d,
      status(row) ?? 'healthy',
    ])
  }
  const stamp = () => new Date().toISOString().slice(0, 10)
  const scopeLabel = effectiveBranch ? branchName(effectiveBranch) : 'all-branches'

  function toExcel() {
    const header = ['Product', 'SKU', 'Size', 'Branch', 'On hand', 'Reorder point', 'Sold 14d', 'Status']
    exportExcel(`stock-${scopeLabel}-${stamp()}.xlsx`, 'Stock', header, exportRows())
  }
  function toPDF() {
    const header = ['Product', 'SKU', 'Size', 'Branch', 'On hand', 'Reorder point', 'Sold 14d', 'Status']
    exportPDF({
      title: 'Stock Report',
      subtitle: effectiveBranch ? branchName(effectiveBranch) : 'All branches',
      meta: `${filtered.length} lines${onlyAlerts ? ' · needs attention only' : ''}`,
      headerRow: header,
      rows: exportRows(),
      filename: `stock-${scopeLabel}-${stamp()}.pdf`,
    })
  }

  // The shortage report is fixed to actual shortages (on hand at or below
  // reorder point) regardless of whatever's currently typed in search or
  // picked in the category filter — "print shortage" means every line
  // that's short, not whatever the table happens to be showing.
  const shortageRows = useMemo(() => {
    return state.stockLevels
      .filter((r) => (effectiveBranch ? r.branchId === effectiveBranch : true))
      .filter((r) => r.qtyOnHand <= r.reorderPoint)
      .map((r) => ({ row: r, product: productOf(r.sku) }))
      .filter(({ product }) => product)
      .sort((a, b) => a.row.qtyOnHand - b.row.qtyOnHand)
  }, [state.stockLevels, effectiveBranch])

  function toShortageReport() {
    exportPDF({
      title: 'Shortage Report',
      subtitle: effectiveBranch ? branchName(effectiveBranch) : 'All branches',
      meta: `${shortageRows.length} lines at or below reorder point`,
      headerRow: ['Product', 'SKU', 'Size', 'Branch', 'On hand', 'Reorder point', 'Short by'],
      rows: shortageRows.map(({ row, product }) => [
        product.name,
        row.variantSku,
        row.size,
        branchName(row.branchId),
        row.qtyOnHand,
        row.reorderPoint,
        row.qtyOnHand === 0 ? 'Out of stock' : row.reorderPoint - row.qtyOnHand,
      ]),
      filename: `shortage-report-${scopeLabel}-${stamp()}.pdf`,
    })
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Stock {effectiveBranch ? '' : '— Stockies'}</h1>
        <p className="muted">
          {effectiveBranch ? branchName(effectiveBranch) : 'Every branch, side by side'} · {filtered.length} lines
        </p>
      </div>

      <div className="toolbar">
        <input className="input" placeholder="Search SKU or product…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option>All</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label className="checkbox">
          <input type="checkbox" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} />
          Needs attention only
        </label>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="btn-small btn-ghost btn-xs" onClick={toExcel}>
            <Icon name="download" size={12} /> Export Excel
          </button>
          <button className="btn-small btn-ghost btn-xs" onClick={toPDF}>
            <Icon name="download" size={12} /> Export PDF
          </button>
          <button className="btn-small btn-xs" onClick={toShortageReport} disabled={shortageRows.length === 0} title="Every line at or below its reorder point">
            <Icon name="download" size={12} /> Shortage Report ({shortageRows.length})
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="toolbar" style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '8px 12px' }}>
          <span className="mono small">{selectedIds.size} selected</span>
          <button className="btn-small btn-xs" onClick={() => setBulkAdjusting(true)}>
            <Icon name="tag" size={11} /> Bulk adjust
          </button>
          <button className="btn-small btn-ghost btn-xs" onClick={() => setSelectedIds(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} aria-label="Select all on this page" />
              </th>
              <th>Product</th>
              <th>Size</th>
              {!effectiveBranch && <th>Branch</th>}
              <th>On hand</th>
              <th title="Reorder point — the line is flagged Low stock once On hand drops to this number or below it">
                <span className="th-help">
                  Reorder point <Icon name="help" size={11} />
                </span>
              </th>
              <th>Sold, 14d</th>
              <th>Cover</th>
              <th>Status</th>
              <th>Adjust</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(({ row, product }) => {
              const st = status(row)
              const cover = daysOfCover(row)
              return (
                <tr key={row.id}>
                  <td>
                    <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleRow(row.id)} aria-label={`Select ${product.name} (${row.size})`} />
                  </td>
                  <td>{product.name}</td>
                  <td className="mono">{row.size}</td>
                  {!effectiveBranch && <td>{branchName(row.branchId)}</td>}
                  <td className="mono strong">{row.qtyOnHand}</td>
                  <td className="mono muted">{row.reorderPoint}</td>
                  <td className="mono muted">{row.soldLast14d}</td>
                  <td className="mono muted">{Number.isFinite(cover) ? `${cover.toFixed(0)}d` : '—'}</td>
                  <td>{st && <StatusPill status={st} />}</td>
                  <td className="adjust-cell">
                    <button className="adjust-btn" onClick={() => setAdjusting({ row, product })}>
                      Adjust
                    </button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                  No lines match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} />
      )}

      {adjusting && (
        <AdjustStockModal
          row={adjusting.row}
          product={adjusting.product}
          approvalThreshold={approvalThresholdFor(staff.role)}
          onClose={() => setAdjusting(null)}
          onConfirm={confirmAdjust}
        />
      )}

      {bulkAdjusting && (
        <BulkAdjustModal
          rows={selectedRows}
          approvalThreshold={approvalThresholdFor(staff.role)}
          onClose={() => setBulkAdjusting(false)}
          onConfirm={confirmBulkAdjust}
        />
      )}
    </div>
  )
}
