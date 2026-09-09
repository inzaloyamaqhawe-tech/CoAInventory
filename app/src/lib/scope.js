import { useSession } from '../state/session.jsx'
import { ROLES } from '../data/branches'

// Central place that answers "what is this person allowed to see" — used by
// every page so scoping logic lives in one spot, matching 05-DATA-MODEL.md's
// role.scope column (all_branches vs own_branch).
export function useScope() {
  const { staff } = useSession()
  if (!staff) return { staff: null, isAll: false, branchId: null, role: null }
  const isAll = ROLES[staff.role].scope === 'all'
  return { staff, isAll, branchId: isAll ? null : staff.branchId, role: staff.role }
}

export function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}
