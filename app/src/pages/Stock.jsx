import React, { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { useScope } from '../lib/scope'
import { useBranchFilter } from '../state/branchFilter.jsx'
import { productOf } from '../lib/derive'
import { CATEGORIES } from '../data/catalog'
import { BRANCHES, branchName } from '../data/branches'
import { daysOfCover } from '../lib/alerts'
import { exportExcel, exportPDF } from '../lib/exportDocs'
import StatusPill from '../components/StatusPill.jsx'
import Pagination from '../components/Pagination.jsx'
import AdjustStockModal from '../components/AdjustStockModal.jsx'
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
  // rather than showing an empty page 6 of a now-12-row result.
  useEffect(() => setPage(1), [q, cat, onlyAlerts, effectiveBranch, pageSize])

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  function status(row) {
    if (row.qtyOnHand === 0) return 'out_of_stock'
    if (row.qtyOnHand <= row.reorderPoint) return 'low_stock'
    if (row.qtyOnHand >= row.parLevel * 2 && row.soldLast14d === 0) return 'overstock'
    return null
  }

  function confirmAdjust(delta, note) {
    dispatch({ type: 'ADJUST_STOCK', rowId: adjusting.row.id, delta, performedBy: staff.id, note })
    setAdjusting(null)
  }

  function exportRows() {
    const header = ['Product', 'SKU', 'Size', 'Branch', 'On hand', 'Reorder at', 'Sold 14d', 'Status']
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
    const header = ['Product', 'SKU', 'Size', 'Branch', 'On hand', 'Reorder at', 'Sold 14d', 'Status']
    exportExcel(`stock-${scopeLabel}-${stamp()}.xlsx`, 'Stock', header, exportRows())
  }
  function toPDF() {
    const header = ['Product', 'SKU', 'Size', 'Branch', 'On hand', 'Reorder', 'Sold 14d', 'Status']
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
      headerRow: ['Product', 'SKU', 'Size', 'Branch', 'On hand', 'Reorder at', 'Short by'],
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

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Size</th>
              {!effectiveBranch && <th>Branch</th>}
              <th>On hand</th>
              <th>Reorder at</th>
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
                <td colSpan={9} className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
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
        <AdjustStockModal row={adjusting.row} product={adjusting.product} onClose={() => setAdjusting(null)} onConfirm={confirmAdjust} />
      )}
    </div>
  )
}
