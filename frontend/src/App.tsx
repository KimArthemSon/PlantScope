import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/auth/login";
import Dashboard from "./pages/head/dashboard/dashboard";
import Sidebar from "./components/layout/Sidebar";
import Analysis from "./pages/head/analysis/analysis";
import Reforestation_areas from "./pages/head/reforestation_areas/reforestation_area";
// import GenralMap from "./pages/general map/GeneralMap";
import OfficailPlantingSites from "./pages/approved/OfficialPlantingSites";
import SiteVerification from "./pages/siteVerification/siteVerification";
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
import Reforestation_area_form from "./pages/head/reforestation_areas/reforestation_area_form";
import LogTrail from "./pages/head/accounts/logTrail";
import { Profile } from "./pages/head/accounts/profile";
import Map from "./pages/head/Map/map";
import Classified_area_form from "./pages/head/maintain/classified_areas/classified_area_form";
import Classified_areas from "./pages/head/maintain/classified_areas/classified_areas";
import Assign_onsite_inspector from "./pages/head/reforestation_areas/assigning";
import Legality_and_Safety from "./pages/head/reforestation_areas/lagelity_and_safety";
import Reforestation_area_site from "./pages/head/site/reforestation_area_site";
import Sites from "./pages/head/site/sites";
import Reforestation_area_analysis from "./pages/head/analysis/reforestation_areas_analysis";
import Sites_analysis from "./pages/head/analysis/site_analysis";
import Multicriteria_analysis from "./pages/head/analysis/multicriteria_analysis";
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
          <Route
            path="/assign_onsite_inpsector/:id"
            element={<Assign_onsite_inspector />}
          />
          <Route
            path="/legality-and-safety/:id"
            element={<Legality_and_Safety />}
          />
          <Route
            path="/maintenance/reforestation_area_form/:id"
            element={<Reforestation_area_form />}
          />
          <Route
            path="/analysis/multicriteria-analysis/:id"
            element={<Multicriteria_analysis />}
          />
          <Route path="/reforestation/site/:id" element={<Sites />} />
          <Route
            path="/reforestation_analysis/site_analysis/:id"
            element={<Sites_analysis />}
          />
          <Route
            path="/reforestation_area_site"
            element={<Reforestation_area_site />}
          />
          <Route
            path="/reforestation_area_analysis"
            element={<Reforestation_area_analysis />}
          />
          <Route path="/maintenance/barangays/" element={<Barangays />} />
          <Route path="/maintenance/tree-species" element={<Tree_species />} />
          <Route path="/maintenance/soils" element={<Soils />} />

          <Route path="/Log-trail" element={<LogTrail />} />
          <Route
            path="/reforestation-areas"
            element={<Reforestation_areas />}
          />
          <Route path="/analysis" element={<Analysis />} />

          <Route path="/analysis" element={<Analysis />} />
          <Route path="/site-verification" element={<SiteVerification />} />
          <Route
            path="/official-planting-sites"
            element={<OfficailPlantingSites />}
          />

          <Route path="/map" element={<Map />} />
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
