import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/auth/login";
import Dashboard from "./pages/dashboard/dashboard";
import Sidebar from "./components/layout/sidebar";
import GenralMap from "./pages/general map/GeneralMap";4
import SiteDatasetMangement from "./pages/site & dataset management/SiteDatasetMangement";
// Temporary placeholders until each module is developed
function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center text-3xl font-bold text-gray-700">
        {title}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Authentication */}
        <Route path="/" element={<Login />} />

        {/* Main Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Final System Modules */}
        <Route
          path="/general-map"
          element={<GenralMap />}
        />
        <Route
          path="/site-management"
          element={<SiteDatasetMangement />}
        />
        
        <Route
          path="/image-analysis"
          element={<Placeholder title="Image Analysis" />}
        />
        <Route
          path="/analysis"
          element={<Placeholder title="Analysis / Results" />}
        />
        <Route
          path="/monitoring"
          element={<Placeholder title="Monitoring" />}
        />
        <Route
          path="/reports"
          element={<Placeholder title="Reports & Dashboard" />}
        />
        <Route
          path="/history"
          element={<Placeholder title="History / Recordkeeping" />}
        />
        <Route
          path="/account"
          element={<Placeholder title="Account Management" />}
        />
      </Routes>
    </Router>
  );
}
