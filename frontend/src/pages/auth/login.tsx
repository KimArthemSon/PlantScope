import logo from "../../assets/logo.png";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import "../../global css/login.css";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      alert("Please enter username and password");
      return;
    }
    console.log("Logging in with:", username, password);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({ email: username, password: password }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Welcome ${data.username}! Login successful.`);
        if (data.token) {
          localStorage.setItem("token", data.token);
        }
        navigate("/dashboard");
      } else {
        alert(data.detail || "Login failed. Please check your credentials.");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("An error occurred. Please try again later.");
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#4CAF50_75%,#FFFFFF_25%)] flex items-center justify-center p-4">
      <div className="w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row bg-white">
        {/* Left Panel */}
        <div className="flex-1 p-8 md:p-12 bg-gradient-to-br from-green-600 to-green-700 text-white flex flex-col items-center justify-center space-y-6">
          <div className="logo-container mb-6">
            <div className="radar-ring"></div>
            <div className="w-32 h-32 mx-auto rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg animate-bounce-logo">
              <img
                src={logo}
                alt="PlantScope Logo"
                className="w-24 h-24 object-contain"
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center">PLANTSCOPE</h1>

          <p className="text-sm text-green-200 text-center">
            • Reforestation • Sustainability • Data-Driven Planning
          </p>
          <div className="mt-1 space-y-4 text-left w-full max-w-sm">
            <p className="flex items-center gap-3 text-sm text-green-100">
              <span className="w-6 h-6 flex items-center justify-center bg-[#04de71] text-white rounded-full text-base">
                ✓
              </span>
              Prioritize reforestation sites
            </p>

            <p className="flex items-center gap-3 text-sm text-green-100">
              <span className="w-6 h-6 flex items-center justify-center bg-[#04de71] text-white rounded-full text-base">
                ✓
              </span>
              Data-driven planning tools
            </p>

            <p className="flex items-center gap-3 text-sm text-green-100">
              <span className="w-6 h-6 flex items-center justify-center bg-[#04de71] text-white rounded-full text-base">
                ✓
              </span>
              GIS-enabled mapping system
            </p>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="flex-1 p-8 md:p-12 flex flex-col justify-center border-2 border-green-400 rounded-tr-3xl rounded-br-3xl">
          <div className="max-w-md mx-auto w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">
              Welcome Back
            </h2>
            <p className="text-sm text-gray-500 mb-8">
              Sign in to manage reforestation data
            </p>

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-3 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-green-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                className="mt-[2rem] w-full bg-gradient-to-r from-green-700 cursor-pointer to-green-800 text-white py-3 rounded-lg font-semibold text-lg hover:from-green-800 hover:to-green-900 transform hover:scale-[1.01] transition-all shadow-md flex items-center justify-center gap-2"
              >
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
