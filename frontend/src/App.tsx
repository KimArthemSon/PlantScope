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
import Land_classifications from "./pages/head/maintain/land_classification";
import Soils from "./pages/head/maintain/soils";
import Tree_species from "./pages/head/maintain/tree_species";
import Privacy_policy from "./pages/HomePage/privacy_policy";
import DashboardAFA from "./pages/AFA/dashboardAFA";
import DashboardGISS from "./pages/GISSpecialist/dashboardGISS";
import Accounts from "./pages/head/accounts/accounts";
import Barangays from "./pages/head/maintain/barangay";
import FieldOfficerDashboard from "./pages/FieldOfficer/FieldOfficerDashboard";
import HomePage from "./pages/HomePage/homepage";
import FieldGatherer from "./pages/fieldGatherer/fieldGatherer";
import LogTrail from "./pages/head/accounts/logTrail";
import { Profile } from "./pages/head/accounts/profile";
import NDVIMap from "./pages/fieldGatherer/assignSite";
import Classified_area_form from "./pages/head/maintain/classified_areas/classified_area_form";
import Classified_areas from "./pages/head/maintain/classified_areas/classified_areas";
// Temporary placeholders until each module is developed
function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen">
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
        <Route path="/privacy-policy" element={<Privacy_policy />} />
        <Route element={<Sidebar />}>
          {/* Main Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Final System Modules */}
          {/* <Route
          path="/general-map"
          element={<GenralMap />}
        /> */}

          {/* maintenance */}
          <Route
            path="/maintenance/land-classification"
            element={<Land_classifications />}
          />
          <Route
            path="/maintenance/Classified_area_form/:id"
            element={<Classified_area_form />}
          />
          <Route
            path="/maintenance/Classified_area_form/"
            element={<Classified_area_form />}
          />
          <Route
            path="/maintenance/Classified_areas/"
            element={<Classified_areas />}
          />
          <Route path="/maintenance/barangays/" element={<Barangays />} />
          <Route path="/maintenance/tree-species" element={<Tree_species />} />
          <Route path="/maintenance/soils" element={<Soils />} />

          <Route path="/Log-trail" element={<LogTrail />} />
          <Route path="/field-data" element={<FieldGatherer />} />
          <Route path="/site-management" element={<SiteDatasetMangement />} />

          <Route path="/image-analysis" element={<ImageAnalysis />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/site-verification" element={<SiteVerification />} />
          <Route
            path="/official-planting-sites"
            element={<OfficailPlantingSites />}
          />
          <Route path="/NDVIMap" element={<NDVIMap />} />
          <Route
            path="/reports"
            element={<Placeholder title="Reports & Dashboard" />}
          />
          {/* <Route
          path="/history"
          element={<Placeholder title="History / Recordkeeping" />}
        /> */}
          <Route path="/site_suitability" element={<Accounts />} />
          <Route path="/account-management" element={<Accounts />} />
          <Route path="/account-management/profile/:id" element={<Profile />} />
          <Route path="/account-management/profile/" element={<Profile />} />
        </Route>
        <Route
          path="/dashboard/Field-Officer"
          element={<FieldOfficerDashboard />}
        />
        <Route path="/dashboard/AFA" element={<DashboardAFA />} />
        <Route path="/dashboard/GISS" element={<DashboardGISS />} />
      </Routes>
    </Router>
  );
}
