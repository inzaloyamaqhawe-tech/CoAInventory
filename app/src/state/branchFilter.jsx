import React, { createContext, useContext, useState } from 'react'
import { useScope } from '../lib/scope'

// The branch switcher pill in the top bar (Ops Manager / Stock Controller
// only) writes here; every page reads the *effective* branch filter through
// this hook instead of re-deriving it, so "All Branches" vs one branch stays
// consistent everywhere at once.
const Ctx = createContext(null)

export function BranchFilterProvider({ children }) {
  const [branchId, setBranchId] = useState(null) // null = All Branches
  return <Ctx.Provider value={{ branchId, setBranchId }}>{children}</Ctx.Provider>
}

export function useBranchFilter() {
  const { isAll, branchId: ownBranch } = useScope()
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useBranchFilter must be used within BranchFilterProvider')
  if (!isAll) return { branchId: ownBranch, setBranchId: () => {}, locked: true }
  return { branchId: ctx.branchId, setBranchId: ctx.setBranchId, locked: false }
}
