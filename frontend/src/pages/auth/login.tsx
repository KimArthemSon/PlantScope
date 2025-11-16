import logo from "../../assets/logo.png";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MessageAlert from "../../components/alert/messageAlert"; 

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [isShow, setIsShow] = useState();
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-700 via-emerald-600 to-green-700 relative overflow-hidden p-6">
      {/* Background Blobs */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-[-6rem] -right-20 w-96 h-96 bg-emerald-500 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-[-6rem] -left-20 w-80 h-80 bg-green-500 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      {/* Floating Card */}
      <div className="relative z-10 w-full max-w-5xl bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row transition-transform duration-500 hover:scale-[1.005]">
        {/* LEFT – Welcome Section */}
        <div className="flex-1 flex flex-col justify-center items-center p-8 md:p-12 text-center bg-gradient-to-br from-emerald-50 to-green-50">
          <div className="mb-6">
            <div className="w-24 h-24 mx-auto bg-white/30 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/40 shadow-lg">
              <img
                src={logo}
                alt="PlantScope Logo"
                className="w-16 h-16 object-contain"
              />
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-emerald-800 mb-2 tracking-tight">
            WELCOME
          </h1>
          <h2 className="text-2xl md:text-3xl font-semibold text-emerald-700 mb-6">
            To PlantScope
          </h2>

          <p className="text-sm md:text-base text-emerald-800 max-w-md mx-auto leading-relaxed">
            PlantScope is a GIS-enabled system designed to prioritize and monitor
            reforestation activities in Ormoc City. Explore, map, and restore — all
            in one platform.
          </p>
        </div>

        {/* RIGHT – Login Form */}
        <div className="flex-1 flex flex-col justify-center p-8 md:p-12 bg-white">
          <div className="max-w-sm mx-auto w-full">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-800 mb-2">
              Login
            </h2>
            <p className="text-sm text-gray-600 mb-8">
              Sign in to access your dashboard and manage reforestation data.
            </p>

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Username */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  placeholder="Enter your username"
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl 
                             focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 
                             transition-all duration-200"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pr-12 text-base border border-gray-300 rounded-xl 
                             focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 
                             transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[38px] text-gray-500 hover:text-emerald-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-600 to-green-700 text-white py-3 rounded-xl 
                           font-bold text-lg hover:from-emerald-700 hover:to-green-800 transform 
                           hover:scale-[1.02] transition-all shadow-md focus:ring-2 focus:ring-emerald-400"
              >
                Login
              </button>
            </form>

            <p className="text-center mt-10 text-xs text-gray-400">
              ~ phoebe Designs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
