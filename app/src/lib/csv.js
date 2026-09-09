// Client-side CSV export — the "report export" every WMS/ERP table has
// (Bolide's own tables ship an xlsx export the same way). No server round
// trip: builds the file in the browser and hands it to the user directly.
function cell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function downloadCSV(filename, headerRow, rows) {
  const lines = [headerRow, ...rows].map((row) => row.map(cell).join(','))
  const csv = lines.join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
