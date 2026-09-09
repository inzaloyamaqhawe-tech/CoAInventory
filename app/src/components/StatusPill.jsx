import React from 'react'

// One shared vocabulary for every status word in the app — a pill's colour
// always means the same severity tier everywhere it appears.
const MAP = {
  // task / order / transfer states
  done: 'ok', fulfilled: 'ok', received: 'ok',
  pending: 'muted', new: 'muted', requested: 'suggest', suggested: 'suggest',
  overdue: 'critical', out_of_stock: 'critical', low_stock: 'critical', critical: 'critical',
  ready: 'suggest', packed: 'suggest', approved: 'suggest', in_transit: 'warn',
  warning: 'warn', demand_spike: 'warn',
  info: 'ok', overstock: 'ok',
}

const TEXT = {
  low_stock: 'Low stock', out_of_stock: 'Out of stock', overstock: 'Overstock',
  demand_spike: 'Demand spike', in_transit: 'In transit', out_of: 'Out',
}

export default function StatusPill({ status, children }) {
  const tone = MAP[status] || 'muted'
  const text = children ?? TEXT[status] ?? status.replace(/_/g, ' ')
  return <span className={`pill pill-${tone}`}>{text}</span>
}
