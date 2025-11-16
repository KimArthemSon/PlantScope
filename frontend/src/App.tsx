import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/auth/login";
import Dashboard from "./pages/dashboard/dashboard";
import Sidebar from "./components/layout/Sidebar";
import Analysis from "./pages/analysis/analysis";
import ImageAnalysis from "./pages/analysis/image analysis";
// import GenralMap from "./pages/general map/GeneralMap";
import OfficailPlantingSites from "./pages/approved/OfficialPlantingSites";
import SiteVerification from "./pages/siteVerification/siteVerification";
import SiteDatasetMangement from "./pages/site & dataset management/SiteDatasetMangement";
import SatelliteImageAnalysis from "./pages/sateliteImageAnalysis/sateliteImageAnalysis";
import FieldGatherer from "./pages/fieldGatherer/fieldGatherer";
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
        {/* <Route
          path="/general-map"
          element={<GenralMap />}
        /> */}
         <Route
          path="/satellite-analysis"
          element={<SatelliteImageAnalysis />}
        />
         <Route
          path="/field-data"
          element={<FieldGatherer />}
        />
        <Route
          path="/site-management"
          element={<SiteDatasetMangement />}
        />
        
        <Route
          path="/image-analysis"
          element={<ImageAnalysis/>}
        />
        <Route
          path="/analysis"
          element={<Analysis />}
        />
        <Route
          path="/site-verification"
          element={<SiteVerification />}
        />
        <Route path="/official-planting-sites" element={<OfficailPlantingSites />}/>
        <Route
          path="/reports"
          element={<Placeholder title="Reports & Dashboard" />}
        />
        {/* <Route
          path="/history"
          element={<Placeholder title="History / Recordkeeping" />}
        /> */}
        <Route
          path="/account-management"
          element={<Placeholder title="Account Management" />}
        />
      </Routes>
    </Router>
  );
}
