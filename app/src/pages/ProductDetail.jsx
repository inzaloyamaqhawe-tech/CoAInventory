import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { CATALOG, formatZAR } from '../data/catalog'
import { useStore, useStaff } from '../state/store.jsx'
import { BRANCHES, branchName } from '../data/branches'
import { timeAgo } from '../lib/scope'
import StatusPill from '../components/StatusPill.jsx'

export default function ProductDetail() {
  const { sku } = useParams()
  const { state } = useStore()
  const { staffName } = useStaff()
  const product = CATALOG.find((p) => p.sku === sku)

  if (!product) {
    return (
      <div className="page">
        <p>Product not found.</p>
        <Link to="/products" className="link">Back to Products</Link>
      </div>
    )
  }

  const variantSkus = product.variants.map((v) => v.variantSku)
  const rows = state.stockLevels.filter((r) => variantSkus.includes(r.variantSku))
  const activity = state.activity.filter((a) => variantSkus.includes(a.variantSku)).slice(0, 12)
  const totalStock = rows.reduce((s, r) => s + r.qtyOnHand, 0)

  return (
    <div className="page">
      <Link to="/products" className="link back">&larr; Products</Link>
      <div className="page-head">
        <h1>{product.name}</h1>
        <p className="muted mono">{product.sku} · {product.category}</p>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="k">Price</div>
          <div className="v">
            {product.salePriceCents ? (
              <>
                <span className="strike small">{formatZAR(product.priceCents)}</span> {formatZAR(product.salePriceCents)}
              </>
            ) : (
              formatZAR(product.priceCents)
            )}
          </div>
        </div>
        <div className="stat">
          <div className="k">Total stock</div>
          <div className="v">{totalStock}</div>
        </div>
        <div className="stat">
          <div className="k">Variants</div>
          <div className="v">{product.variants.length}</div>
        </div>
      </div>

      <section>
        <div className="section-head">
          <h3>Stock by branch &amp; size</h3>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Size</th>
                {BRANCHES.map((b) => (
                  <th key={b.id}>{b.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {product.variants.map((v) => (
                <tr key={v.variantSku}>
                  <td>{v.size}</td>
                  {BRANCHES.map((b) => {
                    const row = rows.find((r) => r.variantSku === v.variantSku && r.branchId === b.id)
                    const low = row && row.qtyOnHand <= row.reorderPoint
                    return (
                      <td key={b.id} className={'mono' + (low ? ' cell-low' : '')}>
                        {row?.qtyOnHand ?? '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h3>Recent activity</h3>
        </div>
        {activity.length === 0 && <p className="muted">No recent movements logged.</p>}
        {activity.map((a) => (
          <div key={a.id} className="row-card">
            <div>
              <div className="name">
                {a.type === 'return' ? <StatusPill status="return" /> : a.type.replace('_', ' ')} · {branchName(a.branchId)}
              </div>
              <div className="sub">
                {staffName(a.performedBy)} · {timeAgo(a.at)}
                {a.note && ` · ${a.note}`}
              </div>
            </div>
            <span className={'mono ' + (a.qtyDelta >= 0 ? 'sale-pos' : 'sale-neg')}>
              {a.qtyDelta >= 0 ? '+' : ''}
              {a.qtyDelta}
            </span>
          </div>
        ))}
      </section>
    </div>
  )
}
