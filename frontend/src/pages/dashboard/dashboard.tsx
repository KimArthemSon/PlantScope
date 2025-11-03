import Sidebar from "../../components/layout/Sidebar";

export default function Dashboard() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex-1 bg-gray-50 p-8">
        <h1 className="text-3xl font-bold text-[#052e87] mb-6">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Active Sites</h2>
            <p className="text-2xl font-bold text-[#057501]">12</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Ongoing Projects</h2>
            <p className="text-2xl font-bold text-[#057501]">5</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Reports Generated</h2>
            <p className="text-2xl font-bold text-[#057501]">23</p>
          </div>
        </div>
      </div>
    </div>
  );
}
