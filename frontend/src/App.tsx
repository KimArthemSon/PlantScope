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
import DashboardAFA from "./pages/AFA/dashboardAFA";
import DashboardGISS from "./pages/GISSpecialist/dashboardGISS";
import Accounts from "./pages/accounts/accounts";
import FieldOfficerDashboard from "./pages/FieldOfficer/FieldOfficerDashboard";
import HomePage from "./pages/HomePage/homepage";
import FieldGatherer from "./pages/fieldGatherer/fieldGatherer";
import LogTrail from "./pages/accounts/logTrail";
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
        <Route path="/Login" element={<Login />} />
        <Route path="/" element={<HomePage />} />
         <Route path="/dashboard/Field-Officer" element={<FieldOfficerDashboard />} />
        {/* Main Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />
       <Route path="/dashboard/AFA" element={<DashboardAFA />} />
         <Route path="/dashboard/GISS" element={<DashboardGISS />} />
        {/* Final System Modules */}
        {/* <Route
          path="/general-map"
          element={<GenralMap />}
        /> */}
         <Route
          path="/Log-trail"
          element={<LogTrail />}
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
          element={<Accounts  />}
        />
      </Routes>
    </Router>
  );
}