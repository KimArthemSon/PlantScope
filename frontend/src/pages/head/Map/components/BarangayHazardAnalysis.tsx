import { useState, useEffect } from 'react';
import { X, AlertTriangle, Info, TrendingUp, MapPin } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface HazardBreakdown {
  class: string;
  area_hectares: number;
  percentage: number;
  count: number;
  color: string;
}

interface HazardAnalysis {
  statistics: {
    total_hazard_area_hectares: number;
    breakdown: HazardBreakdown[];
    feature_count: number;
  };
  recommendations: Array<{
    severity: 'critical' | 'warning' | 'info';
    message: string;
  }>;
  source: string;
}

interface OverallRisk {
  score: number;
  level: string;
  color: string;
}

interface BarangayHazardAnalysisProps {
  isOpen: boolean;
  onClose: () => void;
  barangayId: number;
  barangayName: string;
  token: string;
}

export default function BarangayHazardAnalysis({
  isOpen,
  onClose,
  barangayId,
  barangayName,
  token
}: BarangayHazardAnalysisProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'flood' | 'landslide' | 'eil'>('flood');
  const [analysis, setAnalysis] = useState<Record<string, HazardAnalysis> | null>(null);
  const [overallRisk, setOverallRisk] = useState<OverallRisk | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && barangayId) {
      fetchAnalysis();
    }
  }, [isOpen, barangayId]);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/barangay-hazard-analysis/${barangayId}/`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setAnalysis(data.analysis);
        setOverallRisk(data.overall_risk);
      } else {
        setError(data.error || 'Failed to fetch analysis');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentAnalysis = analysis?.[activeTab];

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="text-red-600" size={16} />;
      case 'warning':
        return <AlertTriangle className="text-orange-600" size={16} />;
      default:
        return <Info className="text-blue-600" size={16} />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'warning':
        return 'bg-orange-50 border-orange-200 text-orange-900';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-900';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0f4a2f] to-[#1a6b42] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="text-white" size={24} />
            <div>
              <h2 className="text-xl font-bold text-white">
                Hazard Analysis: {barangayName}
              </h2>
              <p className="text-sm text-green-100">
                Ormoc City • Multi-Hazard Assessment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Overall Risk Badge */}
        {overallRisk && (
          <div className="bg-gray-50 border-b px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp size={20} className="text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Overall Risk Level:</span>
              <span
                className="px-3 py-1 rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: overallRisk.color }}
              >
                {overallRisk.level} ({overallRisk.score}%)
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Based on Flood, Landslide, and Earthquake-Induced Landslide analysis
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f4a2f] mx-auto mb-4"></div>
                <p className="text-gray-600">Analyzing hazard data...</p>
                <p className="text-xs text-gray-500 mt-2">
                  Querying MGB and PHIVOLCS databases
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <AlertTriangle className="text-red-600 mx-auto mb-3" size={32} />
              <p className="text-red-900 font-medium">Error Loading Analysis</p>
              <p className="text-red-700 text-sm mt-2">{error}</p>
              <button
                onClick={fetchAnalysis}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : currentAnalysis ? (
            <div className="space-y-6">
              {/* Tabs */}
              <div className="flex gap-2 border-b">
                <button
                  onClick={() => setActiveTab('flood')}
                  className={`px-4 py-2 font-medium transition-colors ${
                    activeTab === 'flood'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🌊 Flood
                </button>
                <button
                  onClick={() => setActiveTab('landslide')}
                  className={`px-4 py-2 font-medium transition-colors ${
                    activeTab === 'landslide'
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  ⛰️ Landslide
                </button>
                <button
                  onClick={() => setActiveTab('eil')}
                  className={`px-4 py-2 font-medium transition-colors ${
                    activeTab === 'eil'
                      ? 'text-purple-600 border-b-2 border-purple-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🌋 Earthquake-Induced
                </button>
              </div>

              {/* Chart and Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Susceptibility Distribution
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={currentAnalysis.statistics.breakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ class: className, percentage }) =>
                          `${className}: ${percentage}%`
                        }
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="percentage"
                      >
                        {currentAnalysis.statistics.breakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, name: any, props: any) => [
                          `${value}% (${props.payload.area_hectares} ha)`,
                          props.payload.class
                        ]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Statistics Table */}
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Detailed Statistics
                  </h3>
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm text-gray-600">Total Hazard Area</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {currentAnalysis.statistics.total_hazard_area_hectares} ha
                      </div>
                    </div>
                    
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Class</th>
                          <th className="text-right py-2">Area (ha)</th>
                          <th className="text-right py-2">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentAnalysis.statistics.breakdown.map((item, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded"
                                  style={{ backgroundColor: item.color }}
                                ></div>
                                <span className="font-medium">{item.class}</span>
                              </div>
                            </td>
                            <td className="text-right py-2">
                              {item.area_hectares}
                            </td>
                            <td className="text-right py-2 font-bold">
                              {item.percentage}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="text-xs text-gray-500 mt-3">
                      Source: {currentAnalysis.source}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {currentAnalysis.recommendations.length > 0 && (
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Info size={20} />
                    Recommendations for Reforestation
                  </h3>
                  <div className="space-y-3">
                    {currentAnalysis.recommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        className={`border-l-4 rounded-lg p-4 ${getSeverityColor(rec.severity)}`}
                      >
                        <div className="flex items-start gap-3">
                          {getSeverityIcon(rec.severity)}
                          <p className="text-sm font-medium">{rec.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explanation */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <Info size={16} />
                  What This Analysis Means
                </h4>
                <div className="text-sm text-blue-800 space-y-2">
                  <p>
                    This analysis uses official hazard maps from {currentAnalysis.source} to evaluate 
                    the susceptibility of {barangayName} to {activeTab === 'flood' ? 'flooding' : 
                    activeTab === 'landslide' ? 'rain-induced landslides' : 'earthquake-induced landslides'}.
                  </p>
                  <p>
                    The pie chart shows the distribution of different susceptibility levels within 
                    the barangay boundaries. Higher percentages in "Very High" or "High" categories 
                    indicate greater risk and require special consideration for reforestation planning.
                  </p>
                  <p>
                    <strong>Key Takeaway:</strong> {
                      overallRisk && overallRisk.score > 30
                        ? 'This barangay has significant hazard exposure. Reforestation efforts should prioritize risk mitigation and use appropriate species for high-risk zones.'
                        : 'This barangay has manageable hazard levels. Standard reforestation practices can be implemented with proper planning.'
                    }
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}