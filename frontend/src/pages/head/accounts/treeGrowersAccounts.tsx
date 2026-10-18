import { useEffect, useState } from "react";
import {
  Trash2,
  ChevronRight,
  ChevronLeft,
  Eye,
  X,
  Building2,
  BadgeCheck,
  Power,
  Users,
  Activity,
  History,
  MapPin,
  FileText,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import Delete_modal from "../../../components/layout/delete_modal";
import LoaderPending from "../../../components/layout/loaderSmall";
import { api } from "@/constant/api.ts";

// ── Types ────────────────────────────────────────────────────────────────────

interface TreeGrower {
  id: number;
  email: string;
  is_active: boolean;
  created_at?: string;
  group_name?: string;
  group_type?: string;
  group_type_display?: string;
  group_contact?: string;
  group_address?: string;
  group_img?: string | null;
  current_site?: {
    site_id: number;
    site_name: string;
    barangay: string | null;
    app_status: string;
  } | null;
  // legacy fallbacks (old API shape)
  contact_number?: string;
  address?: string;
  profile_img?: string | null;
}

interface GrowerGroup {
  group_id?: number;
  group_name: string;
  group_type?: string;
  group_type_display?: string;
  address?: string;
  contact?: string;
  created_at?: string;
  updated_at?: string;
  profile_img?: string | null;
}

interface GrowerApplication {
  application_id: number;
  title: string;
  status: string;
  status_display: string;
  classification: string;
  participants: number;
  site_name: string | null;
  barangay: string | null;
  orientation_date: string | null;
  created_at: string;
  updated_at: string;
  is_ongoing: boolean;
}

interface GrowerDetail {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
  group: GrowerGroup | null;
  applications?: GrowerApplication[];
  current_application?: GrowerApplication | null;
}

interface Filter {
  search: string;
  site_status: "" | "with_site" | "without_site";
  entries: number;
  page: number;
  total_page: number;
}

// ── Group type helpers ────────────────────────────────────────────────────────

const GROUP_TYPE_LABELS: Record<string, string> = {
  formal_org: "Formal Organization",
  community_group: "Community Group",
  informal_group: "Informal Group",
};

const GROUP_TYPE_COLORS: Record<string, string> = {
  formal_org: "bg-blue-100 text-blue-700 border-blue-200",
  community_group: "bg-green-100 text-green-700 border-green-200",
  informal_group: "bg-gray-100 text-gray-700 border-gray-200",
};

const APP_STATUS_COLORS: Record<string, string> = {
  for_evaluation: "bg-amber-100 text-amber-700 border-amber-200",
  for_head: "bg-orange-100 text-orange-700 border-orange-200",
  accepted: "bg-blue-100 text-blue-700 border-blue-200",
  under_monitoring: "bg-emerald-100 text-emerald-700 border-emerald-200",
  completed: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-700 border-red-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

const APP_STATUS_DOT: Record<string, string> = {
  for_evaluation: "bg-amber-400",
  for_head: "bg-orange-400",
  accepted: "bg-blue-500",
  under_monitoring: "bg-emerald-500",
  completed: "bg-green-600",
  rejected: "bg-red-500",
  failed: "bg-red-500",
  cancelled: "bg-gray-400",
};

function appStatusColor(status: string): string {
  return APP_STATUS_COLORS[status] || "bg-gray-100 text-gray-600 border-gray-200";
}

function groupTypeLabel(raw?: string, display?: string): string {
  return display || GROUP_TYPE_LABELS[raw ?? ""] || raw || "—";
}

function groupTypeColor(raw?: string): string {
  return (
    GROUP_TYPE_COLORS[raw ?? ""] || "bg-gray-100 text-gray-700 border-gray-200"
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-sm text-gray-800 font-medium">{value || "—"}</span>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-[#0F4A2F] flex items-center justify-center text-green-300 flex-shrink-0">
          {icon}
        </div>
        <h3 className="text-sm font-bold text-[#0F4A2F]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TreeGrowersAccounts() {
  const [treeGrowers, setTreeGrowers] = useState<TreeGrower[]>([]);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    site_status: "",
    entries: 10,
    page: 1,
    total_page: 1,
  });
  const [loading, setLoading] = useState(false);

  // Delete
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [idDelete, setIdDelete] = useState<number | null>(null);

  // View detail
  const [viewDetail, setViewDetail] = useState<GrowerDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const token = localStorage.getItem("token");

  // ── Fetch list ───────────────────────────────────────────────────────────────

  const fetchTreeGrowers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        site_status: filter.site_status,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
      });
      const res = await fetch(api + `api/list_tree_growers/?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTreeGrowers(data.tree_growers ?? []);
      setFilter((prev) => ({ ...prev, total_page: data.total_pages }));
    } catch {
      setPSAlert({
        type: "error",
        title: "Failed",
        message: "Failed to load tree growers.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTreeGrowers();
  }, [filter.page, filter.entries, filter.site_status]);

  // ── Fetch detail ─────────────────────────────────────────────────────────────

  const openDetail = async (id: number) => {
    setViewDetail(null);
    setViewLoading(true);
    try {
      const res = await fetch(api + `api/get_tree_grower_detail/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data: GrowerDetail = await res.json();
      setViewDetail(data);
    } catch {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to load tree grower details.",
      });
    } finally {
      setViewLoading(false);
    }
  };

  // ── Delete / toggle ──────────────────────────────────────────────────────────

  const setDelete = (id: number) => {
    setIdDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const res = await fetch(api + `api/toggle_user_status/${id}/`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const action = currentStatus ? "deactivated" : "activated";
      setPSAlert({
        type: "success",
        title: "Success",
        message: `Account ${action} successfully.`,
      });
      setTreeGrowers((prev) =>
        prev.map((g) =>
          g.id === id ? { ...g, is_active: !currentStatus } : g,
        ),
      );
      if (viewDetail?.id === id) {
        setViewDetail((prev) =>
          prev ? { ...prev, is_active: !currentStatus } : prev,
        );
      }
    } else {
      setPSAlert({
        type: "failed",
        title: "Failed",
        message: "Failed to update account status.",
      });
    }
  };

  const handleDelete = async () => {
    if (!idDelete) return;
    const res = await fetch(api + `api/delete_user/${idDelete}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setPSAlert({
        type: "success",
        title: "Deleted",
        message: "Tree grower deleted successfully.",
      });
      setIsDeleteModalOpen(false);
      fetchTreeGrowers();
    } else {
      setPSAlert({
        type: "failed",
        title: "Failed",
        message: "Failed to delete tree grower.",
      });
      setIsDeleteModalOpen(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-dvh bg-gray-50 justify-center flex-col">
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}
      <Delete_modal
        setIsDeleteModalOpen={setIsDeleteModalOpen}
        isDeleteModalOpen={isDeleteModalOpen}
        onDelete={handleDelete}
      />

      {/* ── Detail Modal ──────────────────────────────────────────────────── */}
      {(viewDetail || viewLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {/* Modal header bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white rounded-t-2xl">
              <h2 className="text-base font-bold text-gray-800">
                Tree Grower Group Details
              </h2>
              <button
                onClick={() => setViewDetail(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
              {viewLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-[#0F4A2F] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : viewDetail ? (
                <>
                  {/* Group hero */}
                  <div className="bg-gradient-to-r from-[#0F4A2F] to-[#1a6b44] rounded-2xl p-5 flex items-center gap-4 text-white">
                    {viewDetail.group?.profile_img ? (
                      <img
                        src={viewDetail.group.profile_img}
                        alt="Group"
                        className="w-20 h-20 rounded-xl object-cover border-2 border-white/30 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                        <Building2 size={32} className="text-white/60" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold leading-tight">
                        {viewDetail.group?.group_name || "No Group"}
                      </p>
                      {viewDetail.group && (
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border mt-1 ${groupTypeColor(viewDetail.group.group_type)}`}
                        >
                          {groupTypeLabel(
                            viewDetail.group.group_type,
                            viewDetail.group.group_type_display,
                          )}
                        </span>
                      )}
                      <p className="text-sm text-green-200 mt-2 truncate">
                        {viewDetail.email}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            viewDetail.is_active
                              ? "bg-green-400/20 text-green-200"
                              : "bg-red-400/20 text-red-200"
                          }`}
                        >
                          {viewDetail.is_active ? "Active" : "Inactive"}
                        </span>
                        <span className="text-xs text-green-300">
                          Joined {formatDate(viewDetail.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Account Details */}
                    <SectionCard
                      icon={<BadgeCheck size={15} />}
                      title="Account Details"
                    >
                      <InfoRow label="Email" value={viewDetail.email} />
                      <InfoRow
                        label="Status"
                        value={viewDetail.is_active ? "Active" : "Inactive"}
                      />
                      <InfoRow label="Role" value="Tree Grower" />
                      <InfoRow
                        label="Account ID"
                        value={String(viewDetail.id)}
                      />
                    </SectionCard>

                    {/* Group Information */}
                    {viewDetail.group ? (
                      <SectionCard
                        icon={<Users size={15} />}
                        title="Group Information"
                      >
                        <InfoRow
                          label="Group Type"
                          value={groupTypeLabel(
                            viewDetail.group.group_type,
                            viewDetail.group.group_type_display,
                          )}
                        />
                        <InfoRow
                          label="Contact"
                          value={viewDetail.group.contact || "—"}
                        />
                        <InfoRow
                          label="Address"
                          value={viewDetail.group.address || "—"}
                        />
                        <InfoRow
                          label="Registered"
                          value={formatDate(viewDetail.group.created_at)}
                        />
                      </SectionCard>
                    ) : (
                      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 flex items-center justify-center gap-2 text-gray-300 text-sm">
                        <Building2 size={18} /> No group linked
                      </div>
                    )}
                  </div>

                  {/* Current Application */}
                  <SectionCard
                    icon={<Activity size={15} />}
                    title="Current Application"
                  >
                    {viewDetail.current_application ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                Currently Active
                              </span>
                            </div>
                            <p className="text-sm font-bold text-gray-800 mt-1.5 truncate">
                              {viewDetail.current_application.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                              <MapPin size={12} />
                              {viewDetail.current_application.site_name
                                ? `${viewDetail.current_application.site_name}${
                                    viewDetail.current_application.barangay
                                      ? ` • Brgy. ${viewDetail.current_application.barangay}`
                                      : ""
                                  }`
                                : "No site assigned yet"}
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${appStatusColor(viewDetail.current_application.status)}`}
                          >
                            {viewDetail.current_application.status_display}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-emerald-100 text-xs">
                          <div>
                            <p className="text-gray-400 font-semibold">Applied</p>
                            <p className="text-gray-700 font-medium">
                              {formatDate(viewDetail.current_application.created_at)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-semibold">Orientation</p>
                            <p className="text-gray-700 font-medium">
                              {formatDate(viewDetail.current_application.orientation_date)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-semibold">Participants</p>
                            <p className="text-gray-700 font-medium">
                              {viewDetail.current_application.participants}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
                        No active application — this group is not currently in a
                        program.
                      </div>
                    )}
                  </SectionCard>

                  {/* Application History */}
                  <SectionCard
                    icon={<History size={15} />}
                    title={`Application History (${viewDetail.applications?.length ?? 0})`}
                  >
                    {viewDetail.applications && viewDetail.applications.length > 0 ? (
                      <ol className="relative border-l-2 border-gray-100 ml-1.5">
                        {viewDetail.applications.map((app) => (
                          <li key={app.application_id} className="ml-4 pb-4 last:pb-0">
                            <span
                              className={`absolute -left-1.75 mt-1.5 w-3 h-3 rounded-full ring-4 ring-white ${APP_STATUS_DOT[app.status] || "bg-gray-400"}`}
                            />
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">
                                  {app.title}
                                  {app.is_ongoing && (
                                    <span className="ml-2 text-[10px] font-bold uppercase text-emerald-600">
                                      • Active
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {app.site_name
                                    ? `${app.site_name}${app.barangay ? ` • Brgy. ${app.barangay}` : ""}`
                                    : "No site assigned"}
                                  {" · "}
                                  {app.classification}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  Applied {formatDate(app.created_at)} · Updated{" "}
                                  {formatDate(app.updated_at)}
                                </p>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${appStatusColor(app.status)}`}
                              >
                                {app.status_display}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-400">
                        <FileText size={16} /> No applications submitted yet.
                      </div>
                    )}
                  </SectionCard>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="flex-1 p-8 max-w-[1636px] mt-10">
        {/* Filters */}
        <div className="flex items-center mb-7 gap-4">
          <label>Show entries:</label>
          <select
            value={filter.entries}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                entries: Number(e.target.value),
                page: 1,
              }))
            }
            className="border border-black p-2 rounded-md text-[.8rem]"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <label>Site:</label>
          <select
            value={filter.site_status}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                site_status: e.target.value as Filter["site_status"],
                page: 1,
              }))
            }
            className="border border-black p-2 rounded-md text-[.8rem]"
          >
            <option value="">All</option>
            <option value="with_site">Currently has a site</option>
            <option value="without_site">No current site</option>
          </select>

          <input
            type="text"
            placeholder="Search by email or group name..."
            value={filter.search}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                search: e.target.value,
                page: 1,
              }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchTreeGrowers();
            }}
            className="border border-black rounded-md p-2 w-80 text-[.8rem] ml-auto"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto shadow-lg rounded-sm border border-gray-200">
          <table className="relative min-w-full bg-white rounded-sm">
            {loading && <LoaderPending />}
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-5 text-left text-[.9rem]">No</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Group Name</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Group Type</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Email</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Contact</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Address</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Current Site</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Status</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {treeGrowers.length > 0 ? (
                treeGrowers.map((grower, index) => {
                  const img = grower.group_img || grower.profile_img;
                  return (
                    <tr
                      key={grower.id}
                      className={`${index % 2 === 0 ? "" : "bg-[#0F4A2F0D]"} transition`}
                    >
                      <td className="py-3 px-5 text-[.9rem]">
                        {index + 1 + (filter.page - 1) * filter.entries}
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          {img ? (
                            <img
                              src={img}
                              alt="group"
                              className="rounded-lg w-12 h-12 object-cover border border-gray-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <Building2 size={20} className="text-gray-400" />
                            </div>
                          )}
                          <span className="text-[.9rem] font-medium">
                            {grower.group_name || "No Group"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${groupTypeColor(grower.group_type)}`}
                        >
                          {groupTypeLabel(
                            grower.group_type,
                            grower.group_type_display,
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-[.9rem]">{grower.email}</td>
                      <td className="py-3 px-5 text-[.9rem]">
                        {grower.group_contact || grower.contact_number || "—"}
                      </td>
                      <td className="py-3 px-5 text-[.9rem]">
                        {grower.group_address || grower.address || "—"}
                      </td>
                      <td className="py-3 px-5 text-[.9rem]">
                        {grower.current_site ? (
                          <div
                            className="flex flex-col"
                            title={grower.current_site.app_status}
                          >
                            <span className="inline-flex items-center gap-1 font-medium text-[#0F4A2F]">
                              <MapPin size={13} className="shrink-0" />
                              {grower.current_site.site_name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {grower.current_site.barangay
                                ? `Brgy. ${grower.current_site.barangay} · `
                                : ""}
                              {grower.current_site.app_status}
                            </span>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 whitespace-nowrap">
                            No site
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-5 text-[.9rem]">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            grower.is_active
                              ? "bg-yellow-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {grower.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          <Eye
                            size={16}
                            onClick={() => openDetail(grower.id)}
                            className="cursor-pointer"
                          />
                          <button
                            onClick={() =>
                              handleToggleStatus(grower.id, grower.is_active)
                            }
                            title={grower.is_active ? "Deactivate" : "Activate"}
                            className={`px-2 py-1.5 rounded-md flex items-center cursor-pointer transition-colors ${
                              grower.is_active
                                ? "text-yellow-600 hover:bg-yellow-50"
                                : "text-green-600 hover:bg-green-50"
                            }`}
                          >
                            <Power size={16} />
                          </button>
                          <button
                            onClick={() => setDelete(grower.id)}
                            className="text-red-500 px-2 py-1.5 rounded-md flex items-center cursor-pointer hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-5 text-gray-500 italic"
                  >
                    No tree growers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-1 mt-5 w-full">
          <button
            disabled={filter.page <= 1}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page - 1 }))
            }
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 ml-auto cursor-pointer"
          >
            <ChevronLeft size={19} />
          </button>

          {Array.from({ length: filter.total_page }, (_, i) => i + 1).map(
            (p) => (
              <button
                key={p}
                onClick={() => setFilter((prev) => ({ ...prev, page: p }))}
                className={`px-2 py-1 border rounded-md cursor-pointer text-[.8rem] ${
                  p === filter.page
                    ? "bg-green-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {p}
              </button>
            ),
          )}

          <button
            disabled={filter.page >= filter.total_page}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page + 1 }))
            }
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>
    </div>
  );
}
