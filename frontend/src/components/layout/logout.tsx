import { LogOut } from "lucide-react";

interface LogoutProps {
  setIsLogout: (value: boolean) => void;
  isLogout: boolean;
}

export default function Logout({ setIsLogout, isLogout }: LogoutProps) {
  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) window.location.href = "/Login";
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
    <div
      className={`fixed inset-0 z-10000 flex items-center justify-center bg-black/50 transition-opacity duration-300
        ${isLogout ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
      `}
    >
      <div
        className={`flex flex-col items-center gap-2 bg-white rounded-lg p-6 w-80 text-center shadow-lg
          transform transition-all duration-300
          ${isLogout ? "scale-100 opacity-100" : "scale-95 opacity-0"}
        `}
      >
        <LogOut
          size={66}
          className="text-white bg-red-500 p-3 rounded-full mb-2"
        />

        <h2 className="text-lg font-semibold text-gray-800">Confirm Logout</h2>

        <p className="text-sm text-gray-600 mb-5">
          Are you sure you want to logout?
        </p>

        <div className="flex flex-col w-full gap-3">
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-md border border-red-600 hover:bg-white hover:text-red-600 transition cursor-pointer"
          >
            Logout
          </button>

          <button
            onClick={() => setIsLogout(false)}
            className="bg-white text-black px-4 py-2 rounded-md border border-black hover:border-red-600 hover:text-red-600 transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
