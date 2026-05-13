import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

type PdfCell = string | number | null | undefined

export type PdfColumn<T> = {
  header: string
  value: keyof T | ((row: T) => PdfCell)
}

type ExportTablePdfOptions<T> = {
  title: string
  subtitle?: string
  fileName: string
  columns: PdfColumn<T>[]
  rows: T[]
  summary?: string[]
}

function readValue<T>(row: T, column: PdfColumn<T>) {
  const rawValue = typeof column.value === "function" ? column.value(row) : row[column.value]
  return rawValue == null ? "" : String(rawValue)
}

export function formatEuro(value: number | string | null | undefined) {
  const numeric = Number(value || 0)
  return `${numeric.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

export function formatDateEs(value: string | null | undefined) {
  if (!value) return ""
  const normalized = value.includes("T") ? value.split("T")[0] : value
  const [year, month, day] = normalized.split("-")
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

export function exportTablePdf<T>({
  title,
  subtitle,
  fileName,
  columns,
  rows,
  summary = [],
}: ExportTablePdfOptions<T>) {
  const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait" })
  const generatedAt = new Date().toLocaleString("es-ES")

  doc.setFontSize(16)
  doc.setTextColor(15, 23, 42)
  doc.text(title, 14, 18)

  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(`Generado: ${generatedAt}`, 14, 25)

  let startY = 31

  if (subtitle) {
    doc.setFontSize(10)
    doc.setTextColor(51, 65, 85)
    doc.text(subtitle, 14, startY)
    startY += 6
  }

  if (summary.length > 0) {
    doc.setFontSize(10)
    doc.setTextColor(51, 65, 85)
    summary.forEach((line) => {
      doc.text(line, 14, startY)
      startY += 5
    })
    startY += 2
  }

  autoTable(doc, {
    startY,
    head: [columns.map((column) => column.header)],
    body: rows.map((row) => columns.map((column) => readValue(row, column))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  })

  doc.save(fileName)
}
