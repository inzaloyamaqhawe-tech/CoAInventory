// Real, downloadable documents — an .xlsx workbook (SheetJS) or a
// letterhead-formatted .pdf (jsPDF + autotable), generated entirely in the
// browser. No print dialog in the way, no server round trip.

import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
// A print-sized copy, not the full-resolution nav asset — jsPDF embeds
// whatever pixel data it's handed at full size regardless of how small it's
// drawn on the page, and the nav-resolution PNG was bloating every export
// to several megabytes for a 30mm-wide header mark.
import logoBlack from '../assets/logo-mark-print.png'

// jsPDF's addImage() needs actual pixel data (a data URI), not a URL — and
// Vite serves this asset from a hashed /assets/ path rather than inlining
// it, so it has to be fetched once and converted. Cached after the first
// export since it's the same letterhead mark every time and every PDF
// export would otherwise re-fetch it.
let logoDataUrlPromise = null
function getLogoDataUrl() {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch(logoBlack)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
      )
      .catch(() => null) // a PDF without the letterhead mark still beats one that silently never downloads
  }
  return logoDataUrlPromise
}

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
export async function exportPDF({ title, subtitle, meta, headerRow, rows, sections, filename }) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const allSections = sections ?? [{ headerRow, rows }]

  // The real logo on every printed document, same as Bolide WMS does it —
  // sized to sit comfortably above the rule with room to spare, so the
  // existing ruleY math (set for a single line of "CHIEFS OF ANGELS" text)
  // never needs to change to fit it.
  const logoDataUrl = await getLogoDataUrl()
  if (logoDataUrl) {
    const logoW = 30
    const logoH = logoW * (456 / 1382) // the mark's actual aspect ratio
    doc.addImage(logoDataUrl, 'PNG', 14, 8, logoW, logoH)
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('CHIEFS OF ANGELS', 14, 15)
  }

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
