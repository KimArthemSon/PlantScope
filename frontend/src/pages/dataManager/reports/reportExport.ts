import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getPdfLogos } from "@/utils/pdfLogos";

type Cell = string | number | null | undefined;

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => Cell;
}

export interface ExportSection {
  title: string;
  columns: string[];
  rows: Cell[][];
}

export interface ExportSpec<T> {
  title: string;
  filename: string;
  /** [label, value] pairs describing the active filters */
  filters: [string, string][];
  /** [label, value] pairs shown as the summary block */
  summary: [string, string][];
  columns: ExportColumn<T>[];
  rows: T[];
  /** Extra tables printed before the main records table */
  sections?: ExportSection[];
  recordsTitle?: string;
}

const GREEN: [number, number, number] = [15, 74, 47];
const LIGHT: [number, number, number] = [240, 253, 244];

const text = (v: Cell) => (v === null || v === undefined || v === "" ? "—" : String(v));

function stamp() {
  return new Date().toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function datePart() {
  return new Date().toISOString().split("T")[0];
}

function lastY(doc: jsPDF) {
  return (doc as any).lastAutoTable?.finalY ?? 40;
}

function sectionTitle(doc: jsPDF, title: string, y: number) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 30) {
    doc.addPage();
    y = 18;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GREEN);
  doc.text(title, 14, y);
  return y + 3;
}

function addLogo(doc: jsPDF, data: string | null, x: number, y: number, size: number) {
  if (!data) return;
  try {
    doc.addImage(data, "PNG", x, y, size, size);
  } catch {
    /* logos are decorative; keep exporting without them */
  }
}

export async function exportPdf<T>(spec: ExportSpec<T>) {
  const logos = await getPdfLogos();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const centerX = pageW / 2;

  // ── Letterhead: ENRO logo left, PlantScope logo right, title centred ──
  const logoSize = 22;
  addLogo(doc, logos.enro, 14, 7, logoSize);
  addLogo(doc, logos.plantscope, pageW - 14 - logoSize, 7, logoSize);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text("City Environment & Natural Resources Office · Ormoc City", centerX, 11, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...GREEN);
  doc.text(spec.title, centerX, 19.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  doc.text(`PlantScope Reforestation Monitoring System  ·  Generated ${stamp()}`, centerX, 25.5, {
    align: "center",
  });

  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.8);
  doc.line(14, 32, pageW - 14, 32);
  doc.setLineWidth(0.2);

  // ── Filters ──
  let y = 39;
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  const filterLine =
    spec.filters.length > 0
      ? spec.filters.map(([k, v]) => `${k}: ${v}`).join("   ·   ")
      : "No filters (all records)";
  const wrapped = doc.splitTextToSize(`Filters — ${filterLine}`, pageW - 28);
  doc.text(wrapped, 14, y);
  y += wrapped.length * 4.5 + 2;

  // ── Summary grid (4 pairs per row) ──
  if (spec.summary.length > 0) {
    y = sectionTitle(doc, "Summary", y + 2);
    const body: string[][] = [];
    for (let i = 0; i < spec.summary.length; i += 4) {
      const row: string[] = [];
      spec.summary.slice(i, i + 4).forEach(([k, v]) => row.push(k, v));
      while (row.length < 8) row.push("");
      body.push(row);
    }
    autoTable(doc, {
      startY: y,
      body,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 2.2, lineColor: [229, 231, 235] },
      columnStyles: Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [
          i,
          i % 2 === 0
            ? { textColor: [107, 114, 128], fillColor: [249, 250, 251] }
            : { fontStyle: "bold", textColor: [31, 41, 55] },
        ]),
      ),
      margin: { left: 14, right: 14 },
    });
    y = lastY(doc) + 8;
  }

  // ── Extra sections ──
  for (const section of spec.sections ?? []) {
    if (section.rows.length === 0) continue;
    y = sectionTitle(doc, section.title, y);
    autoTable(doc, {
      startY: y,
      head: [section.columns],
      body: section.rows.map((r) => r.map(text)),
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: LIGHT },
      margin: { left: 14, right: 14 },
    });
    y = lastY(doc) + 8;
  }

  // ── Records ──
  y = sectionTitle(doc, `${spec.recordsTitle ?? "Records"} (${spec.rows.length})`, y);
  autoTable(doc, {
    startY: y,
    head: [spec.columns.map((c) => c.header)],
    body:
      spec.rows.length > 0
        ? spec.rows.map((r) => spec.columns.map((c) => text(c.value(r))))
        : [[{ content: "No records match the selected filters.", colSpan: spec.columns.length }]],
    styles: { fontSize: 7.5, cellPadding: 1.6, overflow: "linebreak" },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: LIGHT },
    margin: { left: 14, right: 14, bottom: 16 },
  });

  // ── Footer on every page: both logos, report name, page number ──
  const pages = doc.getNumberOfPages();
  const footLogo = 7;
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(229, 231, 235);
    doc.line(14, pageH - 12, pageW - 14, pageH - 12);
    addLogo(doc, logos.enro, 14, pageH - 10.5, footLogo);
    addLogo(doc, logos.plantscope, 14 + footLogo + 1.5, pageH - 10.5, footLogo);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(`CENRO Ormoc · PlantScope · ${spec.title}`, 14 + footLogo * 2 + 4, pageH - 5.8);
    doc.text(`Page ${i} of ${pages}`, pageW - 14, pageH - 5.8, { align: "right" });
  }

  doc.save(`${spec.filename}_${datePart()}.pdf`);
}

const csvCell = (v: Cell) => `"${text(v).replace(/"/g, '""')}"`;

/** CSV that opens cleanly in Excel (UTF-8 BOM), with the filters and summary on top. */
export function exportCsv<T>(spec: ExportSpec<T>) {
  const lines: string[] = [];
  lines.push(csvCell(spec.title));
  lines.push(csvCell(`Generated ${stamp()}`));
  spec.filters.forEach(([k, v]) => lines.push([csvCell(k), csvCell(v)].join(",")));
  lines.push("");
  spec.summary.forEach(([k, v]) => lines.push([csvCell(k), csvCell(v)].join(",")));
  lines.push("");
  lines.push(spec.columns.map((c) => csvCell(c.header)).join(","));
  spec.rows.forEach((r) => lines.push(spec.columns.map((c) => csvCell(c.value(r))).join(",")));

  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${spec.filename}_${datePart()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
