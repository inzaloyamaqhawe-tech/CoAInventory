import React, { createContext, useContext, useState } from 'react'
import { useStaff } from './store.jsx'

const SessionCtx = createContext(null)

// Deliberately NOT persisted to localStorage/sessionStorage — a shop device
// or a lost/unlocked phone must never come back up already signed in as
// whoever used it last. Every load of the app lands on Sign In; signing in
// only holds for as long as this tab stays open, same as a real PIN login
// would once it's built.
export function SessionProvider({ children }) {
  const [staffId, setStaffId] = useState(null)
  const { staffById } = useStaff()

  function signIn(id) {
    setStaffId(id)
  }
  function signOut() {
    setStaffId(null)
  }

  // Resolved against the live roster, so deactivating someone drops them out
  // of their own session on the next render rather than leaving a
  // deactivated person signed in and still working.
  const found = staffId ? staffById(staffId) : null
  const staff = found && found.active !== false ? found : null
  return <SessionCtx.Provider value={{ staff, signIn, signOut }}>{children}</SessionCtx.Provider>
}

export function useSession() {
  const ctx = useContext(SessionCtx)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
