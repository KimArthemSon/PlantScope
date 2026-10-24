import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FileText, Download, X, Loader2 } from "lucide-react";
import type { SiteDetail } from "../hooks/useSites";
import plantscopeLogoSrc from "../../../../assets/logo2.png";
import enroLogoSrc from "../../../../assets/enro_logo.png";

interface SiteReportModalProps {
  site: SiteDetail;
  areaName?: string | null;
  barangayName?: string | null;
  onClose: () => void;
}

// Brand colours (kept in one place so preview and PDF match)
const BRAND = { r: 22, g: 101, b: 52 }; // #166534
const BRAND_HEX = "#166534";
const BRAND_LIGHT = { r: 236, g: 247, b: 239 }; // #ecf7ef
const INK = { r: 23, g: 32, b: 51 };
const METERS_PER_DEG = 111320;

// ── Geometry helpers ─────────────────────────────────────────────

// Project [lat, lng] onto a local plane and fit it into a box, keeping
// aspect ratio. Also returns a scale bar sized for that box.
const buildMap = (
  coords: [number, number][],
  width: number,
  height: number,
  padding: number,
) => {
  if (coords.length === 0) return { pts: [] as [number, number][], bar: null };
  const lat0 = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const raw = coords.map(([lat, lng]) => [lng * k, lat] as [number, number]);
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxY = Math.max(...ys);
  const spanX = Math.max(...xs) - minX || 1e-9;
  const spanY = maxY - Math.min(...ys) || 1e-9;
  const scale = Math.min(
    (width - padding * 2) / spanX,
    (height - padding * 2) / spanY,
  );
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  // y is flipped so north is up
  const pts = raw.map(
    ([x, y]) =>
      [offX + (x - minX) * scale, offY + (maxY - y) * scale] as [number, number],
  );

  // Scale bar: a "nice" round distance about a quarter of the box width
  const metersPerUnit = METERS_PER_DEG / scale;
  const target = width * 0.22 * metersPerUnit;
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  const nice = [5, 2, 1].map((m) => m * pow).find((v) => v <= target) ?? pow;
  const bar = {
    length: nice / metersPerUnit,
    label: nice >= 1000 ? `${nice / 1000} km` : `${nice} m`,
  };
  return { pts, bar };
};

const perimeterMeters = (coords: [number, number][]) => {
  if (coords.length < 2) return 0;
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 0; i < coords.length; i++) {
    const [lat1, lng1] = coords[i];
    const [lat2, lng2] = coords[(i + 1) % coords.length];
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(a));
  }
  return total;
};

const toDms = (value: number, pos: string, neg: string) => {
  const hemi = value >= 0 ? pos : neg;
  const abs = Math.abs(value);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = (mFloat - m) * 60;
  return `${d}° ${String(m).padStart(2, "0")}' ${s.toFixed(2).padStart(5, "0")}" ${hemi}`;
};

const formatStatus = (status: string) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1) : "—";

// Load an image and trim its white margins so logos sit tight in the header.
const loadTrimmedLogo = (src: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(src);
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let minX = width, minY = height, maxX = -1, maxY = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const isInk =
            data[i + 3] > 20 &&
            (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235);
          if (isInk) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return resolve(src);
      // Square crop around the content with a small margin
      const size = Math.max(maxX - minX, maxY - minY) * 1.04;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const out = document.createElement("canvas");
      out.width = out.height = 400;
      const octx = out.getContext("2d");
      if (!octx) return resolve(src);
      octx.fillStyle = "#ffffff";
      octx.fillRect(0, 0, 400, 400);
      octx.drawImage(img, cx - size / 2, cy - size / 2, size, size, 0, 0, 400, 400);
      resolve(out.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });

// ── Component ────────────────────────────────────────────────────

export default function SiteReportModal({
  site,
  areaName,
  barangayName,
  onClose,
}: SiteReportModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [logos, setLogos] = useState<{ plantscope: string; enro: string }>({
    plantscope: plantscopeLogoSrc,
    enro: enroLogoSrc,
  });
  const [logosReady, setLogosReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadTrimmedLogo(plantscopeLogoSrc), loadTrimmedLogo(enroLogoSrc)])
      .then(([plantscope, enro]) => {
        if (!cancelled) setLogos({ plantscope, enro });
      })
      .catch(() => {})
      .finally(() => !cancelled && setLogosReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const coords = site.polygon_coordinates ?? [];
  const species = [...(site.species_recommendations ?? [])].sort(
    (a, b) => a.rank - b.rank,
  );
  const generatedAt = useMemo(() => new Date(), []);
  const reference = `SITE-${generatedAt.getFullYear()}-${String(site.site_id).padStart(4, "0")}`;
  const area = Number(site.area_hectares || 0).toFixed(2);
  const perimeter = perimeterMeters(coords);
  const perimeterLabel =
    perimeter >= 1000 ? `${(perimeter / 1000).toFixed(2)} km` : `${perimeter.toFixed(1)} m`;
  const dateLabel = generatedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeLabel = generatedAt.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const centerLabel = site.marker_coordinate
    ? `${site.marker_coordinate[0].toFixed(6)}, ${site.marker_coordinate[1].toFixed(6)}`
    : "—";

  const infoRows: [string, string, string, string][] = [
    ["Site Name", site.name, "Reference No.", reference],
    ["Reforestation Area", areaName || "—", "Barangay", barangayName || "—"],
    ["Total Area", `${area} hectares`, "Perimeter", coords.length >= 3 ? perimeterLabel : "—"],
    ["Status", formatStatus(site.status), "No. of Vertices", String(coords.length)],
    ["Center Point", centerLabel, "Date Generated", `${dateLabel}, ${timeLabel}`],
  ];

  const PREVIEW_W = 640;
  const PREVIEW_H = 320;
  const previewMap = useMemo(
    () => buildMap(coords, PREVIEW_W, PREVIEW_H, 40),
    [coords],
  );

  // ── PDF export ────────────────────────────────────────────────
  const handleExportPdf = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 16;
      const contentW = pageW - margin * 2;
      const footerTop = pageH - 16;
      const setInk = () => doc.setTextColor(INK.r, INK.g, INK.b);
      const lastY = () => (doc as any).lastAutoTable.finalY as number;

      // Letterhead
      const logoSize = 24;
      try {
        doc.addImage(logos.enro, "PNG", margin, 11, logoSize, logoSize);
        doc.addImage(logos.plantscope, "PNG", pageW - margin - logoSize, 11, logoSize, logoSize);
      } catch {
        /* logos are decorative; continue without them */
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      setInk();
      doc.text("Republic of the Philippines", pageW / 2, 16, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("CITY GOVERNMENT OF ORMOC", pageW / 2, 21, { align: "center" });
      doc.setFontSize(11.5);
      doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
      doc.text("CITY ENVIRONMENT AND NATURAL RESOURCES OFFICE", pageW / 2, 27, {
        align: "center",
      });
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(9);
      doc.text("PLANTSCOPE", pageW / 2, 32.5, { align: "center" });
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(100);
      doc.text("Reforestation Site Planning & Monitoring System", pageW / 2, 36.2, {
        align: "center",
      });

      doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
      doc.setLineWidth(0.9);
      doc.line(margin, 40, pageW - margin, 40);
      doc.setLineWidth(0.25);
      doc.line(margin, 41.3, pageW - margin, 41.3);

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      setInk();
      doc.text("SITE SURVEY REPORT", pageW / 2, 51, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100);
      doc.text("Reforestation Site Boundary & Assessment Summary", pageW / 2, 56, {
        align: "center",
      });

      let y = 64;
      const ensureSpace = (needed: number) => {
        if (y + needed > footerTop - 4) {
          doc.addPage();
          y = 20;
        }
      };
      const sectionHeader = (title: string) => {
        ensureSpace(14);
        doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
        doc.rect(margin, y - 4, 1.4, 5.2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
        doc.text(title, margin + 3.5, y);
        y += 4;
      };

      // I. Site information
      sectionHeader("I. SITE INFORMATION");
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin, top: 20, bottom: 22 },
        body: infoRows,
        theme: "grid",
        styles: {
          fontSize: 8.5,
          cellPadding: 2.4,
          lineColor: [205, 214, 208],
          lineWidth: 0.2,
          textColor: [INK.r, INK.g, INK.b],
          valign: "middle",
        },
        columnStyles: {
          0: { cellWidth: 32, fontStyle: "bold", fillColor: [BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b] },
          1: { cellWidth: contentW / 2 - 32 },
          2: { cellWidth: 32, fontStyle: "bold", fillColor: [BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b] },
          3: { cellWidth: contentW / 2 - 32 },
        },
      });
      y = lastY() + 10;

      // II. Boundary map
      const mapH = 88;
      sectionHeader("II. SITE BOUNDARY MAP");
      ensureSpace(mapH + 4);
      const boxX = margin;
      const boxY = y;
      doc.setFillColor(249, 251, 249);
      doc.setDrawColor(190, 200, 194);
      doc.setLineWidth(0.3);
      doc.rect(boxX, boxY, contentW, mapH, "FD");
      // light grid
      doc.setDrawColor(232, 238, 234);
      doc.setLineWidth(0.15);
      for (let gx = boxX + 10; gx < boxX + contentW; gx += 10) doc.line(gx, boxY, gx, boxY + mapH);
      for (let gy = boxY + 10; gy < boxY + mapH; gy += 10) doc.line(boxX, gy, boxX + contentW, gy);

      if (coords.length >= 3) {
        const { pts: local, bar } = buildMap(coords, contentW, mapH, 14);
        const pts = local.map(([px, py]) => [boxX + px, boxY + py] as [number, number]);
        const deltas = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
        doc.setFillColor(187, 228, 196);
        doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
        doc.setLineWidth(0.7);
        doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], "FD", true);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        pts.forEach(([px, py], i) => {
          doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.4);
          doc.circle(px, py, 2.3, "FD");
          doc.setTextColor(255, 255, 255);
          doc.text(String(i + 1), px, py + 0.85, { align: "center" });
        });

        // Scale bar
        if (bar) {
          const sx = boxX + 6;
          const sy = boxY + mapH - 6;
          doc.setDrawColor(INK.r, INK.g, INK.b);
          doc.setFillColor(INK.r, INK.g, INK.b);
          doc.setLineWidth(0.3);
          doc.rect(sx, sy - 1, bar.length / 2, 1.2, "FD");
          doc.setFillColor(255, 255, 255);
          doc.rect(sx + bar.length / 2, sy - 1, bar.length / 2, 1.2, "FD");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          setInk();
          doc.text("0", sx, sy - 2.2, { align: "center" });
          doc.text(bar.label, sx + bar.length, sy - 2.2, { align: "center" });
        }
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text("No polygon recorded for this site.", boxX + contentW / 2, boxY + mapH / 2, {
          align: "center",
        });
      }

      // North arrow
      const nx = boxX + contentW - 9;
      const ny = boxY + 6;
      doc.setFillColor(INK.r, INK.g, INK.b);
      doc.triangle(nx, ny, nx - 2.6, ny + 7, nx, ny + 5.4, "F");
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(INK.r, INK.g, INK.b);
      doc.setLineWidth(0.25);
      doc.triangle(nx, ny, nx + 2.6, ny + 7, nx, ny + 5.4, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      setInk();
      doc.text("N", nx, ny + 11, { align: "center" });

      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(110);
      doc.text(
        "Schematic representation, north-up. Coordinates referenced to WGS 84.",
        boxX,
        boxY + mapH + 4,
      );
      y = boxY + mapH + 12;

      // III. Coordinates
      sectionHeader("III. BOUNDARY COORDINATES (WGS 84)");
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin, top: 20, bottom: 22 },
        head: [["Point", "Latitude", "Longitude", "Latitude (DMS)", "Longitude (DMS)"]],
        body: coords.length
          ? coords.map((c, i) => [
              String(i + 1),
              c[0].toFixed(6),
              c[1].toFixed(6),
              toDms(c[0], "N", "S"),
              toDms(c[1], "E", "W"),
            ])
          : [[{ content: "No coordinates recorded.", colSpan: 5, styles: { halign: "center", fontStyle: "italic" } }]],
        theme: "grid",
        styles: {
          fontSize: 8.5,
          cellPadding: 2.2,
          halign: "center",
          lineColor: [205, 214, 208],
          lineWidth: 0.2,
          textColor: [INK.r, INK.g, INK.b],
        },
        headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [247, 250, 248] },
        columnStyles: { 0: { cellWidth: 16 } },
      });
      y = lastY() + 10;

      // IV. Species (only when available)
      if (species.length) {
        sectionHeader("IV. RECOMMENDED SPECIES");
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin, top: 20, bottom: 22 },
          head: [["Rank", "Species", "Notes"]],
          body: species.map((s) => [String(s.rank), s.name, s.notes || "—"]),
          theme: "grid",
          styles: {
            fontSize: 8.5,
            cellPadding: 2.2,
            lineColor: [205, 214, 208],
            lineWidth: 0.2,
            textColor: [INK.r, INK.g, INK.b],
          },
          headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [247, 250, 248] },
          columnStyles: { 0: { cellWidth: 16, halign: "center" }, 1: { cellWidth: 55 } },
        });
        y = lastY() + 10;
      }

      // Footer on every page
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
        doc.setLineWidth(0.4);
        doc.line(margin, footerTop, pageW - margin, footerTop);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(110);
        doc.text(
          "PlantScope  •  City Environment and Natural Resources Office, Ormoc City",
          margin,
          footerTop + 4.5,
        );
        doc.text(`${reference}  •  Page ${p} of ${pageCount}`, pageW - margin, footerTop + 4.5, {
          align: "right",
        });
        doc.setFont("helvetica", "italic");
        doc.text(
          `System-generated report • ${dateLabel}, ${timeLabel}`,
          margin,
          footerTop + 8.5,
        );
      }

      const safeName = site.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
      doc.save(`${reference}_${safeName || "site"}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  // ── Preview ───────────────────────────────────────────────────
  const SectionTitle = ({ children }: { children: string }) => (
    <h3 className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-green-800 mb-2">
      <span className="inline-block w-1 h-4 bg-green-800" />
      {children}
    </h3>
  );

  const bar = previewMap.bar;

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
                {site.name} • {reference} • {coords.length} vertices
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

        {/* Report preview (A4 portrait proportions) */}
        <div className="flex-1 overflow-auto p-6 bg-gray-200">
          <div className="bg-white shadow-lg mx-auto w-[794px] min-h-[1123px] px-14 pt-10 pb-8 flex flex-col text-slate-900">
            {/* Letterhead */}
            <div className="flex items-center justify-between gap-4">
              <img src={logos.enro} alt="City ENRO Ormoc" className="w-[88px] h-[88px] object-contain" />
              <div className="text-center leading-tight">
                <p className="text-[12px]">Republic of the Philippines</p>
                <p className="text-[13px] font-bold">CITY GOVERNMENT OF ORMOC</p>
                <p className="text-[15px] font-bold mt-0.5" style={{ color: BRAND_HEX }}>
                  CITY ENVIRONMENT AND NATURAL RESOURCES OFFICE
                </p>
                <p className="text-[12px] font-bold italic mt-1" style={{ color: BRAND_HEX }}>
                  PLANTSCOPE
                </p>
                <p className="text-[10px] italic text-gray-500">
                  Reforestation Site Planning &amp; Monitoring System
                </p>
              </div>
              <img src={logos.plantscope} alt="PlantScope" className="w-[88px] h-[88px] object-contain" />
            </div>
            <div className="mt-3 border-t-[3px] border-green-800" />
            <div className="mt-[3px] border-t border-green-800" />

            {/* Title */}
            <div className="text-center mt-6 mb-6">
              <h1 className="text-2xl font-bold tracking-wide">SITE SURVEY REPORT</h1>
              <p className="text-xs text-gray-500 mt-1">
                Reforestation Site Boundary &amp; Assessment Summary
              </p>
            </div>

            {/* I. Site information */}
            <SectionTitle>I. SITE INFORMATION</SectionTitle>
            <table className="w-full border-collapse text-[12px] mb-7">
              <tbody>
                {infoRows.map((row, i) => (
                  <tr key={i}>
                    <th className="w-[120px] text-left font-bold bg-[#ecf7ef] border border-[#cdd6d0] px-3 py-2">
                      {row[0]}
                    </th>
                    <td className="border border-[#cdd6d0] px-3 py-2">{row[1]}</td>
                    <th className="w-[120px] text-left font-bold bg-[#ecf7ef] border border-[#cdd6d0] px-3 py-2">
                      {row[2]}
                    </th>
                    <td className="border border-[#cdd6d0] px-3 py-2">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* II. Map */}
            <SectionTitle>II. SITE BOUNDARY MAP</SectionTitle>
            <div className="relative border border-[#bec8c2] bg-[#f9fbf9]">
              <svg viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`} className="w-full block">
                <defs>
                  <pattern id="report-grid" width="36" height="36" patternUnits="userSpaceOnUse">
                    <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#e8eeea" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width={PREVIEW_W} height={PREVIEW_H} fill="url(#report-grid)" />
                {coords.length >= 3 ? (
                  <>
                    <polygon
                      points={previewMap.pts.map((p) => p.join(",")).join(" ")}
                      fill="#bbe4c4"
                      stroke={BRAND_HEX}
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                    />
                    {previewMap.pts.map(([x, y], i) => (
                      <g key={i}>
                        <circle cx={x} cy={y} r={9} fill={BRAND_HEX} stroke="#fff" strokeWidth={1.5} />
                        <text x={x} y={y + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">
                          {i + 1}
                        </text>
                      </g>
                    ))}
                    {bar && (
                      <g transform={`translate(20, ${PREVIEW_H - 20})`}>
                        <rect x={0} y={-4} width={bar.length / 2} height={5} fill="#172033" stroke="#172033" />
                        <rect x={bar.length / 2} y={-4} width={bar.length / 2} height={5} fill="#fff" stroke="#172033" />
                        <text x={0} y={-9} fontSize={10} textAnchor="middle" fill="#172033">0</text>
                        <text x={bar.length} y={-9} fontSize={10} textAnchor="middle" fill="#172033">
                          {bar.label}
                        </text>
                      </g>
                    )}
                  </>
                ) : (
                  <text x={PREVIEW_W / 2} y={PREVIEW_H / 2} textAnchor="middle" fontSize={13} fill="#6b7280" fontStyle="italic">
                    No polygon recorded for this site.
                  </text>
                )}
                {/* North arrow */}
                <g transform={`translate(${PREVIEW_W - 30}, 18)`}>
                  <polygon points="0,0 -9,26 0,20" fill="#172033" />
                  <polygon points="0,0 9,26 0,20" fill="#fff" stroke="#172033" strokeWidth={1} />
                  <text x={0} y={40} textAnchor="middle" fontSize={11} fontWeight={700} fill="#172033">N</text>
                </g>
              </svg>
            </div>
            <p className="text-[10px] italic text-gray-500 mt-1 mb-7">
              Schematic representation, north-up. Coordinates referenced to WGS 84.
            </p>

            {/* III. Coordinates */}
            <SectionTitle>III. BOUNDARY COORDINATES (WGS 84)</SectionTitle>
            <table className="w-full border-collapse text-[12px] text-center mb-7">
              <thead>
                <tr className="text-white" style={{ background: BRAND_HEX }}>
                  <th className="border border-[#cdd6d0] py-2 w-14">Point</th>
                  <th className="border border-[#cdd6d0] py-2">Latitude</th>
                  <th className="border border-[#cdd6d0] py-2">Longitude</th>
                  <th className="border border-[#cdd6d0] py-2">Latitude (DMS)</th>
                  <th className="border border-[#cdd6d0] py-2">Longitude (DMS)</th>
                </tr>
              </thead>
              <tbody>
                {coords.length ? (
                  coords.map((c, i) => (
                    <tr key={i} className={i % 2 ? "bg-[#f7faf8]" : ""}>
                      <td className="border border-[#cdd6d0] py-1.5">{i + 1}</td>
                      <td className="border border-[#cdd6d0] py-1.5 font-mono">{c[0].toFixed(6)}</td>
                      <td className="border border-[#cdd6d0] py-1.5 font-mono">{c[1].toFixed(6)}</td>
                      <td className="border border-[#cdd6d0] py-1.5 font-mono">{toDms(c[0], "N", "S")}</td>
                      <td className="border border-[#cdd6d0] py-1.5 font-mono">{toDms(c[1], "E", "W")}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="border border-[#cdd6d0] py-3 italic text-gray-500">
                      No coordinates recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* IV. Species */}
            {species.length > 0 && (
              <>
                <SectionTitle>IV. RECOMMENDED SPECIES</SectionTitle>
                <table className="w-full border-collapse text-[12px] mb-7">
                  <thead>
                    <tr className="text-white" style={{ background: BRAND_HEX }}>
                      <th className="border border-[#cdd6d0] py-2 w-14">Rank</th>
                      <th className="border border-[#cdd6d0] py-2 text-left px-3">Species</th>
                      <th className="border border-[#cdd6d0] py-2 text-left px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {species.map((s, i) => (
                      <tr key={s.id} className={i % 2 ? "bg-[#f7faf8]" : ""}>
                        <td className="border border-[#cdd6d0] py-1.5 text-center">{s.rank}</td>
                        <td className="border border-[#cdd6d0] py-1.5 px-3 font-semibold">{s.name}</td>
                        <td className="border border-[#cdd6d0] py-1.5 px-3">{s.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Footer */}
            <div className="mt-auto pt-8">
              <div className="border-t-2 border-green-800 pt-1.5 flex justify-between text-[10px] text-gray-500">
                <span>PlantScope • City Environment and Natural Resources Office, Ormoc City</span>
                <span>{reference} • Page 1</span>
              </div>
              <p className="text-[10px] italic text-gray-500">
                System-generated report • {dateLabel}, {timeLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-2 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg border border-gray-300"
          >
            Close
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExporting || !logosReady}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
          >
            {isExporting || !logosReady ? (
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
