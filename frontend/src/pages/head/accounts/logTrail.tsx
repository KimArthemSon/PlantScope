import { useEffect, useState } from "react";
import NotFoundPage from "../../../components/layout/NotFoundPage";
import PlantScopeLoader from "../../../components/alert/PlantScopeLoader";
import { useAuthorize } from "../../../hooks/authorization";
import { useNavigate } from "react-router-dom";
export default function LogTrail() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          "http://127.0.0.1:8000/api/security/get_recent_logs/",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error("Failed to load logs.");
        }

        const data = await response.json();
        setLogs(data);
      } catch (err: any) {
        setError(err.message || "Unable to fetch logs.");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [token]);
  const { isAuthorized, isLoading } = useAuthorize("CityENROHead");
  if (isLoading) {
    return <PlantScopeLoader />;
  }
  if (!localStorage.getItem("token")) {
    navigate("/Login");
  }
  if (!isAuthorized) {
    return <NotFoundPage />;
  }
  return (
    <div className="flex">
      <div className="flex-1 p-8 min-h-screen">
        <h1 className="text-3xl font-bold mb-6 text-green-700">Activity Log</h1>

        {loading && (
          <div className="text-green-600 text-lg animate-pulse">
            Loading activity...
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-x-auto shadow-lg rounded-xl border border-green-200">
            <table className="min-w-full bg-white rounded-lg">
              <thead className="bg-green-700 text-white">
                <tr>
                  <th className="py-3 px-5 text-left">User</th>
                  <th className="py-3 px-5 text-left">Timestamp</th>
                  <th className="py-3 px-5 text-left">IP Address</th>
                  <th className="py-3 px-5 text-left">Event Type</th>
                </tr>
              </thead>

              <tbody>
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b hover:bg-green-50 transition-all"
                    >
                      {/* USER + ROLE */}
                      <td className="py-3 px-5">
                        <div className="font-semibold text-gray-800">
                          {log.email ?? "Unknown"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {log.user_role ?? "No Role"}
                        </div>
                      </td>

                      {/* TIMESTAMP */}
                      <td className="py-3 px-5">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>

                      {/* IP ADDRESS */}
                      <td className="py-3 px-5">{log.ip_address ?? "-"}</td>

                      {/* EVENT TYPE */}
                      <td className="py-3 px-5">
                        <span
                          className={`px-3 py-1 rounded-full text-sm ${
                            log.event_type === "SUCCESS"
                              ? "bg-green-200 text-green-800"
                              : log.event_type === "FAILED"
                                ? "bg-red-200 text-red-800"
                                : log.event_type === "LOGOUT"
                                  ? "bg-yellow-200 text-yellow-800"
                                  : "bg-gray-200 text-gray-800"
                          }`}
                        >
                          {log.event_type.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center py-5 text-gray-500 italic"
                    >
                      No activity found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
