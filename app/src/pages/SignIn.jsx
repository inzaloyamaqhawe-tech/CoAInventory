import React from 'react'
import { useSession } from '../state/session.jsx'
import { useStaff } from '../state/store.jsx'
import { BRANCHES, ROLES, branchName } from '../data/branches'
import Wordmark from '../components/Wordmark.jsx'
import Icon from '../components/Icon.jsx'

const FEATURES = [
  { icon: 'layers', text: 'Live stock across every branch, not a WhatsApp thread' },
  { icon: 'swap', text: 'Transfer suggestions the system finds before you go looking' },
  { icon: 'users', text: 'One app that reshapes for whoever is signed in' },
]

export default function SignIn() {
  const { signIn } = useSession()
  const { activeStaff } = useStaff()

  // Deactivated staff never appear here — that's what deactivating is for.
  const byRole = {
    ops_manager: activeStaff.filter((s) => s.role === 'ops_manager'),
    stock_controller: activeStaff.filter((s) => s.role === 'stock_controller'),
    branch_manager: activeStaff.filter((s) => s.role === 'branch_manager'),
    sales_associate: activeStaff.filter((s) => s.role === 'sales_associate'),
  }

  return (
    <div className="signin">
      <div className="signin-brand">
        <div className="signin-brand-inner">
          <span className="signin-brand-mark">
            <Wordmark height={72} variant="white" />
          </span>
          <h1>Run every branch from one screen.</h1>
          <p>Stock, transfers, staff and orders — built for the shop floor, not a back-office desktop.</p>
          <ul className="signin-features">
            {FEATURES.map((f) => (
              <li key={f.text}>
                <Icon name={f.icon} size={17} />
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="signin-brand-glow" aria-hidden="true" />
      </div>

      <div className="signin-form">
        <div className="signin-form-inner">
          <h2>Who's signing in?</h2>

          {Object.entries(byRole).map(([roleKey, people]) => (
            <div key={roleKey} className="signin-group">
              <div className="signin-group-label">{ROLES[roleKey].label}</div>
              <div className="signin-people">
                {people.map((s) => (
                  <button key={s.id} className="signin-person" onClick={() => signIn(s.id)}>
                    <span className="avatar">{s.initials}</span>
                    <span>
                      <span className="n">{s.name}</span>
                      <span className="b">{s.branchId ? branchName(s.branchId) : 'All branches'}</span>
                    </span>
                    <Icon name="arrowRight" size={14} className="signin-person-go" />
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="signin-branches muted">Branches: {BRANCHES.map((b) => b.name).join(' · ')}</div>
        </div>
      </div>
    </div>
  )
}
