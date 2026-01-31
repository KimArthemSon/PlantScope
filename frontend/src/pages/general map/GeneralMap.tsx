import Sidebar from "../../components/layout/Sidebar";
import GenMap from "../../components/map/GenMap";

export default function GeneralMap() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 h-full sticky top-0 bg-white shadow-md border-r">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {/* 🔍 Filter Section */}
        <section className="mb-6 bg-white p-4 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold mb-3">Filter Options</h2>

          <form className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Barangay */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Barangay
              </label>
              <select className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-green-200">
                <option value="">All</option>
                <option>San Isidro</option>
                <option>Dolores</option>
                <option>Naungan</option>
                <option>Masarayao</option>
                <option>Valencia</option>
              </select>
            </div>

            {/* Purok */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Purok
              </label>
              <select className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-green-200">
                <option value="">All</option>
                <option>Purok 1</option>
                <option>Purok 2</option>
                <option>Purok 3</option>
                <option>Purok 4</option>
              </select>
            </div>

            {/* Monitoring Status */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Monitoring Status
              </label>
              <select className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-green-200">
                <option value="">All</option>
                <option>Ongoing</option>
                <option>Completed</option>
                <option>Pending</option>
              </select>
            </div>

            {/* Prioritization */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Prioritization
              </label>
              <select className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-green-200">
                <option value="">All</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Date Range
              </label>
              <input
                type="date"
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-green-200"
              />
            </div>

            {/* Search */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Site Name / ID
              </label>
              <input
                type="text"
                placeholder="Search..."
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring focus:ring-green-200"
              />
            </div>
          </form>

          {/* Buttons */}
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="reset"
              className="px-4 py-2 text-sm border rounded-md text-gray-600 hover:bg-gray-100"
            >
              Reset
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Apply Filters
            </button>
          </div>
        </section>

        {/* 🗺️ Map Section */}
        <section className="bg-white p-4 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold mb-3">Interactive Map</h2>
          <GenMap />
        </section>
      </main>
    </div>
  );
}
