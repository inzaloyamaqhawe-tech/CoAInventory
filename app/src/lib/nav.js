// Single source of truth for "who can see this page" — used both to build
// the nav (Layout.jsx) and to actually gate the route (App.jsx), so a role
// restriction isn't just a hidden button, matching 00-DESIGN-PRINCIPLES.md's
// "role reshapes the whole app, not just permissions."
export const NAV = [
  { path: '/', label: 'Dashboard', icon: 'home', roles: ['ops_manager', 'stock_controller', 'branch_manager', 'sales_associate'] },
  { path: '/stock', label: 'Stock', icon: 'layers', roles: ['ops_manager', 'stock_controller', 'branch_manager', 'sales_associate'] },
  { path: '/transfers', label: 'Transfers', icon: 'swap', roles: ['ops_manager', 'stock_controller', 'branch_manager'] },
  { path: '/team', label: 'Team', altLabel: { sales_associate: 'Tasks' }, icon: 'users', roles: ['ops_manager', 'branch_manager', 'sales_associate'] },
  { path: '/orders', label: 'Orders', icon: 'receipt', roles: ['ops_manager', 'branch_manager', 'sales_associate'] },
  { path: '/products', label: 'Products', icon: 'box', roles: ['ops_manager', 'stock_controller'] },
  { path: '/branches', label: 'Branches', icon: 'store', roles: ['ops_manager', 'stock_controller'] },
  { path: '/alerts', label: 'Alerts', icon: 'bell', roles: ['ops_manager', 'stock_controller', 'branch_manager'] },
  { path: '/reports', label: 'Reports', icon: 'chart', roles: ['ops_manager', 'stock_controller', 'branch_manager'] },
]

export function rolesFor(path) {
  return NAV.find((n) => n.path === path)?.roles ?? []
}
