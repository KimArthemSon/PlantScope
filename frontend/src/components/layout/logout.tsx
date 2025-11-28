import React from "react";

interface LogoutProps {
  setIsLogout: (value: boolean) => void;
}

export default function Logout({ setIsLogout }: LogoutProps) {
  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch("http://127.0.0.1:8000/api/logout/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        localStorage.removeItem("token");
        window.location.href = "/Login";
      } else {
        console.error("Logout failed");
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-10000">
      <div className="bg-white rounded-lg p-6 w-80 text-center shadow-lg animate-fadeIn">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">
          Confirm Logout
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to logout?
        </p>
        <div className="flex justify-around">
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition"
          >
            Yes, Logout
          </button>
          <button
            onClick={() => setIsLogout(false)}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
