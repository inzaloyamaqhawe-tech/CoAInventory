// Real, downloadable documents — an .xlsx workbook (SheetJS) or a
// letterhead-formatted .pdf (jsPDF + autotable), generated entirely in the
// browser. No print dialog in the way, no server round trip.

import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function exportExcel(filename, sheetName, headerRow, rows) {
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...rows])
  ws['!cols'] = headerRow.map((h, i) => {
    const longest = rows.reduce((max, r) => Math.max(max, String(r[i] ?? '').length), String(h).length)
    return { wch: Math.min(42, longest + 2) }
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)) // Excel's own sheet-name limit
  XLSX.writeFile(wb, filename)
}

// `sections`: one or more { heading?, headerRow, rows } tables stacked down
// the page, each with its own sub-heading — for a report that's genuinely
// more than one table (branch leaderboard + staff completion, say).
// Single-table callers can still pass `headerRow`/`rows` directly.
export function exportPDF({ title, subtitle, meta, headerRow, rows, sections, filename }) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const allSections = sections ?? [{ headerRow, rows }]

  // Brand + title/subtitle sit stacked at the top, then the rule — with
  // enough clearance below the subtitle's own descenders that it never
  // draws through the text (this used to cut a strikethrough right
  // across "All branches").
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('CHIEFS OF ANGELS', 14, 15)

  doc.setFontSize(17)
  doc.text(title, pageWidth - 14, 16, { align: 'right' })
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(subtitle, pageWidth - 14, 23, { align: 'right' })
  }

  const ruleY = subtitle ? 28 : 21
  doc.setDrawColor(20, 20, 20)
  doc.setLineWidth(0.6)
  doc.line(14, ruleY, pageWidth - 14, ruleY)

  let cursorY = ruleY + 8
  if (meta) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(90)
    doc.text(meta, 14, cursorY)
    doc.setTextColor(0)
    cursorY += 6
  }

  let totalRows = 0
  for (const section of allSections) {
    if (section.heading) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(0)
      doc.text(section.heading, 14, cursorY + 5)
      cursorY += 9
    }
    autoTable(doc, {
      head: [section.headerRow],
      body: section.rows,
      startY: cursorY,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [23, 20, 15], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 245, 240] },
      margin: { left: 14, right: 14 },
    })
    cursorY = doc.lastAutoTable.finalY + 12
    totalRows += section.rows.length
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(120)
  doc.text(`${totalRows} lines · Printed ${new Date().toLocaleString('en-ZA')}`, 14, cursorY)

  doc.save(filename)
}
