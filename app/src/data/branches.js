export const BRANCHES = [
  { id: 'SAN', name: 'Sandton City', type: 'retail', city: 'Johannesburg' },
  { id: 'CPT', name: 'V&A Waterfront', type: 'retail', city: 'Cape Town' },
  { id: 'DBN', name: 'Gateway', type: 'retail', city: 'Durban' },
  { id: 'WH', name: 'Online Fulfilment', type: 'warehouse', city: 'Johannesburg' },
]

export const ROLES = {
  ops_manager: { label: 'Operations Manager', scope: 'all' },
  branch_manager: { label: 'Branch Manager', scope: 'branch' },
  sales_associate: { label: 'Sales Associate', scope: 'branch' },
  stock_controller: { label: 'Stock Controller', scope: 'all' },
}

// The starting roster only. Once the app is running, the live roster lives
// in store state (state.staff) so it can actually be managed in-app — see
// useStaff() in state/store.jsx. Nothing outside seeding should read this
// array directly, or a newly hired/deactivated person won't be reflected.
export const SEED_STAFF = [
  { id: 'naledi', name: 'Naledi Mokoena', role: 'ops_manager', branchId: null, initials: 'NM' },
  { id: 'tumi', name: 'Tumi Radebe', role: 'stock_controller', branchId: 'WH', initials: 'TR' },
  { id: 'kabelo', name: 'Kabelo Sithole', role: 'branch_manager', branchId: 'SAN', initials: 'KS' },
  { id: 'amahle', name: 'Amahle Ndlovu', role: 'sales_associate', branchId: 'SAN', initials: 'AN' },
  { id: 'jordan', name: 'Jordan Pillay', role: 'sales_associate', branchId: 'SAN', initials: 'JP' },
  { id: 'chloe', name: 'Chloé van Wyk', role: 'branch_manager', branchId: 'CPT', initials: 'CW' },
  { id: 'lwazi', name: 'Lwazi Dlamini', role: 'sales_associate', branchId: 'CPT', initials: 'LD' },
  { id: 'megan', name: 'Megan Adams', role: 'sales_associate', branchId: 'CPT', initials: 'MA' },
  { id: 'sipho', name: 'Sipho Zulu', role: 'branch_manager', branchId: 'DBN', initials: 'SZ' },
  { id: 'precious', name: 'Precious Naidoo', role: 'sales_associate', branchId: 'DBN', initials: 'PN' },
  { id: 'ryan', name: 'Ryan Govender', role: 'sales_associate', branchId: 'DBN', initials: 'RG' },
]

export function branchName(id) {
  return BRANCHES.find((b) => b.id === id)?.name ?? id
}

// Who can actually be handed work at a given branch — the warehouse is run
// by its stock controller, a shop floor by its own manager and associates.
// Single source of truth for order assignment, task assignment and task
// reassignment alike, so "Durban work never lands on a Sandton person" is
// enforced the same way everywhere instead of three places that could drift.
// Takes the roster as an argument because the live one is store state now;
// useStaff() in state/store.jsx binds this to it for components.
export function assignableStaffFrom(staffList, branchId) {
  const active = staffList.filter((s) => s.active !== false)
  if (branchId === 'WH') return active.filter((s) => s.role === 'stock_controller')
  return active.filter((s) => s.branchId === branchId && (s.role === 'sales_associate' || s.role === 'branch_manager'))
}

// Initials for a newly added person — "Chloé van Wyk" → "CV", first and
// last word, so a two-letter avatar works the same as the seeded ones.
export function initialsFor(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : ''
  return (first + last).toUpperCase()
}
