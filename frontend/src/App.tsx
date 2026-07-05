import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";

// ============ LAZY LOADED COMPONENTS ============
const Login = lazy(() => import("./pages/auth/login"));
const Dashboard = lazy(() => import("./pages/head/dashboard/dashboard"));
const Sidebar = lazy(() => import("./components/layout/Sidebar"));
const Reforestation_areas = lazy(
  () => import("./pages/head/reforestation_areas/reforestation_area"),
);
const Calendar = lazy(() => import("./pages/dataManager/calendar/calendar"));
const Registration = lazy(() => import("./pages/auth/registration"));
const OfficailPlantingSites = lazy(
  () => import("./pages/approved/official_reforestation"),
);
const SiteVerification = lazy(
  () => import("./pages/siteVerification/siteVerification"),
);
const Land_classifications = lazy(
  () => import("./pages/head/maintain/land_classification"),
);
const Soils = lazy(() => import("./pages/head/maintain/soils"));
const Tree_species = lazy(() => import("./pages/head/maintain/tree_species"));
const Privacy_policy = lazy(() => import("./pages/HomePage/privacy_policy"));
const DashboardAFA = lazy(() => import("./pages/dataManager/dashboardAFA"));
const DashboardGISS = lazy(() => import("./pages/GISSpecialist/dashboardGISS"));
const Accounts = lazy(() => import("./pages/head/accounts/accounts"));
const TreeGrowersAccounts = lazy(
  () => import("./pages/head/accounts/treeGrowersAccounts"),
);
const Barangays = lazy(() => import("./pages/head/maintain/barangay"));
const HomePage = lazy(() => import("./pages/HomePage/homepage"));
const Reforestation_area_form = lazy(
  () => import("./pages/head/reforestation_areas/reforestation_area_form"),
);
const AuditTrail = lazy(() => import("./pages/head/accounts/auditTrail"));
const Profile = lazy(() =>
  import("./pages/head/accounts/profile").then((module) => ({
    default: module.Profile,
  })),
);
const Map = lazy(() => import("./pages/head/Map/Map"));
const Classified_area_form = lazy(
  () => import("./pages/head/maintain/classified_areas/classified_area_form"),
);
const Classified_areas = lazy(
  () => import("./pages/head/maintain/classified_areas/classified_areas"),
);
const Assign_onsite_inspector = lazy(
  () => import("./pages/head/reforestation_areas/assigning"),
);
const MetaDataVerification = lazy(
  () => import("./pages/head/reforestation_areas/meta_data"),
);
const Reforestation_area_site = lazy(
  () => import("./pages/head/site/reforestation_area_site"),
);
const Sites = lazy(() => import("./pages/head/site/sites"));
const Sites_analysis = lazy(
  () => import("./pages/head/analysis/site_analysis"),
);
const Multicriteria_analysis = lazy(
  () => import("./pages/head/analysis/multicriteria_analysis"),
);
const Sidebar_data_manager = lazy(
  () => import("./components/layout/Sidebar_data_manager"),
);
const SidebarGISS = lazy(
  () => import("./components/layout/SidebarGISSpecialist"),
);
const OfficialSites = lazy(() => import("./pages/approved/OfficialSites"));
const Site_information = lazy(
  () => import("./pages/approved/site_information"),
);
const Ormoc_City = lazy(() => import("./pages/head/maintain/ormoc_city"));
const Application = lazy(
  () => import("./pages/dataManager/application/application"),
);
const Evaluation_application = lazy(
  () => import("./pages/dataManager/application/evaluation"),
);
const Evaluation_confirmation = lazy(
  () => import("./pages/head/application/evaluation_confirmation"),
);
const Application_confirmation = lazy(
  () => import("./pages/head/application/application_confirmation"),
);
const Monitoring = lazy(
  () => import("./pages/dataManager/monitoring/application"),
);
const Maintenance_report = lazy(
  () => import("./pages/dataManager/monitoring/maintenance_report"),
);
const ViewReforestationArea = lazy(
  () => import("./pages/head/reforestation_areas/view_reforestation_area"),
);
const MyProfile = lazy(() => import("./pages/dataManager/MyProfile"));
const Terms_and_Conditions = lazy(
  () => import("./pages/HomePage/terms_and_Conditions"),
);
const Request = lazy(() => import("./pages/dataManager/monitoring/request"));
const Animals = lazy(() => import("./pages/head/maintain/animals"));
const Reports = lazy(() => import("./pages/dataManager/reports/reports"));
const Hazard_areas = lazy(
  () => import("./pages/head/maintain/hazard_areas/hazard_areas"),
);
const Hazard_area_form = lazy(
  () => import("./pages/head/maintain/hazard_areas/hazard_area._form"),
);
const GISReports = lazy(() => import("./pages/GISSpecialist/report"));
const HeadReports = lazy(() => import("./pages/head/reports/headReports"));
const NotificationsPage = lazy(() => import("./pages/dataManager/Notifications/NotificationsPage"));
// ============ LOADING FALLBACK ============
function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  );
}



// ============ MAIN APP ============
export default function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Authentication */}
          <Route path="/Login" element={<Login />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/terms" element={<Terms_and_Conditions />} />
          <Route path="/privacy-policy" element={<Privacy_policy />} />
          
          {/* #head */}
          <Route element={<Sidebar />}>
            {/* Main Dashboard */}
            <Route path="/dashboard" element={<Dashboard />} />
             <Route path="/notification" element={<NotificationsPage />} />
           

            {/* maintenance */}
            <Route
              path="/maintenance/land-classification"
              element={<Land_classifications />}
            />
            <Route path="/maintenance/ormoc-city" element={<Ormoc_City />} />
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
              element={<MetaDataVerification />}
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
              path="/reforestation/site/:id/information/:site_id"
              element={<Site_information />}
            />
            <Route
              path="/reforestation_analysis/site_analysis/:id"
              element={<Sites_analysis />}
            />
            <Route
              path="/reforestation_area_site"
              element={<Reforestation_area_site />}
            />
            <Route
              path="/evaluation/:application_id"
              element={<Evaluation_confirmation />}
            />
            <Route
              path="/applications"
              element={<Application_confirmation />}
            />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/calendar" element={<Calendar />} />

            <Route path="/maintenance/barangays/" element={<Barangays />} />
            <Route
              path="/maintenance/tree-species"
              element={<Tree_species />}
            />
            <Route path="/maintenance/soils" element={<Soils />} />

            <Route path="/Log-trail" element={<AuditTrail />} />
            <Route
              path="/reforestation-areas"
              element={<Reforestation_areas />}
            />

            <Route path="/site-verification" element={<SiteVerification />} />
            <Route
              path="/official-reforestation"
              element={<OfficailPlantingSites />}
            />
            <Route
              path="/official-reforestation/site/:id"
              element={<OfficialSites />}
            />
            <Route
              path="/official-reforestation/site/:id/information/:site_id"
              element={<Site_information />}
            />
            <Route
              path="/maintenance_evaluation/:application_id"
              element={<Maintenance_report />}
            />
            <Route path="/map" element={<Map />} />
            <Route path="/my-profile" element={<MyProfile />} />

            <Route path="/reports" element={<HeadReports />} />

            <Route path="/site_suitability" element={<Accounts />} />
            <Route path="/account-management" element={<Accounts />} />
            <Route
              path="/account-management/profile/:id"
              element={<Profile />}
            />
            <Route path="/account-management/profile/" element={<Profile />} />
            <Route path="/tree-growers" element={<TreeGrowersAccounts />} />
          </Route>

          <Route element={<Sidebar_data_manager />}>
            <Route path="/dashboard-data-manager" element={<DashboardAFA />} />
            <Route path="/DataManager/notification" element={<NotificationsPage />} />
            <Route path="/DataManager/calendar" element={<Calendar />} />

            <Route
              path="/DataManager/maintenance/ormoc-city"
              element={<Ormoc_City />}
            />
            <Route
              path="/DataManager/maintenance/land-classification"
              element={<Land_classifications />}
            />

         

            <Route
              path="/DataManager/evaluation/:application_id"
              element={<Evaluation_application />}
            />
            <Route path="/DataManager/applications" element={<Application />} />
            <Route path="/DataManager/monitoring" element={<Monitoring />} />
            <Route
              path="/DataManager/maintenance_evaluation/:application_id"
              element={<Maintenance_report />}
            />
           
           
            <Route
              path="/DataManager/assign_onsite_inpsector/:id"
              element={<Assign_onsite_inspector />}
            />
            <Route
              path="/DataManager/verification/meta-data/:id"
              element={<MetaDataVerification />}
            />
            <Route
              path="/DataManager/maintenance/reforestation_area_form/:id"
              element={<Reforestation_area_form />}
            />
            <Route
              path="/DataManager/maintenance/view_reforestation_area/:id"
              element={<ViewReforestationArea />}
            />

            <Route
              path="/DataManager/reforestation/site/:id"
              element={<Sites />}
            />
            <Route
              path="/DataManager/reforestation_analysis/site_analysis/:id"
              element={<Sites_analysis />}
            />
            <Route
              path="/DataManager/reforestation_area_site"
              element={<Reforestation_area_site />}
            />

            <Route
              path="/DataManager/maintenance/barangays/"
              element={<Barangays />}
            />
            <Route
              path="/DataManager/maintenance/tree-species"
              element={<Tree_species />}
            />
            <Route
              path="/DataManager/maintenance/Animals"
              element={<Animals />}
            />
            <Route path="/DataManager/maintenance/soils" element={<Soils />} />

            <Route
              path="/DataManager/reforestation-areas"
              element={<Reforestation_areas />}
            />
            <Route path="/DataManager/request" element={<Request />} />
            <Route
              path="/DataManager/official-reforestation"
              element={<OfficailPlantingSites />}
            />
            <Route
              path="/DataManager/official-reforestation/site/:id"
              element={<OfficialSites />}
            />
            <Route
              path="/DataManager/reforestation/site/:id/information/:site_id"
              element={<Site_information />}
            />
            <Route
              path="/DataManager/official-reforestation/site/:id/information/:site_id"
              element={<Site_information />}
            />
            <Route path="/DataManager/map" element={<Map />} />
            <Route path="/DataManager/my-profile" element={<MyProfile />} />
            <Route path="/DataManager/reports" element={<Reports />} />
          </Route>

          <Route element={<SidebarGISS />}>
            <Route path="/dashboard/GISS" element={<DashboardGISS />} />
             <Route path="/GISS/notification" element={<NotificationsPage />} />
            {/* ── NEW: GISS MAINTENANCE ROUTES ── */}
            <Route
              path="/GISS/maintenance/ormoc-city"
              element={<Ormoc_City />}
            />
            <Route
              path="/GISS/maintenance/Classified_areas"
              element={<Classified_areas />}
            />
            <Route
              path="/GISS/maintenance/hazard_areas"
              element={<Hazard_areas />}
            />
            <Route
              path="/GISS/maintenance/hazard_area_form"
              element={<Hazard_area_form />}
            />
            <Route
              path="/GISS/maintenance/hazard_area_form/:id"
              element={<Hazard_area_form />}
            />
            <Route
              path="/GISS/maintenance/Classified_area_form"
              element={<Classified_area_form />}
            />
            <Route
              path="/GISS/maintenance/Classified_area_form/:id"
              element={<Classified_area_form />}
            />
            {/* ──────────────────────────────────── */}

            <Route
              path="/GISS/assign_onsite_inpsector/:id"
              element={<Assign_onsite_inspector />}
            />
            <Route
              path="/GISS/legality-and-safety/:id"
              element={<MetaDataVerification />}
            />
            <Route
              path="/GISS/maintenance/reforestation_area_form/:id"
              element={<Reforestation_area_form />}
            />
            <Route
              path="/GISS/maintenance/view_reforestation_area/:id"
              element={<ViewReforestationArea />}
            />

            <Route path="/GISS/reforestation/site/:id" element={<Sites />} />

            <Route
              path="/GISS/reforestation_area_site"
              element={<Reforestation_area_site />}
            />

            <Route
              path="/GISS/reforestation_analysis/site_analysis/:id"
              element={<Sites_analysis />}
            />
            <Route
              path="/GISS/analysis/multicriteria-analysis/:id"
              element={<Multicriteria_analysis />}
            />
            <Route
              path="/GISS/reforestation-areas"
              element={<Reforestation_areas />}
            />
            <Route
              path="/GISS/official-reforestation"
              element={<OfficailPlantingSites />}
            />
            <Route
              path="/GISS/official-reforestation/site/:id"
              element={<OfficialSites />}
            />
            <Route
              path="/GISS/reforestation/site/:id/information/:site_id"
              element={<Site_information />}
            />
            <Route
              path="/GISS/official-reforestation/site/:id/information/:site_id"
              element={<Site_information />}
            />
            <Route path="/GISS/map" element={<Map />} />
            <Route path="/GISS/my-profile" element={<MyProfile />} />
            <Route path="/GISS/reports" element={<GISReports />} />

            <Route
              path="/GISS/maintenance/hazard_area_form/"
              element={<Hazard_area_form />}
            />
            <Route
              path="/GISS/maintenance/hazard_area_form/:id"
              element={<Hazard_area_form />}
            />
            <Route
              path="/GISS/maintenance/Classified_area_form/"
              element={<Classified_area_form />}
            />
            <Route
              path="/GISS/maintenance/Classified_areas/"
              element={<Classified_areas />}
            />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}
