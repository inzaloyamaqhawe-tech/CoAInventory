import React, { useState } from 'react'
import Modal from './Modal.jsx'
import { useStore } from '../state/store.jsx'
import { CATEGORIES, formatZAR } from '../data/catalog'

const TEMPLATE = `sku,name,category,price,sizes
ACC-101,Navy Canvas Tote,Accessories,450,One Size
LNG-101,Weekend Hoodie,Loungewear,1350,S|M|L|XL`

const HEADER = ['sku', 'name', 'category', 'price', 'sizes']

// Turns pasted/uploaded CSV text into catalogue-shaped product rows, or a
// list of row-level problems if it can't. This is a simple comma split, not
// full RFC-4180 quoting — fine for the product fields we accept (none of
// them legitimately contain a comma), but it means a stray comma in a name
// silently misaligns that row rather than failing loudly, so every row also
// gets shown in the preview before anything is imported.
function parseCsv(text, existingSkus) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return { products: [], errors: ['The file is empty.'] }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const missing = HEADER.filter((h) => !header.includes(h))
  if (missing.length) return { products: [], errors: [`Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`] }

  const idx = Object.fromEntries(HEADER.map((h) => [h, header.indexOf(h)]))
  const seenInFile = new Set()
  const products = []
  const errors = []

  lines.slice(1).forEach((line, i) => {
    const rowNum = i + 2
    const cells = line.split(',').map((c) => c.trim())
    const sku = cells[idx.sku]?.toUpperCase()
    const name = cells[idx.name]
    const category = cells[idx.category]
    const priceRand = Number(cells[idx.price])
    const sizesCell = cells[idx.sizes]

    if (!sku || !name || !category || !sizesCell || !Number.isFinite(priceRand) || priceRand <= 0) {
      errors.push(`Row ${rowNum}: missing or invalid field${!Number.isFinite(priceRand) || priceRand <= 0 ? ' (price must be a positive number)' : ''}.`)
      return
    }
    if (!CATEGORIES.includes(category)) {
      errors.push(`Row ${rowNum}: "${category}" isn't a known category (${CATEGORIES.join(', ')}).`)
      return
    }
    if (existingSkus.includes(sku) || seenInFile.has(sku)) {
      errors.push(`Row ${rowNum}: SKU ${sku} already exists — skipped.`)
      return
    }
    seenInFile.add(sku)

    const sizes = sizesCell.split('|').map((s) => s.trim()).filter(Boolean)
    products.push({
      sku,
      name,
      category,
      priceCents: Math.round(priceRand * 100),
      salePriceCents: null,
      discountPct: 0,
      variants: sizes.map((size) => ({
        variantSku: sizes.length === 1 && sizes[0] === 'One Size' ? sku : `${sku}-${size}`,
        size,
      })),
    })
  })

  return { products, errors }
}

export default function CsvImportModal({ existingSkus, onClose }) {
  const { dispatch } = useStore()
  const [text, setText] = useState('')
  const [result, setResult] = useState(null) // { products, errors } | null
  const [done, setDone] = useState(false)

  function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  function preview() {
    setResult(parseCsv(text, existingSkus))
  }

  function confirm() {
    if (!result?.products.length) return
    dispatch({ type: 'ADD_PRODUCTS', products: result.products })
    setDone(true)
  }

  return (
    <Modal
      title="Bulk upload products"
      subtitle="CSV, one product per row — new SKUs are added to every branch's stock directory at 0 on hand."
      onClose={onClose}
      footer={
        done ? (
          <button className="btn-small" onClick={onClose}>
            Done
          </button>
        ) : (
          <>
            <button className="btn-small btn-ghost" onClick={onClose}>
              Cancel
            </button>
            {result ? (
              <button className="btn-small" disabled={!result.products.length} onClick={confirm}>
                Import {result.products.length} product{result.products.length === 1 ? '' : 's'}
              </button>
            ) : (
              <button className="btn-small" disabled={!text.trim()} onClick={preview}>
                Preview
              </button>
            )}
          </>
        )
      }
    >
      {done ? (
        <p>
          {result.products.length} product{result.products.length === 1 ? '' : 's'} added to the catalogue.
        </p>
      ) : (
        <>
          <div>
            <span className="field-label">CSV file</span>
            <input className="input" type="file" accept=".csv,text/csv" onChange={onFile} />
          </div>
          <div>
            <span className="field-label">…or paste CSV text</span>
            <textarea
              className="textarea"
              style={{ minHeight: 140, fontFamily: 'var(--font-mono, monospace)' }}
              placeholder={TEMPLATE}
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setResult(null)
              }}
            />
            <p className="small muted" style={{ marginTop: 6 }}>
              Columns: sku, name, category, price (rand), sizes (pipe-separated — e.g. S|M|L|XL, or One Size).
            </p>
          </div>

          {result && (
            <div style={{ marginTop: 8 }}>
              {result.errors.length > 0 && (
                <div className="table-wrap" style={{ maxHeight: 140, marginBottom: 8 }}>
                  {result.errors.map((e, i) => (
                    <p key={i} className="small" style={{ color: 'var(--critical)', margin: '2px 0' }}>
                      {e}
                    </p>
                  ))}
                </div>
              )}
              {result.products.length > 0 && (
                <div className="table-wrap" style={{ maxHeight: 200 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Sizes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.products.map((p) => (
                        <tr key={p.sku}>
                          <td className="mono muted">{p.sku}</td>
                          <td>{p.name}</td>
                          <td>{p.category}</td>
                          <td className="mono">{formatZAR(p.priceCents)}</td>
                          <td className="mono">{p.variants.map((v) => v.size).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
