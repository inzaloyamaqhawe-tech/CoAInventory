import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATALOG, CATEGORIES, formatZAR } from '../data/catalog'
import { useStore } from '../state/store.jsx'
import { useBranchFilter } from '../state/branchFilter.jsx'
import { swatchClass } from '../lib/derive'
import StatusPill from '../components/StatusPill.jsx'
import Icon from '../components/Icon.jsx'

export default function Products() {
  const { state } = useStore()
  const { branchId } = useBranchFilter()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [view, setView] = useState('grid')

  const rows = useMemo(() => {
    return CATALOG.filter((p) => (cat === 'All' || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase())).map((p) => {
      const variantSkus = p.variants.map((v) => v.variantSku)
      const stockRows = state.stockLevels.filter((r) => variantSkus.includes(r.variantSku) && (!branchId || r.branchId === branchId))
      const total = stockRows.reduce((s, r) => s + r.qtyOnHand, 0)
      const anyLow = stockRows.some((r) => r.qtyOnHand <= r.reorderPoint)
      return { product: p, total, anyLow }
    })
  }, [q, cat, state.stockLevels, branchId])

  return (
    <div className="page">
      <div className="page-head">
        <h1>Products</h1>
        <p className="muted">{CATALOG.length} products across {CATEGORIES.length} categories · catalogue shared by every branch</p>
      </div>

      <div className="toolbar">
        <input className="input" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option>All</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <div className="view-toggle" style={{ marginLeft: 'auto' }}>
          <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
            Grid
          </button>
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
            Table
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="product-grid">
          {rows.map(({ product, total, anyLow }) => (
            <Link key={product.sku} to={`/products/${product.sku}`} className="product-card">
              <div className={`product-swatch ${swatchClass(product.category)}`} style={{ color: '#fff' }}>
                <Icon name="tag" size={30} />
              </div>
              <div className="product-card-body">
                <div className="product-card-name">{product.name}</div>
                <div className="product-card-meta">
                  <span className="mono">
                    {product.salePriceCents ? (
                      <span className="sale">{formatZAR(product.salePriceCents)}</span>
                    ) : (
                      formatZAR(product.priceCents)
                    )}
                  </span>
                  {anyLow ? <StatusPill status="low_stock">Low</StatusPill> : <span className="mono muted small">{total} in stock</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Price</th>
                <th>{branchId ? 'Stock here' : 'Stock, all branches'}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ product, total, anyLow }) => (
                <tr key={product.sku}>
                  <td>
                    <Link to={`/products/${product.sku}`} className="table-name">
                      {product.name}
                    </Link>
                  </td>
                  <td className="mono muted">{product.sku}</td>
                  <td>{product.category}</td>
                  <td className="mono">
                    {product.salePriceCents ? (
                      <>
                        <span className="strike">{formatZAR(product.priceCents)}</span> <span className="sale">{formatZAR(product.salePriceCents)}</span>
                      </>
                    ) : (
                      formatZAR(product.priceCents)
                    )}
                  </td>
                  <td className="mono">{total}</td>
                  <td>{anyLow && <StatusPill status="low_stock" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
