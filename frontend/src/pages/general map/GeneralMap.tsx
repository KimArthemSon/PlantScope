import Sidebar from "../../components/layout/Sidebar";

export default function GeneralMap() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar (sticky and fixed to the left) */}
      <aside className="w-64 h-full sticky top-0 bg-white shadow-md border-r">
        <Sidebar />
      </aside>

      {/* Main Content Area (scrollable) */}
      <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {/* Filter Section */}
        <section className="mb-6 bg-white p-4 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold mb-2">Filter Options</h2>
          <p className="text-sm text-gray-600">
            Add controls here for filtering data (e.g., by site, date, or vegetation type).
          </p>
        </section>

        {/* Interactive Map Section */}
        <section className="bg-white p-4 rounded-lg shadow-sm border h-[70vh]">
          <h2 className="text-lg font-semibold mb-2">Interactive Map</h2>
          <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500 italic">
              (Leaflet map will be displayed here)
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
