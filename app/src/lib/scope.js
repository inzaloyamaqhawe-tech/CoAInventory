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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// A fixed calendar stamp rather than a relative "3d ago" — the point of
// showing when a task was actually handed over is that it doesn't keep
// changing its own wording as time passes. "Today, 09:34" if it happened
// today, otherwise "09 Jul 2026, 12:08" — always day/month/year first,
// 24-hour clock, so it never depends on the reader's locale to be unambiguous.
export function formatGivenAt(iso) {
  const d = new Date(iso)
  const now = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return `Today, ${hh}:${mm}`
  const day = String(d.getDate()).padStart(2, '0')
  return `${day} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`
}
