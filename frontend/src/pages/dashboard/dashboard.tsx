import Sidebar from "../../components/layout/Sidebar";
import NotFoundPage from "../../components/layout/NotFoundPage";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useEffect, useState } from "react";

export default function Dashboard() {
  // 📊 Sample data for charts (replace with real API later)
  

  const prioritizationData = [
    { level: "High", count: 5 },
    { level: "Medium", count: 9 },
    { level: "Low", count: 3 },
  ];

  const monitoringData = [
    { month: "Jan", progress: 20 },
    { month: "Feb", progress: 35 },
    { month: "Mar", progress: 45 },
    { month: "Apr", progress: 60 },
    { month: "May", progress: 70 },
    { month: "Jun", progress: 85 },
  ];

  const statusData = [
    { name: "Ongoing", value: 10 },
    { name: "Completed", value: 6 },
    { name: "Pending", value: 4 },
  ];
    const [isAuthorize, setIsAuthorize] = useState(true);

  useEffect(() => {
      checkIfStillLogin()
    }, []);
  
     const checkIfStillLogin = async () =>{
  
     const token = localStorage.getItem("token");

     if(!token){
      return;
     }
            try {
        const response = await fetch("http://127.0.0.1:8000/api/get_me/", {
          method: "POST",
           headers: { Authorization: `Bearer ${token}` },
        });
  
        const data = await response.json();
  
        if (response.ok) {     
            
            if (!(data.user_role === "CityENROHead")) {
                 setIsAuthorize(false)    
            }
        } 
  
      } catch (error) {
         setIsAuthorize(false)
      }
     } 

  if (!localStorage.getItem('token') || !isAuthorize){
     return <NotFoundPage />
  }
 
  const COLORS = ["#057501", "#34d399", "#a7f3d0"];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 🧭 Sidebar - Fixed / Sticky */}
     
        
    
      {/* 📊 Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
        <h1 className="text-3xl font-bold text-[#052e87] mb-6">Dashboard</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              Active Sites
            </h2>
            <p className="text-3xl font-bold text-[#057501]">12</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              Ongoing Projects
            </h2>
            <p className="text-3xl font-bold text-[#057501]">5</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              Reports Generated
            </h2>
            <p className="text-3xl font-bold text-[#057501]">23</p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Bar Chart - Prioritization */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Site Prioritization Levels
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={prioritizationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="level" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#057501" barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Line Chart - Monitoring Progress */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Monitoring Progress Over Time
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monitoringData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="progress"
                  stroke="#052e87"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart - Status */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Reforestation Status Distribution
            </h2>
            <div className="flex justify-center">
              <ResponsiveContainer width="60%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={120}
                    label
                  >
                    {statusData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
