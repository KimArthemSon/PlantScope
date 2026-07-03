"use client";

import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { api } from "@/constant/api";
import PlantScopeAlert from "../alert/PlantScopeAlert";

interface LogoutProps {
  setIsLogout: (value: boolean) => void;
  isLogout: boolean;
}

export default function Logout({ setIsLogout, isLogout }: LogoutProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{
    show: boolean;
    type: "success" | "failed" | "error";
    title: string;
    message: string;
  }>({ show: false, type: "success", title: "", message: "" });

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        window.location.href = "/Login";
        return;
      }

      const response = await fetch(api + "api/logout/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        localStorage.removeItem("token");
        setAlert({
          show: true,
          type: "success",
          title: "Logged Out Successfully",
          message: "You have been safely logged out of your account.",
        });
        // Redirect after showing success alert
        setTimeout(() => {
          window.location.href = "/Login";
        }, 1500);
      } else {
        setAlert({
          show: true,
          type: "failed",
          title: "Logout Failed",
          message: "Something went wrong. Please try again.",
        });
      }
    } catch (error) {
      setAlert({
        show: true,
        type: "error",
        title: "Network Error",
        message: "Unable to connect to the server. Please check your connection.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Alert Notification */}
      {alert.show && (
        <PlantScopeAlert
          type={alert.type}
          title={alert.title}
          message={alert.message}
          duration={3000}
          onClose={() => setAlert({ ...alert, show: false })}
        />
      )}

      {/* Logout Modal */}
      <div
        className={`fixed inset-0 z-[100000] flex items-center justify-center backdrop-blur-sm bg-black/40 transition-opacity duration-300
          ${isLogout ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
        onClick={() => !isLoading && setIsLogout(false)}
      >
        <div
          className={`relative flex flex-col items-center gap-2 bg-white rounded-2xl p-8 w-[90%] max-w-sm text-center shadow-2xl
            transform transition-all duration-300 border border-gray-100
            ${isLogout ? "scale-100 opacity-100" : "scale-95 opacity-0"}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Decorative gradient top border */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 via-rose-500 to-red-400 rounded-t-2xl" />

          {/* Icon with animated glow */}
          <div className="relative mb-2">
            <div className="absolute inset-0 bg-red-100 rounded-full blur-xl opacity-60 animate-pulse" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-300/50">
              {isLoading ? (
                <Loader2 className="w-10 h-10 text-white animate-spin" strokeWidth={2.5} />
              ) : (
                <LogOut className="w-10 h-10 text-white" strokeWidth={2.5} />
              )}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 mt-2">
            {isLoading ? "Logging Out..." : "Confirm Logout"}
          </h2>

          {/* Message */}
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            {isLoading
              ? "Please wait while we securely log you out."
              : "Are you sure you want to logout? You will need to sign in again to access your account."}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col w-full gap-3">
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="relative overflow-hidden bg-gradient-to-r from-red-500 to-rose-600 text-white px-4 py-3 rounded-xl font-semibold shadow-lg shadow-red-200/50 hover:shadow-xl hover:shadow-red-300/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Logging out...
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    Logout
                  </>
                )}
              </span>
            </button>

            <button
              onClick={() => setIsLogout(false)}
              disabled={isLoading}
              className="bg-gray-50 text-gray-700 px-4 py-3 rounded-xl font-semibold border border-gray-200 hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}