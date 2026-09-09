import React, { createContext, useContext, useState } from 'react'
import { STAFF } from '../data/branches'

const SessionCtx = createContext(null)

// Deliberately NOT persisted to localStorage/sessionStorage — a shop device
// or a lost/unlocked phone must never come back up already signed in as
// whoever used it last. Every load of the app lands on Sign In; signing in
// only holds for as long as this tab stays open, same as a real PIN login
// would once it's built.
export function SessionProvider({ children }) {
  const [staffId, setStaffId] = useState(null)

  function signIn(id) {
    setStaffId(id)
  }
  function signOut() {
    setStaffId(null)
  }

  const staff = STAFF.find((s) => s.id === staffId) ?? null
  return <SessionCtx.Provider value={{ staff, signIn, signOut }}>{children}</SessionCtx.Provider>
}

export function useSession() {
  const ctx = useContext(SessionCtx)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
