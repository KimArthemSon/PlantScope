import { useState } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { api } from "@/constant/api";

type AlertSetter = (
  alert: { type: "success" | "failed" | "error"; title: string; message: string } | null,
) => void;

interface UseArchiveOptions {
  /** Endpoint suffix, e.g. "barangay" → api/archive_barangay/<id> and api/restore_barangay/<id> */
  resource: string;
  /** Human label used in the confirm dialog, e.g. "barangay" */
  label: string;
  /** Some endpoints are registered with a trailing slash */
  trailingSlash?: boolean;
  setAlert: AlertSetter;
  /** Called after a successful archive/restore so the page can refetch */
  onDone: () => void;
}

/**
 * Shared archive/restore state for maintenance tables.
 * Spread `confirmModalProps` onto <Delete_modal /> and send `archived` with the list query.
 */
export function useArchive({ resource, label, trailingSlash, setAlert, onDone }: UseArchiveOptions) {
  const [showArchived, setShowArchived] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [kind, setKind] = useState<"archive" | "restore">("archive");
  const [targetId, setTargetId] = useState<number | null>(null);

  const openConfirm = (id: number, k: "archive" | "restore") => {
    setTargetId(id);
    setKind(k);
    setConfirmOpen(true);
  };

  const confirm = async () => {
    if (!targetId) return;
    const isArchive = kind === "archive";
    try {
      const res = await fetch(
        `${api}api/${kind}_${resource}/${targetId}${trailingSlash ? "/" : ""}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      setAlert({
        type: "success",
        title: isArchive ? "Archived" : "Restored",
        message: data.message,
      });
      onDone();
    } catch (e: any) {
      setAlert({
        type: "failed",
        title: "Failed",
        message: e?.message || `Failed to ${kind} ${label}.`,
      });
    } finally {
      setConfirmOpen(false);
    }
  };

  const confirmModalProps = {
    isDeleteModalOpen: confirmOpen,
    setIsDeleteModalOpen: setConfirmOpen,
    onDelete: confirm,
    ...(kind === "archive"
      ? {
          title: `Archive ${label}`,
          message: `This ${label} will be moved to the archive. You can restore it anytime.`,
          confirmLabel: "Archive",
        }
      : {
          title: `Restore ${label}`,
          message: `This ${label} will be restored to the active list.`,
          confirmLabel: "Restore",
        }),
  };

  return {
    showArchived,
    toggleArchived: () => setShowArchived((prev) => !prev),
    openConfirm,
    confirmModalProps,
  };
}

export function ArchiveToggleButton({
  showArchived,
  onClick,
  className = "",
  size = "md",
}: {
  showArchived: boolean;
  onClick: () => void;
  className?: string;
  /** "sm" matches compact toolbars (py-1.5 inputs) */
  size?: "sm" | "md";
}) {
  const sizing =
    size === "sm"
      ? "gap-1.5 px-2.5 py-1.5 text-xs font-medium shrink-0"
      : "gap-2 h-10 px-3 py-2 text-[.8rem]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center ${sizing} rounded-lg cursor-pointer border ${
        showArchived
          ? "bg-amber-500 border-amber-600 text-white hover:bg-amber-600"
          : "bg-white border-gray-400 text-gray-700 hover:bg-gray-100"
      } ${className}`}
    >
      <Archive size={size === "sm" ? 14 : 18} />
      {showArchived ? "Back to active" : "Archive"}
    </button>
  );
}

export function ArchiveRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Archive"
      className="text-amber-600 px-3 py-1 rounded-md flex items-center gap-1 cursor-pointer"
    >
      <Archive size={18} />
    </button>
  );
}

export function RestoreRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Restore"
      className="text-green-700 hover:bg-green-50 px-3 py-1 rounded-md flex items-center gap-1 cursor-pointer text-[.85rem] font-medium"
    >
      <ArchiveRestore size={18} /> Restore
    </button>
  );
}
