import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FileText, Download, X, Loader2 } from "lucide-react";
import type { SiteDetail } from "../hooks/useSites";

interface SiteReportModalProps {
  site: SiteDetail;
  areaName?: string | null;
  barangayName?: string | null;
  onClose: () => void;
}

// Project [lat, lng] onto a local plane (equirectangular, metres-ish) and fit
// it into a box, keeping aspect ratio. Returns points in box coordinates.
const fitPolygon = (
  coords: [number, number][],
  width: number,
  height: number,
  padding: number,
): [number, number][] => {
  if (coords.length === 0) return [];
  const lat0 = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const pts = coords.map(([lat, lng]) => [lng * k, lat] as [number, number]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;
  const scale = Math.min(
    (width - padding * 2) / spanX,
    (height - padding * 2) / spanY,
  );
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  // y is flipped so north is up
  return pts.map(([x, y]) => [
    offX + (x - minX) * scale,
    offY + (maxY - y) * scale,
  ]);
};

const formatStatus = (status: string) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1) : "—";

export default function SiteReportModal({
  site,
  areaName,
  barangayName,
  onClose,
}: SiteReportModalProps) {
  const [isExporting, setIsExporting] = useState(false);

  const coords = site.polygon_coordinates ?? [];
  const generatedAt = useMemo(() => new Date(), []);
  const reference = `SITE-${generatedAt.getFullYear()}-${String(
    site.site_id,
  ).padStart(4, "0")}`;
  const area = Number(site.area_hectares || 0).toFixed(2);
  const dateLabel = generatedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const PREVIEW_W = 420;
  const PREVIEW_H = 340;
  const previewPts = useMemo(
    () => fitPolygon(coords, PREVIEW_W, PREVIEW_H, 30),
    [coords],
  );

  const handleExportPdf = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      const rightX = 196;
      const rightW = pageW - margin - rightX;

      // Page border
      doc.setDrawColor(200);
      doc.setLineWidth(0.3);
      doc.rect(8, 8, pageW - 16, pageH - 16);

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(23, 32, 51);
      doc.text("Site Survey Report", pageW / 2, 24, { align: "center" });

      // Site name & reference boxes
      doc.setDrawColor(160);
      doc.rect(margin, 32, rightX - margin - 6, 11);
      doc.rect(rightX, 32, rightW, 11);
      doc.setFontSize(11);
      doc.text("Site Name:", margin + 4, 39.2);
      doc.setFont("helvetica", "normal");
      doc.text(site.name, margin + 27, 39.2);
      doc.setFont("helvetica", "bold");
      doc.text(`Ref: ${reference}`, rightX + 4, 39.2);

      // Polygon visual
      const boxX = margin;
      const boxY = 56;
      const boxW = rightX - margin - 6;
      const boxH = pageH - boxY - 34;
      doc.setFontSize(12);
      doc.text("Polygon Visual", boxX + boxW / 2, 52, { align: "center" });

      if (coords.length >= 3) {
        const pts = fitPolygon(coords, boxW, boxH, 10).map(
          ([x, y]) => [boxX + x, boxY + y] as [number, number],
        );
        const deltas = pts
          .slice(1)
          .map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
        doc.setFillColor(187, 228, 196);
        doc.setDrawColor(27, 110, 52);
        doc.setLineWidth(0.9);
        doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], "FD", true);

        // Numbered vertices
        doc.setFontSize(7);
        pts.forEach(([x, y], i) => {
          doc.setFillColor(27, 110, 52);
          doc.circle(x, y, 2.2, "F");
          doc.setTextColor(255, 255, 255);
          doc.text(String(i + 1), x, y + 0.9, { align: "center" });
        });
        doc.setTextColor(23, 32, 51);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text("No polygon recorded for this site.", boxX + boxW / 2, boxY + boxH / 2, {
          align: "center",
        });
      }

      // Summary line under the visual
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(80);
      const summary = [
        `Area: ${area} ha`,
        `Status: ${formatStatus(site.status)}`,
        areaName ? `Reforestation Area: ${areaName}` : null,
        barangayName ? `Barangay: ${barangayName}` : null,
      ]
        .filter(Boolean)
        .join("   •   ");
      doc.text(summary, boxX + boxW / 2, pageH - 24, { align: "center" });
      if (site.marker_coordinate) {
        doc.text(
          `Center: ${site.marker_coordinate[0].toFixed(6)}, ${site.marker_coordinate[1].toFixed(6)}`,
          boxX + boxW / 2,
          pageH - 19,
          { align: "center" },
        );
      }
      doc.text(`Generated ${dateLabel}`, margin, pageH - 12);

      // Coordinates table
      autoTable(doc, {
        startY: 50,
        margin: { left: rightX, right: margin, top: 16, bottom: 16 },
        tableWidth: rightW,
        head: [
          [{ content: "Coordinates", colSpan: 3, styles: { halign: "center" } }],
          ["#", "Latitude", "Longitude"],
        ],
        body: coords.map((c, i) => [
          String(i + 1),
          c[0].toFixed(6),
          c[1].toFixed(6),
        ]),
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 2.4, lineColor: 170, lineWidth: 0.2 },
        headStyles: { fillColor: [168, 212, 239], textColor: [23, 32, 51], fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { halign: "center" },
          2: { halign: "center" },
        },
      });

      const safeName = site.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
      doc.save(`${reference}_${safeName || "site"}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-green-700 to-green-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Site Report Preview</h2>
              <p className="text-xs text-white/80">
                {site.name} • {coords.length} vertices
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Report preview */}
        <div className="flex-1 overflow-auto p-6 bg-gray-100">
          <div className="bg-white border border-gray-300 shadow-sm mx-auto p-8 min-w-[760px]">
            <h1 className="text-3xl font-bold text-slate-900 text-center mb-6">
              Site Survey Report
            </h1>

            <div className="grid grid-cols-[2fr_1fr] gap-6 mb-6">
              <div className="border border-gray-300 px-4 py-2.5 text-sm text-slate-900">
                <span className="font-bold">Site Name:</span> {site.name}
              </div>
              <div className="border border-gray-300 px-4 py-2.5 text-sm font-bold text-slate-900">
                Ref: {reference}
              </div>
            </div>

            <div className="grid grid-cols-[2fr_1fr] gap-6 items-start">
              <div className="flex flex-col items-center">
                <h3 className="font-bold text-slate-900 mb-2">Polygon Visual</h3>
                {coords.length >= 3 ? (
                  <svg
                    viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
                    className="w-full max-w-[460px]"
                  >
                    <polygon
                      points={previewPts.map((p) => p.join(",")).join(" ")}
                      fill="#bbe4c4"
                      stroke="#1b6e34"
                      strokeWidth={3}
                      strokeLinejoin="round"
                    />
                    {previewPts.map(([x, y], i) => (
                      <g key={i}>
                        <circle cx={x} cy={y} r={9} fill="#1b6e34" />
                        <text
                          x={x}
                          y={y + 3.5}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight={700}
                          fill="#fff"
                        >
                          {i + 1}
                        </text>
                      </g>
                    ))}
                  </svg>
                ) : (
                  <div className="h-64 w-full flex items-center justify-center text-sm text-gray-500 border border-dashed border-gray-300">
                    No polygon recorded for this site.
                  </div>
                )}
                <p className="mt-3 text-xs text-gray-600 text-center">
                  Area: {area} ha • Status: {formatStatus(site.status)}
                  {areaName && <> • Reforestation Area: {areaName}</>}
                  {barangayName && <> • Barangay: {barangayName}</>}
                </p>
                {site.marker_coordinate && (
                  <p className="text-xs text-gray-600 font-mono">
                    Center: {site.marker_coordinate[0].toFixed(6)},{" "}
                    {site.marker_coordinate[1].toFixed(6)}
                  </p>
                )}
              </div>

              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th
                      colSpan={3}
                      className="bg-sky-200 border border-gray-300 py-2 font-bold text-slate-900"
                    >
                      Coordinates
                    </th>
                  </tr>
                  <tr className="bg-sky-100 text-xs text-slate-700">
                    <th className="border border-gray-300 py-1 w-10">#</th>
                    <th className="border border-gray-300 py-1">Latitude</th>
                    <th className="border border-gray-300 py-1">Longitude</th>
                  </tr>
                </thead>
                <tbody>
                  {coords.map((c, i) => (
                    <tr key={i}>
                      <td className="border border-gray-300 py-2 text-center">
                        {i + 1}
                      </td>
                      <td className="border border-gray-300 py-2 text-center font-mono">
                        {c[0].toFixed(6)}
                      </td>
                      <td className="border border-gray-300 py-2 text-center font-mono">
                        {c[1].toFixed(6)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-6 text-[11px] text-gray-500">Generated {dateLabel}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-2 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg border border-gray-300"
          >
            Close
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Export as PDF
          </button>
        </div>
      </div>
    </div>
  );
}
