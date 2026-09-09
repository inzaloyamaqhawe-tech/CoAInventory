import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSession } from './state/session.jsx'
import { rolesFor } from './lib/nav'
import Layout from './components/Layout.jsx'
import SignIn from './pages/SignIn.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Products from './pages/Products.jsx'
import ProductDetail from './pages/ProductDetail.jsx'
import Stock from './pages/Stock.jsx'
import Transfers from './pages/Transfers.jsx'
import Team from './pages/Team.jsx'
import Orders from './pages/Orders.jsx'
import OrderDetail from './pages/OrderDetail.jsx'
import Branches from './pages/Branches.jsx'
import Alerts from './pages/Alerts.jsx'
import Reports from './pages/Reports.jsx'

// Enforces the same role list the nav is built from — a Sales Associate
// can't reach Alerts/Transfers/Products/Branches/Reports by typing the URL
// either, not just by never seeing the link.
function Guarded({ path, children }) {
  const { staff } = useSession()
  if (!rolesFor(path).includes(staff.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { staff } = useSession()

  if (!staff) return <SignIn />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/products"
          element={
            <Guarded path="/products">
              <Products />
            </Guarded>
          }
        />
        <Route
          path="/products/:sku"
          element={
            <Guarded path="/products">
              <ProductDetail />
            </Guarded>
          }
        />
        <Route path="/stock" element={<Stock />} />
        <Route
          path="/transfers"
          element={
            <Guarded path="/transfers">
              <Transfers />
            </Guarded>
          }
        />
        <Route path="/team" element={<Team />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route
          path="/branches"
          element={
            <Guarded path="/branches">
              <Branches />
            </Guarded>
          }
        />
        <Route
          path="/alerts"
          element={
            <Guarded path="/alerts">
              <Alerts />
            </Guarded>
          }
        />
        <Route
          path="/reports"
          element={
            <Guarded path="/reports">
              <Reports />
            </Guarded>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
