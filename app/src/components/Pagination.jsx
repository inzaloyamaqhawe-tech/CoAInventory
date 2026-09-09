import React from 'react'

const SIZES = [25, 50, 100]

// Keeps a long table to a bounded number of DOM rows at once — the fix for
// "the whole screen shakes when you scroll a 500-row table." Page size is
// user-adjustable, matching Bolide WMS's own tables.
export default function Pagination({ page, pageSize, total, onPage, onPageSize }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  return (
    <div className="pagination">
      <span className="muted small">
        {from}–{to} of {total}
      </span>
      <div className="pagination-controls">
        <select className="input input-xs" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s} / page
            </option>
          ))}
        </select>
        <button className="btn-small btn-ghost btn-xs" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </button>
        <span className="mono small muted">
          {page} / {pageCount}
        </span>
        <button className="btn-small btn-ghost btn-xs" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}
