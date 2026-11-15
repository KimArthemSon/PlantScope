import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export type SortOrder = "asc" | "desc";
export interface SortState {
  by: string;
  order: SortOrder;
}

// Date-like columns start newest-first; everything else starts A→Z.
const DESC_FIRST = new Set(["timestamp", "created_at"]);

/** Clicking the active column flips its order; clicking a new column selects it. */
export function nextSort(current: SortState, key: string): SortState {
  if (current.by === key) {
    return { by: key, order: current.order === "asc" ? "desc" : "asc" };
  }
  return { by: key, order: DESC_FIRST.has(key) ? "desc" : "asc" };
}

/** Appends sort_by / order to request params (the backend whitelists the keys). */
export function applySortParams(params: URLSearchParams, sort: SortState) {
  params.set("sort_by", sort.by);
  params.set("order", sort.order);
}

export default function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
  className = "py-3 px-5 text-left text-[.9rem]",
}: {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  className?: string;
}) {
  const active = sort.by === sortKey;
  const Icon = !active ? ArrowUpDown : sort.order === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={className}
      aria-sort={active ? (sort.order === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1.5 font-[inherit] cursor-pointer select-none hover:text-green-200 transition-colors"
        title={`Sort by ${label}`}
      >
        {label}
        <Icon size={13} className={active ? "opacity-100" : "opacity-50"} />
      </button>
    </th>
  );
}
