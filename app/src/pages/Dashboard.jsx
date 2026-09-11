import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { useStore, useStaff } from '../state/store.jsx'
import { useScope } from '../lib/scope'
import { useBranchFilter } from '../state/branchFilter.jsx'
import { computeAlerts, computeTransferSuggestions } from '../lib/alerts'
import { leaderboard, branchRevenue14d, branchUnits14d, taskCompletion, dailySeries, monthlySeries, productOf, topProducts, swatchClass } from '../lib/derive'
import { formatZAR } from '../data/catalog'
import { BRANCHES, branchName } from '../data/branches'
import StatusPill from '../components/StatusPill.jsx'
import Icon from '../components/Icon.jsx'

const RED = '#c8102e'
const INK = '#17140f'

export default function Dashboard() {
  const { state } = useStore()
  const { staffById } = useStaff()
  const { staff, isAll } = useScope()
  const { branchId: filterBranch } = useBranchFilter()
  const effectiveBranch = isAll ? filterBranch : staff.branchId

  const alerts = useMemo(() => {
    const all = computeAlerts(state.stockLevels)
    return effectiveBranch ? all.filter((a) => a.branchId === effectiveBranch) : all
  }, [state.stockLevels, effectiveBranch])

  const suggestions = useMemo(() => {
    const all = computeTransferSuggestions(state.stockLevels, state.transfers)
    return effectiveBranch ? all.filter((s) => s.fromBranchId === effectiveBranch || s.toBranchId === effectiveBranch) : all
  }, [state.stockLevels, state.transfers, effectiveBranch])
  // The dashboard digest is "what needs a decision right now" — a
  // suggestion someone's already accepted is progressing on its own and
  // belongs on the Transfers board, not repeated here as if unactioned.
  const newSuggestions = useMemo(() => suggestions.filter((s) => !s.linkedTransfer), [suggestions])

  const board = useMemo(() => leaderboard(state.stockLevels), [state.stockLevels])
  const bestSellers = useMemo(() => topProducts(state.stockLevels, effectiveBranch, 5), [state.stockLevels, effectiveBranch])
  const revenue = effectiveBranch ? branchRevenue14d(state.stockLevels, effectiveBranch) : board.reduce((s, r) => s + r.revenue, 0)
  const units = effectiveBranch ? branchUnits14d(state.stockLevels, effectiveBranch) : board.reduce((s, r) => s + r.units, 0)
  const trend = useMemo(() => dailySeries(revenue), [revenue])
  const months = useMemo(() => monthlySeries(state.salesHistory, effectiveBranch), [state.salesHistory, effectiveBranch])
  const monthDirection = useMemo(() => {
    if (months.length < 2) return null
    const last = months[months.length - 1].revenue
    const prev = months[months.length - 2].revenue
    if (!prev) return null
    return Math.round(((last - prev) / prev) * 100)
  }, [months])

  // "Which branch is behind today" — the ops view that the leaderboard
  // (which is about money) doesn't answer.
  const branchProgress = useMemo(() => {
    return BRANCHES.map((b) => {
      const tasks = taskCompletion(state.tasks, (t) => t.branchId === b.id)
      const openOrders = state.orders.filter((o) => o.branchId === b.id && o.status !== 'fulfilled').length
      const unassigned = state.orders.filter((o) => o.branchId === b.id && o.status !== 'fulfilled' && !o.assignedTo).length
      return { branch: b, tasks, openOrders, unassigned }
    }).filter((r) => r.tasks.total > 0 || r.openOrders > 0)
  }, [state.tasks, state.orders])

  const myTasks = state.tasks.filter((t) => t.assignedTo === staff.id)
  const branchTasksToday = taskCompletion(state.tasks, (t) => (effectiveBranch ? t.branchId === effectiveBranch : true))
  const pickups = state.orders.filter((o) => o.status === 'ready' && (effectiveBranch ? o.branchId === effectiveBranch : true))
  const isAssociate = staff.role === 'sales_associate'
  const dateLabel = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })
  const scopeLabel = effectiveBranch ? branchName(effectiveBranch) : `All branches · ${BRANCHES.filter((b) => b.type === 'retail').length} stores`

  return (
    <div className="page">
      <div className="hero">
        {isAssociate ? (
          <div className="hero-top">
            <div>
              <div className="hero-eyebrow">{dateLabel}</div>
              <h1>{branchName(staff.branchId)}</h1>
              <p>Today's tasks &amp; pickups</p>
            </div>
            <span className="hero-badge">
              {branchTasksToday.done}/{branchTasksToday.total} tasks done
            </span>
          </div>
        ) : (
          <div className="hero-top">
            <div>
              <div className="hero-eyebrow">Sales overview · {scopeLabel}</div>
              <h1>{formatZAR(revenue)}</h1>
              <p>{units} units sold, last 14 days</p>
            </div>
            <span className="hero-badge">Top branch: {board[0]?.branch.name ?? '—'}</span>
          </div>
        )}
        {!isAssociate && (
          <div style={{ height: 64, marginTop: 14, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="revenue" stroke="#ffffff" strokeWidth={2} fill="url(#heroFill)" isAnimationActive={true} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {!isAssociate && (
        <div className="stat-row">
          <div className="stat">
            <div className="k">Sales, last 14 days</div>
            <div className="v">{formatZAR(revenue)}</div>
          </div>
          <div className="stat">
            <div className="k">Units sold</div>
            <div className="v">{units}</div>
          </div>
          <div className="stat">
            <div className="k">Open alerts</div>
            <div className="v">{alerts.length}</div>
          </div>
          <div className="stat">
            <div className="k">Tasks done today</div>
            <div className="v">
              {branchTasksToday.done}
              <small>/{branchTasksToday.total}</small>
            </div>
          </div>
        </div>
      )}

      {isAssociate && (
        <section>
          <div className="section-head">
            <h3>My tasks</h3>
            <Link to="/team" className="link">
              See all <Icon name="arrowRight" size={13} />
            </Link>
          </div>
          {myTasks.slice(0, 5).map((t) => (
            <Link key={t.id} to="/team" className="row-card">
              <div>
                <div className="name">{t.title}</div>
                <div className="sub">{t.type}</div>
              </div>
              <StatusPill status={t.status} />
            </Link>
          ))}
          {myTasks.length === 0 && <p className="muted">Nothing assigned right now.</p>}
        </section>
      )}

      {!isAssociate && bestSellers.length > 0 && (
        <div className="chart-card ticker-card">
          <h3>Top sellers — last 14 days</h3>
          <p className="muted small" style={{ margin: '-2px 0 12px' }}>
            {effectiveBranch ? branchName(effectiveBranch) : 'Across every branch'} · by units sold · hover to pause
          </p>
          <div className="ticker-viewport">
            <div className="ticker-track">
              {[...bestSellers, ...bestSellers].map((entry, i) => (
                <Link key={i} to={`/products/${entry.product.sku}`} className="ticker-item">
                  <span className="lb-rank first" style={{ fontSize: 22 }}>
                    {(i % bestSellers.length) + 1}
                  </span>
                  <span className={`top-seller-swatch ${swatchClass(entry.product.category)}`}>
                    <Icon name="tag" size={14} />
                  </span>
                  <span className="top-seller-name">
                    <span className="n">{entry.product.name}</span>
                    <span className="c">{entry.product.category}</span>
                  </span>
                  <span className="pill pill-ok">{entry.units} sold</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isAssociate && months.length > 1 && (
        <div className="chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h3>Sales trend — last {months.length} months</h3>
            {monthDirection !== null && (
              <span className={'pill ' + (monthDirection >= 0 ? 'pill-ok' : 'pill-critical')}>
                {monthDirection >= 0 ? '▲' : '▼'} {Math.abs(monthDirection)}% vs last month
              </span>
            )}
          </div>
          <p className="muted small" style={{ margin: '-2px 0 12px' }}>
            {effectiveBranch ? branchName(effectiveBranch) : 'Every branch combined'} · monthly totals
          </p>
          <div style={{ height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={months} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="monthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={RED} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={RED} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e1d2" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#77705f' }} axisLine={{ stroke: '#e7e1d2' }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#77705f' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R${Math.round(v / 1000)}k`}
                  width={52}
                />
                <Tooltip formatter={(v) => formatZAR(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e1d2' }} />
                <Area type="monotone" dataKey="revenue" stroke={RED} strokeWidth={2.4} fill="url(#monthFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!isAssociate && !effectiveBranch && branchProgress.length > 0 && (
        <section>
          <div className="section-head">
            <h3>Today, by branch</h3>
            <span className="muted small">tasks done · open orders</span>
          </div>
          {branchProgress.map(({ branch, tasks, openOrders, unassigned }) => (
            <div key={branch.id} className="lb-row">
              <span className="lb-name">{branch.name}</span>
              <span className="lb-track">
                <span
                  className="lb-fill"
                  style={{ width: `${tasks.pct}%`, background: tasks.pct < 50 ? 'var(--critical)' : undefined }}
                />
              </span>
              <span className="mono muted small" style={{ whiteSpace: 'nowrap' }}>
                {tasks.done}/{tasks.total} tasks
              </span>
              <span className="lb-val" style={{ whiteSpace: 'nowrap' }}>
                {openOrders} open
                {unassigned > 0 && <span className="text-critical"> · {unassigned} unassigned</span>}
              </span>
            </div>
          ))}
        </section>
      )}

      {!isAssociate && !effectiveBranch && (
        <div className="chart-card">
          <h3>Branch leaderboard — last 14 days</h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={board.map((r) => ({ name: r.branch.name, revenue: r.revenue }))} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e1d2" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#77705f' }} axisLine={{ stroke: '#e7e1d2' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#77705f' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R${Math.round(v / 1000)}k`} width={44} />
                <Tooltip formatter={(v) => formatZAR(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e1d2' }} />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                  {board.map((r, i) => (
                    <Cell key={r.branch.id} fill={i === 0 ? RED : INK} fillOpacity={i === 0 ? 1 : 0.82} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Alerts and transfer suggestions are an Operations Manager / Branch
          Manager tool, not something a Sales Associate sees or acts on —
          associates request what they're short of instead (see Orders). */}
      {!isAssociate && (
        <section>
          <div className="section-head">
            <h3>Alerts</h3>
            <Link to="/alerts" className="link">
              {alerts.length + newSuggestions.length} open <Icon name="arrowRight" size={13} />
            </Link>
          </div>
          {alerts.slice(0, 4).map((a) => (
            <Link key={a.id} to="/alerts" className={`alert alert-${a.severity}`}>
              <StatusPill status={a.type} />
              <div className="body">
                <p>{a.title}</p>
                <p className="meta">{a.meta}</p>
              </div>
            </Link>
          ))}
          {newSuggestions.slice(0, 2).map((s) => (
            <Link key={s.id} to="/transfers" className="alert alert-suggestion">
              <StatusPill status="suggested">Transfer</StatusPill>
              <div className="body">
                <p>
                  {s.qty}&times; {productNameOf(s.sku, s.size)}
                </p>
                <p className="meta">
                  {branchName(s.fromBranchId)} &rarr; {branchName(s.toBranchId)}
                </p>
              </div>
            </Link>
          ))}
          {alerts.length === 0 && newSuggestions.length === 0 && <p className="muted">Nothing needs attention.</p>}
        </section>
      )}

      {pickups.length > 0 && (
        <section>
          <div className="section-head">
            <h3>Ready for pickup</h3>
          </div>
          {pickups.slice(0, 4).map((o) => {
            const owner = staffById(o.assignedTo)
            return (
              <Link key={o.id} to={`/orders/${o.id}`} className="row-card">
                <div>
                  <div className="name">{o.id}</div>
                  <div className="sub">{o.customer}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {owner ? (
                    <span className="assignee-chip">
                      <span className="avatar avatar-sm">{owner.initials}</span>
                    </span>
                  ) : (
                    <span className="pill pill-warn">Unassigned</span>
                  )}
                  <StatusPill status={o.status} />
                </div>
              </Link>
            )
          })}
        </section>
      )}
    </div>
  )
}

function productNameOf(sku, size) {
  const product = productOf(sku)
  const name = product?.name ?? sku
  return size && size !== 'One Size' ? `${name} (${size})` : name
}
