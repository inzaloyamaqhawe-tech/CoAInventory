import React, { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Icon from './Icon.jsx'
import Wordmark from './Wordmark.jsx'
import { useSession } from '../state/session.jsx'
import { useScope } from '../lib/scope'
import { useBranchFilter } from '../state/branchFilter.jsx'
import { BRANCHES } from '../data/branches'
import { useStore } from '../state/store.jsx'
import { computeAlerts } from '../lib/alerts'
import { NAV } from '../lib/nav'

export default function Layout({ children }) {
  const { staff, signOut } = useSession()
  const { isAll } = useScope()
  const { branchId, setBranchId } = useBranchFilter()
  const { state } = useStore()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const items = useMemo(() => NAV.filter((n) => n.roles.includes(staff.role)), [staff.role])
  const primary = items.slice(0, 4)
  const overflow = items.slice(4)

  const alertCount = useMemo(() => {
    const all = computeAlerts(state.stockLevels)
    return isAll ? all.length : all.filter((a) => a.branchId === staff.branchId).length
  }, [state.stockLevels, isAll, staff.branchId])

  function labelFor(item) {
    return item.altLabel?.[staff.role] ?? item.label
  }

  const branchSwitcher = isAll && (
    <select className="branch-select" value={branchId ?? ''} onChange={(e) => setBranchId(e.target.value || null)}>
      <option value="">All Branches</option>
      {BRANCHES.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  )

  return (
    <div className="shell">
      {/* Tablet / PC — a sticky top bar, not a sidebar that scrolls off with
          the page. Every nav item sits inline; nothing here moves when the
          content underneath it does. */}
      <header className="topnav">
        <div className="topnav-inner">
          <div className="topnav-brand">
            <Wordmark size={22} />
            <span>CHIEFS OF ANGELS</span>
          </div>
          <nav className="topnav-links">
            {items.map((item) => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => 'topnav-link' + (isActive ? ' active' : '')} end={item.path === '/'}>
                {labelFor(item)}
                {item.path === '/alerts' && alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="topnav-utility">
            {branchSwitcher}
            <NavLink to="/alerts" className="bell-btn" aria-label="Alerts">
              <Icon name="bell" size={16} />
              {alertCount > 0 && <span className="badge">{alertCount}</span>}
            </NavLink>
            <span className="avatar avatar-sm" title={staff.name}>
              {staff.initials}
            </span>
            <button className="icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out">
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Phone — the compact bar the bottom tab strip pairs with. */}
      <header className="topbar">
        <div className="topbar-left">
          <span className="page-crumb">{items.find((i) => i.path === location.pathname)?.label ?? ''}</span>
        </div>
        <div className="topbar-right">
          {branchSwitcher}
          <NavLink to="/alerts" className="bell-btn" aria-label="Alerts">
            <Icon name="bell" size={17} />
            {alertCount > 0 && <span className="badge">{alertCount}</span>}
          </NavLink>
        </div>
      </header>

      <main className="content">{children}</main>

      <nav className="bottom-nav">
        {primary.map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => 'bottom-link' + (isActive ? ' active' : '')} end={item.path === '/'}>
            <Icon name={item.icon} size={19} />
            <span>{labelFor(item)}</span>
          </NavLink>
        ))}
        {overflow.length > 0 && (
          <button className={'bottom-link' + (moreOpen ? ' active' : '')} onClick={() => setMoreOpen((v) => !v)}>
            <Icon name="more" size={19} />
            <span>More</span>
          </button>
        )}
      </nav>

      {moreOpen && (
        <>
          <div className="sheet-backdrop" onClick={() => setMoreOpen(false)} />
          <div className="sheet">
            {overflow.map((item) => (
              <NavLink key={item.path} to={item.path} className="sheet-link" onClick={() => setMoreOpen(false)}>
                <Icon name={item.icon} />
                <span>{labelFor(item)}</span>
                {item.path === '/alerts' && alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
              </NavLink>
            ))}
            <button className="sheet-link sheet-signout" onClick={signOut}>
              <Icon name="logout" />
              <span>Sign out</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
