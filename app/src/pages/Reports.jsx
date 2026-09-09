import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { useStore } from '../state/store.jsx'
import { useScope } from '../lib/scope'
import { leaderboard, topMover, coldest, taskCompletion } from '../lib/derive'
import { exportExcel, exportPDF } from '../lib/exportDocs'
import { formatZAR } from '../data/catalog'
import { STAFF, branchName } from '../data/branches'
import Icon from '../components/Icon.jsx'

const RED = '#c8102e'
const INK = '#17140f'

export default function Reports() {
  const { state } = useStore()
  const { staff, isAll } = useScope()
  const board = leaderboard(state.stockLevels)
  const scopedBranches = isAll ? board.map((r) => r.branch) : board.map((r) => r.branch).filter((b) => b.id === staff.branchId)
  const scopedBoard = board.filter((row) => scopedBranches.includes(row.branch))
  const staffRows = STAFF.filter((s) => (isAll ? s.role !== 'ops_manager' && s.role !== 'stock_controller' : s.branchId === staff.branchId))
  const staffCompletionRows = staffRows
    .map((s) => ({ s, c: taskCompletion(state.tasks, (t) => t.assignedTo === s.id) }))
    .filter(({ c }) => c.total > 0)

  const stamp = () => new Date().toISOString().slice(0, 10)

  function toExcel() {
    const header = ['Branch', 'Revenue (14d)', 'Units sold (14d)']
    const rows = scopedBoard.map((r) => [r.branch.name, r.revenue / 100, r.units])
    exportExcel(`branch-report-${stamp()}.xlsx`, 'Leaderboard', header, rows)
  }

  function toPDF() {
    exportPDF({
      title: 'Operations Report',
      subtitle: 'Last 14 days',
      filename: `operations-report-${stamp()}.pdf`,
      sections: [
        {
          heading: 'Branch leaderboard',
          headerRow: ['Branch', 'Revenue', 'Units sold'],
          rows: scopedBoard.map((r) => [r.branch.name, formatZAR(r.revenue), r.units]),
        },
        {
          heading: 'Staff task completion',
          headerRow: ['Staff', 'Branch', 'Completion'],
          rows: staffCompletionRows.map(({ s, c }) => [s.name, branchName(s.branchId), `${c.pct}%`]),
        },
      ],
    })
  }

  return (
    <div className="page">
      <div className="page-head">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h1>Reports</h1>
            <p className="muted">Last 14 days · sell-through &amp; team performance</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn-small btn-ghost btn-xs" onClick={toExcel}>
              <Icon name="download" size={12} /> Excel
            </button>
            <button className="btn-small btn-ghost btn-xs" onClick={toPDF}>
              <Icon name="download" size={12} /> PDF
            </button>
          </div>
        </div>
      </div>

      <div className="chart-card">
        <h3>Revenue by branch</h3>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scopedBoard.map((r) => ({ name: r.branch.name, revenue: r.revenue, units: r.units }))} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e1d2" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#77705f' }} axisLine={{ stroke: '#e7e1d2' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#77705f' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R${Math.round(v / 1000)}k`} width={46} />
              <Tooltip formatter={(v, key) => (key === 'revenue' ? formatZAR(v) : v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e1d2' }} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {scopedBoard.map((r, i) => (
                  <Cell key={r.branch.id} fill={i === 0 ? RED : INK} fillOpacity={i === 0 ? 1 : 0.82} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <section>
        <div className="section-head">
          <h3>Leaderboard</h3>
        </div>
        {scopedBoard.map((row, i) => (
          <div key={row.branch.id} className="lb-row">
            <span className={'lb-rank' + (i === 0 ? ' first' : '')}>{i + 1}</span>
            <span className="lb-name">{row.branch.name}</span>
            <span className="lb-track">
              <span className="lb-fill" style={{ width: `${board[0].revenue ? (row.revenue / board[0].revenue) * 100 : 0}%` }} />
            </span>
            <span className="lb-val">{formatZAR(row.revenue)}</span>
          </div>
        ))}
      </section>

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
    </div>
  )
}
