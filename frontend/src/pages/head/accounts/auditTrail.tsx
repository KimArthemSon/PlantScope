import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Filter, RefreshCw, Eye, X } from "lucide-react";
import NotFoundPage from "../../../components/layout/NotFoundPage";
import PlantScopeLoader from "../../../components/alert/PlantScopeLoader";
import { useAuthorize } from "../../../hooks/authorization";
import { useNavigate } from "react-router-dom";

type ActiveTab = "session" | "audit" | "operational";
type AuditAccountType = "admins" | "treeGrowers";

interface SessionLog {
  id: number;
  user_id: number | null;
  email: string;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
  user_role: string | null;
}

interface ActivityEntry {
  id: number;
  performed_by_id: number | null;
  performed_by_email: string;
  performed_by_role: string | null;
  action_type: string;
  entity_type: string;
  entity_id: number | null;
  entity_label: string;
  description: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[] | null;
  ip_address: string | null;
  timestamp: string;
}

interface AccountEntry {
  id: number;
  email: string;
  user_role?: string;
  is_active: boolean;
  full_name?: string;
}

interface Paginated<T> {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: T[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_EVENTS = ["", "SUCCESS", "FAILED", "LOGOUT", "PWD_CHANGE"];
const SESSION_EVENT_LABEL: Record<string, string> = {
  "": "All Events",
  SUCCESS: "Login Success",
  FAILED: "Login Failed",
  LOGOUT: "Logout",
  PWD_CHANGE: "Password Change",
};

const AUDIT_ACTIONS = ["", "LOGIN", "LOGOUT", "PWD_CHANGE", "CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "SUBMIT"];
const AUDIT_ACTION_LABEL: Record<string, string> = {
  "": "All Actions", LOGIN: "Login", LOGOUT: "Logout", PWD_CHANGE: "Password Change",
  CREATE: "Create", UPDATE: "Update", DELETE: "Delete",
  APPROVE: "Approve", REJECT: "Reject", SUBMIT: "Submit",
};

const OP_ACTIONS = ["", "CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "SUBMIT", "STATE_CHANGE"];
const OP_ACTION_LABEL: Record<string, string> = {
  "": "All Actions", CREATE: "Create", UPDATE: "Update", DELETE: "Delete",
  APPROVE: "Approve", REJECT: "Reject", SUBMIT: "Submit", STATE_CHANGE: "State Change",
};

// ── Badge helpers ─────────────────────────────────────────────────────────────

const BASE_BADGE = "px-3 py-1 rounded-full text-xs font-medium";

function sessionBadge(event: string) {
  if (event === "SUCCESS") return `${BASE_BADGE} bg-green-100 text-green-800`;
  if (event === "FAILED")  return `${BASE_BADGE} bg-red-100 text-red-800`;
  if (event === "LOGOUT")  return `${BASE_BADGE} bg-yellow-100 text-yellow-800`;
  return `${BASE_BADGE} bg-gray-100 text-gray-700`;
}

function actionBadge(action: string) {
  if (action === "CREATE")       return `${BASE_BADGE} bg-blue-100 text-blue-800`;
  if (action === "UPDATE")       return `${BASE_BADGE} bg-amber-100 text-amber-800`;
  if (action === "DELETE")       return `${BASE_BADGE} bg-red-100 text-red-800`;
  if (action === "APPROVE")      return `${BASE_BADGE} bg-green-100 text-green-800`;
  if (action === "REJECT")       return `${BASE_BADGE} bg-red-100 text-red-800`;
  if (action === "SUBMIT")       return `${BASE_BADGE} bg-purple-100 text-purple-800`;
  if (action === "STATE_CHANGE") return `${BASE_BADGE} bg-cyan-100 text-cyan-800`;
  if (action === "LOGIN")        return `${BASE_BADGE} bg-green-100 text-green-800`;
  if (action === "LOGOUT")       return `${BASE_BADGE} bg-yellow-100 text-yellow-800`;
  return `${BASE_BADGE} bg-gray-100 text-gray-700`;
}

const BASE = "http://127.0.0.1:8000/api/security";
const BASE_ACCOUNTS = "http://127.0.0.1:8000/api";

// ── Component ─────────────────────────────────────────────────────────────────

export default function AuditTrail() {
  const [tab, setTab] = useState<ActiveTab>("session");

  // ── Session state ────────────────────────────────────────────────────────────
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [sessionMeta, setSessionMeta] = useState({ total: 0, total_pages: 1, page: 1 });
  const [sessionFilter, setSessionFilter] = useState({
    page: 1, page_size: 20, date_from: "", date_to: "", event_type: "",
  });

  // ── Audit tab — account list ─────────────────────────────────────────────────
  const [auditAccountType, setAuditAccountType] = useState<AuditAccountType>("admins");
  const [accountList, setAccountList] = useState<AccountEntry[]>([]);
  const [accountListPages, setAccountListPages] = useState(1);
  const [accountListPage, setAccountListPage] = useState(1);
  const [accountListSearch, setAccountListSearch] = useState("");
  const [accountListLoading, setAccountListLoading] = useState(false);
  const [accountListError, setAccountListError] = useState("");

  // ── Activity modal state ─────────────────────────────────────────────────────
  const [activityModal, setActivityModal] = useState<{ id: number; email: string; name: string } | null>(null);
  const [modalActivity, setModalActivity] = useState<ActivityEntry[]>([]);
  const [modalMeta, setModalMeta] = useState({ total: 0, total_pages: 1, page: 1 });
  const [modalPage, setModalPage] = useState(1);
  const [modalActionType, setModalActionType] = useState("");
  const [modalDateFrom, setModalDateFrom] = useState("");
  const [modalDateTo, setModalDateTo] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  // ── Operational state ────────────────────────────────────────────────────────
  const [opEntries, setOpEntries] = useState<ActivityEntry[]>([]);
  const [opMeta, setOpMeta] = useState({ total: 0, total_pages: 1, page: 1 });
  const [opFilter, setOpFilter] = useState({
    page: 1, page_size: 20, date_from: "", date_to: "",
    action_type: "", entity_type: "", entity_id: "", performed_by_id: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const { isAuthorized, isLoading } = useAuthorize("CityENROHead");

  // ── Fetchers ────────────────────────────────────────────────────────────────

  const fetchSessionLogs = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const p = new URLSearchParams();
      p.set("page", String(sessionFilter.page));
      p.set("page_size", String(sessionFilter.page_size));
      if (sessionFilter.date_from)  p.set("date_from", sessionFilter.date_from);
      if (sessionFilter.date_to)    p.set("date_to", sessionFilter.date_to);
      if (sessionFilter.event_type) p.set("event_type", sessionFilter.event_type);

      const res = await fetch(`${BASE}/get_recent_logs/?${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load session logs.");
      const data: Paginated<SessionLog> = await res.json();
      setSessionLogs(data.results);
      setSessionMeta({ total: data.total, total_pages: data.total_pages, page: data.page });
    } catch (err: any) {
      setError(err.message || "Unable to fetch session logs.");
    } finally { setLoading(false); }
  }, [sessionFilter, token]);

  const fetchAccountList = useCallback(async () => {
    setAccountListLoading(true); setAccountListError("");
    try {
      const p = new URLSearchParams();
      p.set("search", accountListSearch);
      p.set("page", String(accountListPage));
      p.set("entries", "10");

      const url = auditAccountType === "admins"
        ? `${BASE_ACCOUNTS}/list_users/?${p}`
        : `${BASE_ACCOUNTS}/list_tree_growers/?${p}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load accounts.");
      const data = await res.json();

      if (auditAccountType === "admins") {
        setAccountList(
          (data.accounts as any[]).map((a) => ({
            id: a.id,
            email: a.email,
            user_role: a.user_role,
            is_active: a.is_active,
          }))
        );
        setAccountListPages(data.total_pages);
      } else {
        setAccountList(
          (data.tree_growers as any[]).map((g) => ({
            id: g.id,
            email: g.email,
            user_role: "treeGrowers",
            is_active: g.is_active,
            full_name: g.full_name,
          }))
        );
        setAccountListPages(data.total_pages);
      }
    } catch (err: any) {
      setAccountListError(err.message || "Unable to fetch accounts.");
    } finally { setAccountListLoading(false); }
  }, [auditAccountType, accountListPage, accountListSearch, token]);

  const fetchUserActivity = useCallback(async () => {
    if (!activityModal) return;
    setModalLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("performed_by_id", String(activityModal.id));
      p.set("page", String(modalPage));
      p.set("page_size", "10");
      if (modalActionType) p.set("action_type", modalActionType);
      if (modalDateFrom)   p.set("date_from", modalDateFrom);
      if (modalDateTo)     p.set("date_to", modalDateTo);

      const res = await fetch(`${BASE}/get_activity_log/?${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load activity.");
      const data: Paginated<ActivityEntry> = await res.json();
      setModalActivity(data.results);
      setModalMeta({ total: data.total, total_pages: data.total_pages, page: data.page });
    } catch {
      setModalActivity([]);
    } finally { setModalLoading(false); }
  }, [activityModal, modalPage, modalActionType, modalDateFrom, modalDateTo, token]);

  const fetchOperationalHistory = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const p = new URLSearchParams();
      p.set("page", String(opFilter.page));
      p.set("page_size", String(opFilter.page_size));
      if (opFilter.date_from)       p.set("date_from", opFilter.date_from);
      if (opFilter.date_to)         p.set("date_to", opFilter.date_to);
      if (opFilter.action_type)     p.set("action_type", opFilter.action_type);
      if (opFilter.entity_type)     p.set("entity_type", opFilter.entity_type);
      if (opFilter.entity_id)       p.set("entity_id", opFilter.entity_id);
      if (opFilter.performed_by_id) p.set("performed_by_id", opFilter.performed_by_id);

      const res = await fetch(`${BASE}/get_activity_log/?${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load operational history.");
      const data: Paginated<ActivityEntry> = await res.json();
      setOpEntries(data.results);
      setOpMeta({ total: data.total, total_pages: data.total_pages, page: data.page });
    } catch (err: any) {
      setError(err.message || "Unable to fetch operational history.");
    } finally { setLoading(false); }
  }, [opFilter, token]);

  useEffect(() => { if (tab === "session")     fetchSessionLogs(); },       [tab, fetchSessionLogs]);
  useEffect(() => { if (tab === "audit")       fetchAccountList(); },        [tab, fetchAccountList]);
  useEffect(() => { if (tab === "operational") fetchOperationalHistory(); }, [tab, fetchOperationalHistory]);

  useEffect(() => {
    if (activityModal) fetchUserActivity();
  }, [activityModal, fetchUserActivity]);

  // Reset page when switching account type
  useEffect(() => { setAccountListPage(1); }, [auditAccountType]);

  function openActivityModal(account: AccountEntry) {
    setModalPage(1);
    setModalActionType("");
    setModalDateFrom("");
    setModalDateTo("");
    setModalActivity([]);
    setActivityModal({
      id: account.id,
      email: account.email,
      name: account.full_name || account.email,
    });
  }

  function closeModal() {
    setActivityModal(null);
    setModalActivity([]);
  }

  if (isLoading) return <PlantScopeLoader />;
  if (!localStorage.getItem("token")) { navigate("/Login"); return null; }
  if (!isAuthorized) return <NotFoundPage />;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 p-8 min-h-screen">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Activity Logs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Authentication events, per-account activity, and system-wide business operation history.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {(
          [
            { key: "session",     label: "Authentication & Session Log" },
            { key: "audit",       label: "Account-Level Audit Trail" },
            { key: "operational", label: "Operational Activity History" },
          ] as { key: ActiveTab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-md transition-colors ${
              tab === key
                ? "bg-[#0f4a2fe0] text-white"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Session Filters ─────────────────────────────────────────────────── */}
      {tab === "session" && (
        <FilterBar onRefresh={fetchSessionLogs}>
          <DateRange
            from={sessionFilter.date_from}
            to={sessionFilter.date_to}
            onFrom={(v) => setSessionFilter((f) => ({ ...f, date_from: v, page: 1 }))}
            onTo={(v) => setSessionFilter((f) => ({ ...f, date_to: v, page: 1 }))}
          />
          <SelectField
            label="Event Type"
            value={sessionFilter.event_type}
            options={SESSION_EVENTS}
            labels={SESSION_EVENT_LABEL}
            onChange={(v) => setSessionFilter((f) => ({ ...f, event_type: v, page: 1 }))}
          />
        </FilterBar>
      )}

      {/* ── Operational Filters ─────────────────────────────────────────────── */}
      {tab === "operational" && (
        <FilterBar onRefresh={fetchOperationalHistory}>
          <DateRange
            from={opFilter.date_from}
            to={opFilter.date_to}
            onFrom={(v) => setOpFilter((f) => ({ ...f, date_from: v, page: 1 }))}
            onTo={(v) => setOpFilter((f) => ({ ...f, date_to: v, page: 1 }))}
          />
          <SelectField
            label="Action Type"
            value={opFilter.action_type}
            options={OP_ACTIONS}
            labels={OP_ACTION_LABEL}
            onChange={(v) => setOpFilter((f) => ({ ...f, action_type: v, page: 1 }))}
          />
          <TextField
            label="Entity Type"
            placeholder="e.g. FieldAssessment"
            value={opFilter.entity_type}
            onChange={(v) => setOpFilter((f) => ({ ...f, entity_type: v, page: 1 }))}
          />
          <NumberField
            label="Entity ID"
            value={opFilter.entity_id}
            onChange={(v) => setOpFilter((f) => ({ ...f, entity_id: v, page: 1 }))}
          />
          <NumberField
            label="Performer ID"
            value={opFilter.performed_by_id}
            onChange={(v) => setOpFilter((f) => ({ ...f, performed_by_id: v, page: 1 }))}
          />
        </FilterBar>
      )}

      {error && (
        <div className="bg-red-100 border border-red-300 text-red-700 p-4 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}
      {loading && (
        <div className="text-green-700 text-sm animate-pulse mb-4">Loading...</div>
      )}

      {/* ── Session Log Table ───────────────────────────────────────────────── */}
      {tab === "session" && !loading && !error && (
        <>
          <div className="overflow-x-auto shadow-sm rounded-sm border border-gray-200">
            <table className="min-w-full bg-white">
              <thead className="bg-[#0f4a2fe0] text-white">
                <tr>
                  <Th>User</Th>
                  <Th>Event</Th>
                  <Th>IP Address</Th>
                  <Th>Timestamp</Th>
                </tr>
              </thead>
              <tbody>
                {sessionLogs.length > 0 ? sessionLogs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-green-50 transition-all">
                    <td className="py-3 px-5">
                      <div className="font-medium text-gray-800 text-sm">{log.email}</div>
                      <div className="text-xs text-gray-500">{log.user_role ?? "—"}</div>
                    </td>
                    <td className="py-3 px-5">
                      <span className={sessionBadge(log.event_type)}>
                        {log.event_type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-sm text-gray-700">{log.ip_address ?? "—"}</td>
                    <td className="py-3 px-5 text-sm text-gray-700">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                )) : (
                  <EmptyRow colSpan={4} />
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={sessionMeta.page} total_pages={sessionMeta.total_pages}
            total={sessionMeta.total} page_size={sessionFilter.page_size}
            onPrev={() => setSessionFilter((f) => ({ ...f, page: f.page - 1 }))}
            onNext={() => setSessionFilter((f) => ({ ...f, page: f.page + 1 }))}
          />
        </>
      )}

      {/* ── Audit Tab — Account List ────────────────────────────────────────── */}
      {tab === "audit" && (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-2 mb-4">
            {(
              [
                { key: "admins",      label: "Staff & Admins" },
                { key: "treeGrowers", label: "Tree Growers" },
              ] as { key: AuditAccountType; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setAuditAccountType(key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  auditAccountType === key
                    ? "bg-[#0f4a2fe0] text-white border-[#0f4a2fe0]"
                    : "text-gray-600 border-gray-300 hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search + Refresh */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1 text-gray-500 text-sm">
              <Filter size={15} />
              <span>Search</span>
            </div>
            <input
              type="text"
              placeholder="Search by email…"
              value={accountListSearch}
              onChange={(e) => { setAccountListSearch(e.target.value); setAccountListPage(1); }}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-600 w-64"
            />
            <button
              onClick={fetchAccountList}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#0f4a2fe0] text-white rounded text-sm hover:bg-green-800 transition-colors"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          {accountListError && (
            <div className="bg-red-100 border border-red-300 text-red-700 p-4 rounded-lg mb-4 text-sm">
              {accountListError}
            </div>
          )}

          {accountListLoading ? (
            <div className="text-green-700 text-sm animate-pulse mb-4">Loading accounts…</div>
          ) : (
            <>
              <div className="overflow-x-auto shadow-sm rounded-sm border border-gray-200">
                <table className="min-w-full bg-white">
                  <thead className="bg-[#0f4a2fe0] text-white">
                    <tr>
                      <Th>Account</Th>
                      <Th>Role</Th>
                      <Th>Status</Th>
                      <Th>Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountList.length > 0 ? accountList.map((account) => (
                      <tr key={account.id} className="border-b hover:bg-green-50 transition-all">
                        <td className="py-3 px-5">
                          {account.full_name && (
                            <div className="font-medium text-gray-800 text-sm">{account.full_name}</div>
                          )}
                          <div className={`text-sm ${account.full_name ? "text-gray-500" : "font-medium text-gray-800"}`}>
                            {account.email}
                          </div>
                        </td>
                        <td className="py-3 px-5">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-mono">
                            {account.user_role ?? "—"}
                          </span>
                        </td>
                        <td className="py-3 px-5">
                          <span className={`${BASE_BADGE} ${account.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                            {account.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-3 px-5">
                          <button
                            onClick={() => openActivityModal(account)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f4a2fe0] text-white text-xs font-medium rounded hover:bg-green-800 transition-colors"
                          >
                            <Eye size={13} />
                            View Activity
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <EmptyRow colSpan={4} />
                    )}
                  </tbody>
                </table>
              </div>

              {/* Account list pagination */}
              <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
                <span>Page {accountListPage} of {accountListPages}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAccountListPage((p) => p - 1)}
                    disabled={accountListPage <= 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={15} /> Prev
                  </button>
                  <button
                    onClick={() => setAccountListPage((p) => p + 1)}
                    disabled={accountListPage >= accountListPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Operational History Table ───────────────────────────────────────── */}
      {tab === "operational" && !loading && !error && (
        <>
          <div className="overflow-x-auto shadow-sm rounded-sm border border-gray-200">
            <table className="min-w-full bg-white">
              <thead className="bg-[#0f4a2fe0] text-white">
                <tr>
                  <Th>Performed By</Th><Th>Action</Th><Th>Entity</Th>
                  <Th>Changed Fields</Th><Th>Description</Th><Th>IP Address</Th><Th>Timestamp</Th>
                </tr>
              </thead>
              <tbody>
                {opEntries.length > 0 ? opEntries.map((op) => (
                  <tr key={op.id} className="border-b hover:bg-green-50 transition-all">
                    <td className="py-3 px-5">
                      <div className="font-medium text-gray-800 text-sm">{op.performed_by_email}</div>
                      <div className="text-xs text-gray-500">{op.performed_by_role ?? "—"}</div>
                    </td>
                    <td className="py-3 px-5">
                      <span className={actionBadge(op.action_type)}>
                        {op.action_type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <div className="text-sm text-gray-800">{op.entity_type || "—"}</div>
                      {op.entity_label && (
                        <div className="text-xs text-gray-600 font-medium">{op.entity_label}</div>
                      )}
                      {op.entity_id != null && (
                        <div className="text-xs text-gray-400">ID: {op.entity_id}</div>
                      )}
                    </td>
                    <td className="py-3 px-5">
                      {op.changed_fields && op.changed_fields.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {op.changed_fields.map((f) => (
                            <span
                              key={f}
                              className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-mono"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-sm text-gray-700 max-w-xs truncate">
                      {op.description || "—"}
                    </td>
                    <td className="py-3 px-5 text-sm text-gray-700">{op.ip_address ?? "—"}</td>
                    <td className="py-3 px-5 text-sm text-gray-700">
                      {new Date(op.timestamp).toLocaleString()}
                    </td>
                  </tr>
                )) : (
                  <EmptyRow colSpan={7} />
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={opMeta.page} total_pages={opMeta.total_pages}
            total={opMeta.total} page_size={opFilter.page_size}
            onPrev={() => setOpFilter((f) => ({ ...f, page: f.page - 1 }))}
            onNext={() => setOpFilter((f) => ({ ...f, page: f.page + 1 }))}
          />
        </>
      )}

      {/* ── Activity Modal ──────────────────────────────────────────────────── */}
      {activityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col max-h-[90vh]">

            {/* Modal header */}
            <div className="flex items-start justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Activity Log</h2>
                <p className="text-sm text-gray-500 mt-0.5">{activityModal.name}</p>
              </div>
              <button
                onClick={closeModal}
                className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal filters */}
            <div className="flex flex-wrap items-end gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50">
              <DateRange
                from={modalDateFrom}
                to={modalDateTo}
                onFrom={(v) => { setModalDateFrom(v); setModalPage(1); }}
                onTo={(v) => { setModalDateTo(v); setModalPage(1); }}
              />
              <SelectField
                label="Action Type"
                value={modalActionType}
                options={AUDIT_ACTIONS}
                labels={AUDIT_ACTION_LABEL}
                onChange={(v) => { setModalActionType(v); setModalPage(1); }}
              />
              <button
                onClick={fetchUserActivity}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#0f4a2fe0] text-white rounded text-sm hover:bg-green-800 transition-colors"
              >
                <RefreshCw size={14} />
                Apply
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {modalLoading ? (
                <div className="text-green-700 text-sm animate-pulse py-6 text-center">Loading activity…</div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded border border-gray-200">
                    <table className="min-w-full bg-white">
                      <thead className="bg-[#0f4a2fe0] text-white">
                        <tr>
                          <Th>Action</Th>
                          <Th>Entity</Th>
                          <Th>Description</Th>
                          <Th>IP Address</Th>
                          <Th>Timestamp</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalActivity.length > 0 ? modalActivity.map((entry) => (
                          <tr key={entry.id} className="border-b hover:bg-green-50 transition-all">
                            <td className="py-3 px-5">
                              <span className={actionBadge(entry.action_type)}>
                                {entry.action_type.replace("_", " ")}
                              </span>
                            </td>
                            <td className="py-3 px-5">
                              <div className="text-sm text-gray-800">{entry.entity_type || "—"}</div>
                              {entry.entity_label && (
                                <div className="text-xs text-gray-600 font-medium">{entry.entity_label}</div>
                              )}
                              {entry.entity_id != null && (
                                <div className="text-xs text-gray-400">ID: {entry.entity_id}</div>
                              )}
                            </td>
                            <td className="py-3 px-5 text-sm text-gray-700 max-w-xs">
                              {entry.description || "—"}
                            </td>
                            <td className="py-3 px-5 text-sm text-gray-700">{entry.ip_address ?? "—"}</td>
                            <td className="py-3 px-5 text-sm text-gray-700">
                              {new Date(entry.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        )) : (
                          <EmptyRow colSpan={5} />
                        )}
                      </tbody>
                    </table>
                  </div>

                  <Pagination
                    page={modalMeta.page}
                    total_pages={modalMeta.total_pages}
                    total={modalMeta.total}
                    page_size={10}
                    onPrev={() => setModalPage((p) => p - 1)}
                    onNext={() => setModalPage((p) => p + 1)}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-3 px-5 text-left text-[.85rem]">{children}</th>;
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-8 text-gray-400 italic text-sm">
        No records found.
      </td>
    </tr>
  );
}

function FilterBar({ children, onRefresh }: { children: React.ReactNode; onRefresh: () => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <div className="flex items-center gap-1 text-gray-500 text-sm self-center">
        <Filter size={15} />
        <span>Filters</span>
      </div>
      {children}
      <button
        onClick={onRefresh}
        className="flex items-center gap-1 px-3 py-1.5 bg-[#0f4a2fe0] text-white rounded text-sm hover:bg-green-800 transition-colors"
      >
        <RefreshCw size={14} />
        Refresh
      </button>
    </div>
  );
}

function DateRange({
  from, to, onFrom, onTo,
}: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  const inputCls = "border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-600";
  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">From</label>
        <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className={inputCls} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">To</label>
        <input type="date" value={to} onChange={(e) => onTo(e.target.value)} className={inputCls} />
      </div>
    </>
  );
}

function SelectField({
  label, value, options, labels, onChange,
}: { label: string; value: string; options: string[]; labels: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-600"
      >
        {options.map((v) => <option key={v} value={v}>{labels[v]}</option>)}
      </select>
    </div>
  );
}

function TextField({
  label, placeholder, value, onChange,
}: { label: string; placeholder?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-600 w-36"
      />
    </div>
  );
}

function NumberField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500">{label}</label>
      <input
        type="number"
        placeholder="ID"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-600 w-24"
      />
    </div>
  );
}

function Pagination({
  page, total_pages, total, page_size, onPrev, onNext,
}: {
  page: number; total_pages: number; total: number;
  page_size: number; onPrev: () => void; onNext: () => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * page_size + 1;
  const to   = Math.min(page * page_size, total);
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>{total === 0 ? "No records" : `Showing ${from}–${to} of ${total}`}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev} disabled={page <= 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={15} /> Prev
        </button>
        <span className="px-2">Page {page} of {total_pages}</span>
        <button
          onClick={onNext} disabled={page >= total_pages}
          className="flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
