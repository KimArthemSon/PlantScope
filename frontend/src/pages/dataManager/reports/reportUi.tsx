import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { api } from "@/constant/api.ts";

// ─── Data fetching ──────────────────────────────────────────────────────────

/** Fetches a report endpoint whenever the params change (debounced for typing). */
export function useReport<T>(endpoint: string, params: Record<string, string>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== "" && v !== "all"),
  ).toString();

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${api}api/${endpoint}?${query}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load report");
      if (id === requestId.current) setData(body);
    } catch (err: any) {
      if (id === requestId.current) setError(err.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [endpoint, query]);

  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
  }, [load]);

  return { data, loading, error, reload: load };
}

// ─── Formatting ─────────────────────────────────────────────────────────────

export const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();
export const fmtHa = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ha`;
export const fmtPct = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${n}%`;
export const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

export const SURVIVAL_TARGET = 70;
export function rateColor(rate: number | null | undefined) {
  if (rate === null || rate === undefined) return "#9ca3af";
  if (rate >= SURVIVAL_TARGET) return "#10b981";
  if (rate >= 50) return "#f59e0b";
  return "#ef4444";
}

// ─── Layout pieces ──────────────────────────────────────────────────────────

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_rgba(5,120,0,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  icon,
  title,
  sub,
  right,
}: {
  icon?: ReactNode;
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 className="text-[15px] font-bold text-gray-800 flex items-center gap-2">
          {icon && <span className="text-[#0F4A2F]">{icon}</span>}
          {title}
        </h3>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Kpi({
  icon,
  label,
  value,
  sub,
  accent = "bg-emerald-500",
  valueColor,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  valueColor?: string;
}) {
  return (
    <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_rgba(5,120,0,0.05)] p-4">
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${accent}`} />
      <div className="flex items-center gap-2 mb-2">
        <span className="w-8 h-8 rounded-lg bg-[#057501]/[0.08] text-[#057501] flex items-center justify-center">
          {icon}
        </span>
        <p className="text-[11.5px] text-gray-500 font-medium leading-tight">
          {label}
        </p>
      </div>
      <p
        className="text-[24px] font-bold text-gray-800 leading-none"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-gray-400 mt-1.5">{sub}</p>}
    </div>
  );
}

export function EmptyState({ text, className = "py-12" }: { text: string; className?: string }) {
  return <p className={`text-center text-gray-400 text-sm ${className}`}>{text}</p>;
}

export function LoadingBlock({ text = "Loading report…" }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 size={36} className="animate-spin text-[#0F4A2F] mb-3" />
      <p className="text-gray-500 text-sm font-medium">{text}</p>
    </div>
  );
}

export function Badge({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-semibold border whitespace-nowrap ${tone}`}
    >
      {label}
    </span>
  );
}

export const PROGRAM_TONE: Record<string, string> = {
  completed: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
  accepted: "bg-sky-50 text-sky-700 border-sky-200",
  under_monitoring: "bg-indigo-50 text-indigo-700 border-indigo-200",
  for_evaluation: "bg-amber-50 text-amber-700 border-amber-200",
  for_head: "bg-amber-50 text-amber-700 border-amber-200",
};

export const SITE_TONE: Record<string, string> = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reserved: "bg-amber-50 text-amber-700 border-amber-200",
  under_monitoring: "bg-indigo-50 text-indigo-700 border-indigo-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  onhold: "bg-gray-100 text-gray-600 border-gray-200",
};

export const VISIT_TONE: Record<string, string> = {
  accepted: "bg-green-50 text-green-700 border-green-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

export function RateBar({ rate }: { rate: number | null | undefined }) {
  if (rate === null || rate === undefined)
    return <span className="text-[11px] text-gray-400">—</span>;
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(rate, 100)}%`, background: rateColor(rate) }}
        />
      </div>
      <span className="text-[11.5px] font-bold w-11 text-right" style={{ color: rateColor(rate) }}>
        {rate}%
      </span>
    </div>
  );
}

export function GreenTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0F4A2F] text-white text-xs rounded-xl px-3 py-2 shadow-xl border border-white/10">
      <p className="font-semibold mb-1 text-emerald-300">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? "#86efac" }}>
          {p.name}: <b>{p.value ?? "—"}</b>
        </p>
      ))}
    </div>
  );
}

export const AXIS_TICK = { fontSize: 11, fill: "#94a3b8" };

// ─── Filters ────────────────────────────────────────────────────────────────

export function FilterBar({
  children,
  onReset,
  showReset,
}: {
  children: ReactNode;
  onReset: () => void;
  showReset: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        {children}
        {showReset && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <X size={13} /> Clear filters
          </button>
        )}
      </div>
    </Card>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-[#0F4A2F] focus:outline-none focus:ring-2 focus:ring-emerald-100";

export function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <FilterField label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FilterField>
  );
}

export function SearchFilter({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <FilterField label="Search">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputClass} pl-8 w-60`}
        />
      </div>
    </FilterField>
  );
}

function iso(d: Date) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().split("T")[0];
}

export const DATE_PRESETS: { key: string; label: string; range: () => [string, string] }[] = [
  { key: "all", label: "All time", range: () => ["", ""] },
  {
    key: "month",
    label: "This month",
    range: () => {
      const now = new Date();
      return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(now)];
    },
  },
  {
    key: "quarter",
    label: "Last 3 months",
    range: () => {
      const now = new Date();
      return [iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), iso(now)];
    },
  },
  {
    key: "year",
    label: "This year",
    range: () => {
      const now = new Date();
      return [iso(new Date(now.getFullYear(), 0, 1)), iso(now)];
    },
  },
  {
    key: "last_year",
    label: "Last year",
    range: () => {
      const y = new Date().getFullYear() - 1;
      return [iso(new Date(y, 0, 1)), iso(new Date(y, 11, 31))];
    },
  },
];

export function DateRangeFilter({
  from,
  to,
  onChange,
  label = "Date range",
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  label?: string;
}) {
  const active = DATE_PRESETS.find((p) => {
    const [f, t] = p.range();
    return f === from && t === to;
  });
  return (
    <FilterField label={label}>
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={active?.key ?? "custom"}
          onChange={(e) => {
            const preset = DATE_PRESETS.find((p) => p.key === e.target.value);
            if (preset) onChange(...preset.range());
          }}
          className={inputClass}
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
          {!active && <option value="custom">Custom</option>}
        </select>
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => onChange(e.target.value, to)}
          className={inputClass}
        />
        <span className="text-gray-400 text-xs">to</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => onChange(from, e.target.value)}
          className={inputClass}
        />
      </div>
    </FilterField>
  );
}

// ─── Export buttons ─────────────────────────────────────────────────────────

export function ExportButtons({
  onPdf,
  onExcel,
  disabled,
  count,
}: {
  onPdf: () => void;
  onExcel: () => void;
  disabled: boolean;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 hidden md:inline">{fmt(count)} records</span>
      <button
        onClick={onPdf}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F4A2F] text-white text-xs font-semibold hover:bg-[#1a6b44] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FileText size={14} /> Export PDF
      </button>
      <button
        onClick={onExcel}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-green-200 text-green-700 text-xs font-semibold hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download size={14} /> Export Excel
      </button>
    </div>
  );
}

// ─── Client-side pagination ────────────────────────────────────────────────

export function usePaged<T>(rows: T[], pageSize = 15) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => setPage(1), [rows]);
  const safePage = Math.min(page, totalPages);
  return {
    page: safePage,
    totalPages,
    setPage,
    pageRows: rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    from: rows.length === 0 ? 0 : (safePage - 1) * pageSize + 1,
    to: Math.min(safePage * pageSize, rows.length),
    total: rows.length,
  };
}

export function Pagination({
  page,
  totalPages,
  setPage,
  from,
  to,
  total,
}: {
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
  from: number;
  to: number;
  total: number;
}) {
  if (total === 0) return null;
  return (
    <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/60 rounded-b-2xl">
      <p className="text-xs text-gray-500">
        Showing {from}–{to} of {total}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-white disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-gray-600 px-2">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-white disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return (
    <th
      className={`py-2.5 px-3 text-[10.5px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap ${right ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  right,
  className = "",
}: {
  children: ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <td className={`py-3 px-3 text-[12.5px] text-gray-700 ${right ? "text-right" : ""} ${className}`}>
      {children}
    </td>
  );
}
