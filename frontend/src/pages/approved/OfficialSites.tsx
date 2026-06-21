import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Trash2,
  Eye,
  ChevronRight,
  ChevronLeft,
  Leaf,
  Pin,
  PinOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Shield,
  Car,
  MapPin,
  FileCheck,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Target,
  Ruler,
} from "lucide-react";
import PlantScopeAlert from "@/components/alert/PlantScopeAlert";
import Delete_modal from "@/components/layout/delete_modal";
import LoaderPending from "@/components/layout/loaderSmall";
import { useUserRole } from "@/hooks/authorization";
import { api } from "@/constant/api";
// =========================
// INTERFACES
// =========================

interface ValidationStatus {
  has_safety_note: boolean;
  has_survivability_note: boolean;
  final_decision: "ACCEPT" | "REJECT" | null;
  is_ready_to_finalize: boolean;
}

interface SiteMetrics {
  ndvi: number | null;
  area_hectares: number;
  seedlings: number;
}

interface VerificationInfo {
  status: "pending" | "draft" | "verified" | "rejected";
  land_classification: {
    id: number;
    name: string;
  } | null;
  security_concerns_count: number;
  has_accessibility: boolean;
  accessibility_type: string | null;
}

interface Site {
  site_id: number;
  name: string;
  status: string;
  is_pinned: boolean;
  created_at: string;
  validation: ValidationStatus;
  verification: VerificationInfo;
  permit_count: number;
  metrics: SiteMetrics;
}

interface Filter {
  search: string;
  entries: number;
  page: number;
  total_page: number;
  pinned_only: boolean;
}

export default function OfficialSites() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [sites, setSites] = useState<Site[]>([]);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    entries: 10,
    page: 1,
    total_page: 1,
    pinned_only: false,
  });
  const [loading, setLoading] = useState(false);
  const [PSalert, setPSAlert] = useState<{
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  } | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { userRole } = useUserRole();
  const [userPath, setUserPath] = useState("");

  useEffect(() => {
    if (userRole === "treeGrowers" || userRole === "CityENROHead") {
      setUserPath("");
    } else if (userRole === "GISSpecialist") {
      setUserPath("/GISS");
    } else if (userRole === "DataManager") {
      setUserPath("/DataManager");
    }
  }, [userRole]);

  // =========================
  // FETCH SITES - Only Accepted & Verified
  // =========================
  const fetchSites = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: filter.search,
        page: filter.page.toString(),
        entries: filter.entries.toString(),
        status: "accepted", // ✅ ONLY accepted sites
        verification_status: "verified", // ✅ ONLY verified sites
        pinned_only: filter.pinned_only ? "true" : "false",
      });
      const response = await fetch(
        api+`api/get_sites/${id}/?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.ok) throw new Error("Failed to fetch sites");

      const data = await response.json();
      console.log("Official Sites data:", data);
      setSites(data.data);
      setFilter((prev) => ({ ...prev, total_page: data.total_page }));
    } catch {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Failed to load official sites",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, [id, filter.page, filter.entries, filter.pinned_only]);

  // =========================
  // TOGGLE PIN
  // =========================
  const handleTogglePin = async (siteId: number, currentPin: boolean) => {
    try {
      const response = await fetch(
        api+`api/toggle_pin/${siteId}/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (response.ok) {
        setSites((prev) =>
          prev.map((s) =>
            s.site_id === siteId ? { ...s, is_pinned: !currentPin } : s,
          ),
        );
      }
    } catch {
      // Silent fail
    }
  };

  // =========================
  // DELETE SITE
  // =========================
  const setDelete = (siteId: number) => {
    setDeleteId(siteId);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const response = await fetch(
        api+`api/delete_site/${deleteId}/`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();

      if (response.ok) {
        setPSAlert({
          type: "success",
          title: "Deleted",
          message: data.message,
        });
        fetchSites();
      } else {
        setPSAlert({
          type: "failed",
          title: "Failed",
          message: data.message || "Delete failed",
        });
      }
    } catch {
      setPSAlert({
        type: "error",
        title: "Error",
        message: "Something went wrong",
      });
    }
    setIsDeleteModalOpen(false);
  };

  // =========================
  // HELPERS
  // =========================
  const getVerificationBadge = (status: string) => {
    switch (status) {
      case "verified":
        return {
          icon: ShieldCheck,
          color: "bg-green-100 text-green-700 border border-green-300",
          label: "Verified",
        };
      case "rejected":
        return {
          icon: ShieldX,
          color: "bg-red-100 text-red-700 border border-red-300",
          label: "Rejected",
        };
      case "draft":
        return {
          icon: FileText,
          color: "bg-blue-100 text-blue-700 border border-blue-300",
          label: "Draft",
        };
      default:
        return {
          icon: ShieldAlert,
          color: "bg-gray-100 text-gray-700 border border-gray-300",
          label: "Pending",
        };
    }
  };

  const getValidationBadge = (validation: ValidationStatus) => {
    if (validation.final_decision === "ACCEPT") {
      return {
        icon: CheckCircle,
        color: "bg-green-100 text-green-700",
        label: "Accepted",
      };
    }
    if (validation.final_decision === "REJECT") {
      return {
        icon: XCircle,
        color: "bg-red-100 text-red-700",
        label: "Rejected",
      };
    }
    if (validation.is_ready_to_finalize) {
      return {
        icon: FileText,
        color: "bg-blue-100 text-blue-700",
        label: "Ready",
      };
    }
    if (validation.has_safety_note && validation.has_survivability_note) {
      return {
        icon: FileText,
        color: "bg-purple-100 text-purple-700",
        label: "Notes Added",
      };
    }
    if (validation.has_safety_note || validation.has_survivability_note) {
      return {
        icon: AlertCircle,
        color: "bg-yellow-100 text-yellow-700",
        label: "In Progress",
      };
    }
    return {
      icon: AlertCircle,
      color: "bg-gray-100 text-gray-700",
      label: "Not Started",
    };
  };

  return (
    <div className="flex min-h-dvh bg-gray-50 justify-center items-center flex-col">
      {/* ALERT */}
      {PSalert && (
        <PlantScopeAlert
          type={PSalert.type}
          title={PSalert.title}
          message={PSalert.message}
          onClose={() => setPSAlert(null)}
        />
      )}

      {/* DELETE MODAL */}
      <Delete_modal
        setIsDeleteModalOpen={setIsDeleteModalOpen}
        isDeleteModalOpen={isDeleteModalOpen}
        onDelete={handleDelete}
      />

      <main className="flex-1 p-8 w-full max-w-7xl">
        {/* HEADER */}
        <div className="mb-7">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="text-green-600" size={28} />
            <h1 className="text-2xl font-bold text-[#0f4a2f]">
              Official Reforestation Sites
            </h1>
          </div>
          <p className="text-sm text-gray-600">
            Showing only sites that are <strong>Accepted</strong> and{" "}
            <strong>Verified</strong> - ready for implementation
          </p>
        </div>

        {/* FILTERS */}
        <div className="flex items-center mb-7 gap-4 flex-wrap">
          <label className="text-sm">Show:</label>
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
            {[10, 25, 50, 100].map((e) => (
              <option key={e} value={e}>
                {e} entries
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filter.pinned_only}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  pinned_only: e.target.checked,
                  page: 1,
                }))
              }
              className="rounded border-gray-300"
            />
            <Pin
              size={14}
              className={
                filter.pinned_only ? "text-green-600" : "text-gray-400"
              }
            />
            Pinned only
          </label>

          <input
            type="text"
            placeholder="Search official sites..."
            value={filter.search}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                search: e.target.value,
                page: 1,
              }))
            }
            onKeyDown={(e) => e.key === "Enter" && fetchSites()}
            className="border border-black rounded-md p-2 w-80 text-[.8rem] ml-auto"
          />
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto shadow-lg border border-gray-200 rounded-lg">
          {loading && <LoaderPending />}
          <table className="min-w-full bg-white">
            <thead className="bg-[#0f4a2fe0] text-white">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-semibold">
                  No
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold">
                  <Pin size={12} className="inline mr-1 -mt-0.5" />
                  Name
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold">
                  <ShieldCheck size={12} className="inline mr-1 -mt-0.5" />
                  Status
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold">
                  <MapPin size={12} className="inline mr-1 -mt-0.5" />
                  Land Classification
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold">
                  Safety & Access
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold">
                  <FileCheck size={12} className="inline mr-1 -mt-0.5" />
                  Permits
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold">
                  <Ruler size={12} className="inline mr-1 -mt-0.5" />
                  Area (ha)
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold">
                  Created
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sites.length > 0 ? (
                sites.map((site, index) => {
                  const verificationBadge = getVerificationBadge(
                    site.verification.status,
                  );
                  const VerificationIcon = verificationBadge.icon;

                  return (
                    <tr
                      key={site.site_id}
                      className={`${
                        index % 2 ? "bg-[#0F4A2F0D]" : ""
                      } hover:bg-gray-50 transition-colors ${
                        site.is_pinned
                          ? "border-l-4 border-green-600 bg-green-50/30"
                          : ""
                      }`}
                    >
                      <td className="py-3 px-4 text-xs">
                        {index + 1 + (filter.page - 1) * filter.entries}
                      </td>
                      <td className="py-3 px-4 font-medium text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleTogglePin(site.site_id, site.is_pinned)
                            }
                            className={`p-1 rounded hover:bg-gray-100 transition ${
                              site.is_pinned
                                ? "text-green-600"
                                : "text-gray-400 hover:text-gray-600"
                            }`}
                            title={site.is_pinned ? "Unpin site" : "Pin to top"}
                          >
                            {site.is_pinned ? (
                              <Pin size={14} className="fill-current" />
                            ) : (
                              <PinOff size={14} />
                            )}
                          </button>
                          {site.name}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${verificationBadge.color}`}
                        >
                          <VerificationIcon size={10} />
                          {verificationBadge.label}
                        </span>
                      </td>

                      {/* Land Classification */}
                      <td className="py-3 px-4">
                        {site.verification.land_classification ? (
                          <span className="text-xs font-medium text-gray-700 bg-blue-50 px-2 py-1 rounded">
                            {site.verification.land_classification.name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            Not set
                          </span>
                        )}
                      </td>

                      {/* Safety & Accessibility */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            {site.verification.security_concerns_count > 0 ? (
                              <>
                                <ShieldAlert
                                  size={12}
                                  className="text-red-500"
                                />
                                <span className="text-[10px] text-red-600 font-medium">
                                  {site.verification.security_concerns_count}{" "}
                                  concern
                                  {site.verification.security_concerns_count > 1
                                    ? "s"
                                    : ""}
                                </span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck
                                  size={12}
                                  className="text-green-500"
                                />
                                <span className="text-[10px] text-green-600">
                                  Safe
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {site.verification.has_accessibility ? (
                              <>
                                <Car size={12} className="text-blue-500" />
                                <span className="text-[10px] text-blue-600">
                                  {site.verification.accessibility_type ||
                                    "Accessible"}
                                </span>
                              </>
                            ) : (
                              <span className="text-[10px] text-gray-400">
                                No data
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Permits Count */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <FileCheck
                            size={12}
                            className={
                              site.permit_count > 0
                                ? "text-green-600"
                                : "text-gray-400"
                            }
                          />
                          <span
                            className={`text-xs font-medium ${site.permit_count > 0 ? "text-green-700" : "text-gray-400"}`}
                          >
                            {site.permit_count}
                          </span>
                        </div>
                      </td>

                      {/* Area */}
                      <td className="py-3 px-4">
                        <span className="text-xs font-medium text-gray-700">
                          {site.metrics.area_hectares.toFixed(2)} ha
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs text-gray-600">
                        {new Date(site.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 flex gap-1">
                        <button
                          className="text-green-900 cursor-pointer border border-green-900 rounded-full p-1 hover:bg-green-50 transition-colors"
                          onClick={() =>
                            navigate(
                              `${userPath}/official-reforestation/site/${id}/information/${site.site_id}`,
                            )
                          }
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        {userRole !== "DataManager" && (
                          <button
                            className="text-red-600 cursor-pointer border border-red-600 rounded-full p-1 hover:bg-red-50 transition-colors"
                            onClick={() => setDelete(site.site_id)}
                            title="Delete Site"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-10 text-gray-500 italic"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <ShieldCheck size={40} className="text-gray-300" />
                      <p>No official sites found</p>
                      <p className="text-xs text-gray-400">
                        Sites must be accepted and verified to appear here
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex items-center gap-1 mt-5">
          <button
            disabled={filter.page <= 1}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page - 1 }))
            }
            className="px-2 py-1 border rounded-md ml-auto disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
          >
            <ChevronLeft size={19} />
          </button>
          {Array.from({ length: Math.min(filter.total_page, 5) }, (_, i) => {
            let pageNum = i + 1;
            if (filter.total_page > 5 && filter.page > 3) {
              pageNum = Math.min(filter.page - 2 + i, filter.total_page);
            }
            return (
              <button
                key={pageNum}
                onClick={() =>
                  setFilter((prev) => ({ ...prev, page: pageNum }))
                }
                className={`px-3 py-1 border rounded-md text-[.8rem] transition-colors ${
                  pageNum === filter.page
                    ? "bg-green-600 text-white border-green-600"
                    : "hover:bg-gray-50"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          {filter.total_page > 5 && filter.page < filter.total_page - 2 && (
            <>
              <span className="px-2 text-gray-400">...</span>
              <button
                onClick={() =>
                  setFilter((prev) => ({ ...prev, page: filter.total_page }))
                }
                className={`px-3 py-1 border rounded-md text-[.8rem] ${
                  filter.total_page === filter.page
                    ? "bg-green-600 text-white border-green-600"
                    : "hover:bg-gray-50"
                }`}
              >
                {filter.total_page}
              </button>
            </>
          )}
          <button
            disabled={filter.page >= filter.total_page}
            onClick={() =>
              setFilter((prev) => ({ ...prev, page: prev.page + 1 }))
            }
            className="px-2 py-1 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </main>
    </div>
  );
}
