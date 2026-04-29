import { useEffect, useState } from "react";
import {
  Trash2, ChevronRight, ChevronLeft, Eye, X,
  User, Building2, Mail, Phone, MapPin, Calendar, BadgeCheck, Power,
} from "lucide-react";
import PlantScopeAlert from "../../../components/alert/PlantScopeAlert";
import Delete_modal from "../../../components/layout/delete_modal";
import LoaderPending from "../../../components/layout/loaderSmall";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TreeGrower {
  id: number;
  email: string;
  is_active: boolean;
  profile_img: string;
  full_name: string;
  contact_number: string;
  address: string;
}

interface GrowerDetail {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
  profile: {
    first_name: string;
    middle_name: string;
    last_name: string;
    birthday: string | null;
    gender: string;
    contact: string;
    address: string;
    profile_img: string | null;
  };
  organization: {
    organization_name: string;
    email: string;
    address: string;
    contact: string;
    created_at: string;
    profile_img: string | null;
  } | null;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value || "—"}</span>
    </div>
  );
}

function SectionCard({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
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
    search: "", entries: 10, page: 1, total_page: 1,
  });
  const [loading, setLoading] = useState(false);

  // Delete
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [idDelete, setIdDelete] = useState<number | null>(null);

  // View detail
  const [viewDetail, setViewDetail] = useState<GrowerDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error"; title: string; message: string;
  } | null>(null);

  const token = localStorage.getItem("token");

  // ── Fetch list ───────────────────────────────────────────────────────────────

  const fetchTreeGrowers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
      });
      const res = await fetch(
        `http://127.0.0.1:8000/api/list_tree_growers/?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTreeGrowers(data.tree_growers ?? []);
      setFilter((prev) => ({ ...prev, total_page: data.total_pages }));
    } catch {
      setPSAlert({ type: "error", title: "Failed", message: "Failed to load tree growers." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTreeGrowers(); }, [filter.page, filter.entries]);

  // ── Fetch detail ─────────────────────────────────────────────────────────────

  const openDetail = async (id: number) => {
    setViewDetail(null);
    setViewLoading(true);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/get_tree_grower_detail/${id}/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error();
      const data: GrowerDetail = await res.json();
      setViewDetail(data);
    } catch {
      setPSAlert({ type: "error", title: "Error", message: "Failed to load tree grower details." });
    } finally {
      setViewLoading(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────

  const setDelete = (id: number) => { setIdDelete(id); setIsDeleteModalOpen(true); };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const res = await fetch(`http://127.0.0.1:8000/api/toggle_user_status/${id}/`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const action = currentStatus ? "deactivated" : "activated";
      setPSAlert({ type: "success", title: "Success", message: `Account ${action} successfully.` });
      setTreeGrowers((prev) =>
        prev.map((g) => (g.id === id ? { ...g, is_active: !currentStatus } : g))
      );
      if (viewDetail?.id === id) {
        setViewDetail((prev) => prev ? { ...prev, is_active: !currentStatus } : prev);
      }
    } else {
      setPSAlert({ type: "failed", title: "Failed", message: "Failed to update account status." });
    }
  };

  const handleDelete = async () => {
    if (!idDelete) return;
    const res = await fetch(`http://127.0.0.1:8000/api/delete_user/${idDelete}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setPSAlert({ type: "success", title: "Deleted", message: "Tree grower deleted successfully." });
      setIsDeleteModalOpen(false);
      fetchTreeGrowers();
    } else {
      setPSAlert({ type: "failed", title: "Failed", message: "Failed to delete tree grower." });
      setIsDeleteModalOpen(false);
    }
  };

  const genderLabel: Record<string, string> = { M: "Male", F: "Female", O: "Other" };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-dvh bg-gray-50 justify-center flex-col">
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type} title={PSalert.title} message={PSalert.message}
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
              <h2 className="text-base font-bold text-gray-800">Tree Grower Profile</h2>
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
                  {/* Profile hero */}
                  <div className="bg-gradient-to-r from-[#0F4A2F] to-[#1a6b44] rounded-2xl p-5 flex items-center gap-4 text-white">
                    {viewDetail.profile.profile_img ? (
                      <img
                        src={`http://127.0.0.1:8000${viewDetail.profile.profile_img}`}
                        alt="Profile"
                        className="w-20 h-20 rounded-xl object-cover border-2 border-white/30 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                        <User size={32} className="text-white/60" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold leading-tight">
                        {[viewDetail.profile.first_name, viewDetail.profile.middle_name, viewDetail.profile.last_name]
                          .filter(Boolean).join(" ")}
                      </p>
                      <p className="text-sm text-green-200 mt-0.5 truncate">{viewDetail.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          viewDetail.is_active ? "bg-green-400/20 text-green-200" : "bg-red-400/20 text-red-200"
                        }`}>
                          {viewDetail.is_active ? "Active" : "Inactive"}
                        </span>
                        <span className="text-xs text-green-300">
                          Joined {new Date(viewDetail.created_at).toLocaleDateString("en-PH", {
                            year: "numeric", month: "long", day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Two-column cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* Personal Information */}
                    <SectionCard icon={<User size={15} />} title="Personal Information">
                      <InfoRow label="Birthday" value={viewDetail.profile.birthday ?? "—"} />
                      <InfoRow label="Gender" value={genderLabel[viewDetail.profile.gender] ?? viewDetail.profile.gender} />
                      <InfoRow label="Contact" value={viewDetail.profile.contact} />
                      <InfoRow label="Address" value={viewDetail.profile.address} />
                    </SectionCard>

                    {/* Account */}
                    <SectionCard icon={<BadgeCheck size={15} />} title="Account Details">
                      <InfoRow label="Email" value={viewDetail.email} />
                      <InfoRow label="Status" value={viewDetail.is_active ? "Active" : "Inactive"} />
                      <InfoRow label="Role" value="Tree Grower" />
                      <InfoRow label="Account ID" value={String(viewDetail.id)} />
                    </SectionCard>
                  </div>

                  {/* Organization */}
                  {viewDetail.organization ? (
                    <SectionCard icon={<Building2 size={15} />} title="Organization">
                      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
                        {viewDetail.organization.profile_img ? (
                          <img
                            src={`http://127.0.0.1:8000${viewDetail.organization.profile_img}`}
                            alt="Org"
                            className="w-12 h-12 rounded-xl object-cover border border-green-100 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                            <Building2 size={20} className="text-green-300" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{viewDetail.organization.organization_name}</p>
                          <p className="text-xs text-gray-400">
                            Registered {new Date(viewDetail.organization.created_at).toLocaleDateString("en-PH", {
                              year: "numeric", month: "long", day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
                        <InfoRow label="Email" value={viewDetail.organization.email} />
                        <InfoRow label="Contact" value={viewDetail.organization.contact} />
                        <InfoRow label="Address" value={viewDetail.organization.address} />
                      </div>
                    </SectionCard>
                  ) : (
                    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 flex items-center justify-center gap-2 text-gray-300 text-sm">
                      <Building2 size={18} /> No organization linked
                    </div>
                  )}
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
            onChange={(e) => setFilter((prev) => ({ ...prev, entries: Number(e.target.value), page: 1 }))}
            className="border border-black p-2 rounded-md text-[.8rem]"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <input
            type="text"
            placeholder="Search tree growers..."
            value={filter.search}
            onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
            onKeyDown={(e) => { if (e.key === "Enter") fetchTreeGrowers(); }}
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
                <th className="py-3 px-5 text-left text-[.9rem]">Profile</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Full Name</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Email</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Contact</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Address</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Status</th>
                <th className="py-3 px-5 text-left text-[.9rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {treeGrowers.length > 0 ? (
                treeGrowers.map((grower, index) => (
                  <tr
                    key={grower.id}
                    className={`${index % 2 === 0 ? "" : "bg-[#0F4A2F0D]"} transition`}
                  >
                    <td className="py-3 px-5 text-[.9rem]">
                      {index + 1 + (filter.page - 1) * filter.entries}
                    </td>
                    <td className="py-3 px-5">
                      <img
                        src={"http://127.0.0.1:8000/" + grower.profile_img}
                        alt="profile"
                        className="rounded-full w-20 h-[90%] min-h-20 max-h-25"
                      />
                    </td>
                    <td className="py-3 px-5 text-[.9rem]">{grower.full_name}</td>
                    <td className="py-3 px-5 text-[.9rem]">{grower.email}</td>
                    <td className="py-3 px-5 text-[.9rem]">{grower.contact_number}</td>
                    <td className="py-3 px-5 text-[.9rem]">{grower.address}</td>
                    <td className="py-3 px-5 text-[.9rem]">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        grower.is_active
                          ? "bg-yellow-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {grower.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openDetail(grower.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#0f4a2fe0] text-white text-xs font-medium rounded hover:bg-green-800 transition-colors"
                        >
                          <Eye size={14} />
                          View
                        </button>
                        <button
                          onClick={() => handleToggleStatus(grower.id, grower.is_active)}
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
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-5 text-gray-500 italic">
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
            onClick={() => setFilter((prev) => ({ ...prev, page: prev.page - 1 }))}
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 ml-auto cursor-pointer"
          >
            <ChevronLeft size={19} />
          </button>

          {Array.from({ length: filter.total_page }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setFilter((prev) => ({ ...prev, page: p }))}
              className={`px-2 py-1 border rounded-md cursor-pointer text-[.8rem] ${
                p === filter.page ? "bg-green-600 text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          ))}

          <button
            disabled={filter.page >= filter.total_page}
            onClick={() => setFilter((prev) => ({ ...prev, page: prev.page + 1 }))}
            className="px-2 py-1 border rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>
    </div>
  );
}
