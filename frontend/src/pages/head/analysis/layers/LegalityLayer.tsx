// src/pages/multicriteria/layers/LegalityLayer.tsx
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, CircleMarker, useMapEvents } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, CheckCircle, AlertTriangle } from 'lucide-react';
import type { LayerData, SiteData } from '../types/mcda';

// Fix Leaflet marker icon issue
const customMarkerIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface Props {
  siteData: SiteData | null;
  layerData?: LayerData;
  isLoading: boolean;
  onSubmit: (data: Record<string, any>, comment?: string) => Promise<boolean>;
}

// Component to handle map clicks for marker placement
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LegalityLayer({ siteData, layerData, isLoading, onSubmit }: Props) {
  // Form state
  const [complianceStatus, setComplianceStatus] = useState<'Compliant' | 'Pending' | 'Disputed' | 'Illegal'| ''>('');
  const [inspectorComment, setInspectorComment] = useState('');
  const [leaderComment, setLeaderComment] = useState(layerData?.leader_comment || '');
  
  // Map state
  const [polygonCoords, setPolygonCoords] = useState<[number, number][]>([]);
  const [markerCoord, setMarkerCoord] = useState<[number, number] | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tempPolygon, setTempPolygon] = useState<[number, number][]>([]);
  
  // Default map center (Philippines - adjust based on your site location)
  const defaultCenter: [number, number] = [11.0045, 124.6055];
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter);

  // Load existing data if already submitted
  useEffect(() => {
    if (layerData?.final_agreed_data) {
      const coords = layerData.final_agreed_data.polygon_coordinates?.[0] || [];
      setPolygonCoords(coords);
      setMarkerCoord(layerData.final_agreed_data.marker_coordinate || null);
      setComplianceStatus(layerData.result?.status_input || '');
      setInspectorComment(layerData.final_agreed_data.inspector_comment || '');
    }
  }, [layerData]);

  // Handle map click for marker placement
  const handleMapClick = (lat: number, lng: number) => {
    if (isDrawing) {
      // Add point to polygon
      setTempPolygon(prev => [...prev, [lat, lng]]);
    } else if (!markerCoord) {
      // Place marker if none exists
      setMarkerCoord([lat, lng]);
    }
  };

  // Complete polygon drawing
  const completePolygon = () => {
    if (tempPolygon.length >= 3) {
      // Close the polygon by adding first point at the end
      const closedPolygon = [...tempPolygon, tempPolygon[0]];
      setPolygonCoords(closedPolygon);
      setTempPolygon([]);
      setIsDrawing(false);
      
      // Calculate center for map view
      const lats = tempPolygon.map(p => p[0]);
      const lngs = tempPolygon.map(p => p[1]);
      const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
      setMapCenter([centerLat, centerLng]);
    }
  };

  // Clear polygon
  const clearPolygon = () => {
    setPolygonCoords([]);
    setTempPolygon([]);
    setIsDrawing(false);
  };

  // Clear marker
  const clearMarker = () => {
    setMarkerCoord(null);
  };

  // Calculate approximate area (simplified Haversine formula)
  const calculateArea = () => {
    if (polygonCoords.length < 3) return 0;
    
    // Simplified area calculation (for display purposes)
    // In production, use a proper geodesic library like turf.js
    let area = 0;
    const coords = polygonCoords.slice(0, -1); // Remove duplicate last point
    
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length;
      area += coords[i][1] * coords[j][0];
      area -= coords[j][1] * coords[i][0];
    }
    
    area = Math.abs(area) / 2;
    // Convert to approximate hectares (very rough estimate)
    return (area * 111320 * 111320 / 10000).toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (polygonCoords.length < 3) {
      alert('Please draw a polygon boundary (minimum 3 points)');
      return;
    }
    
    if (!markerCoord) {
      alert('Please place a marker to verify boundary location');
      return;
    }
    
    if (!complianceStatus) {
      alert('Please select compliance status');
      return;
    }

    const finalAgreedData = {
      polygon_coordinates: [polygonCoords],
      marker_coordinate: markerCoord,
      compliance_status: complianceStatus,
      inspector_comment: inspectorComment,
      area_hectares: parseFloat(calculateArea())
    };

    const success = await onSubmit(finalAgreedData, leaderComment);
    if (success) {
      // Optionally reset or keep data
    }
  };

  // ============ READ-ONLY VIEW (After Submission) ============
  if (layerData?.result) {
    const isVeto = layerData.result.critical_flag;
    const isRejected = layerData.result.verdict === 'AUTO_REJECT';
    
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span>⚖️</span> Legality Assessment
            </h3>
            <p className="text-sm text-gray-500 mt-1">Land Tenure & Boundary Verification</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
              isRejected || isVeto
                ? 'bg-red-100 text-red-700 border-2 border-red-300'
                : layerData.result.verdict === 'PASS'
                  ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                  : 'bg-amber-100 text-amber-700 border-2 border-amber-300'
            }`}>
              {isVeto && '⚠️ VETO - '}
              {layerData.result.verdict}
            </span>
            {layerData.final_agreed_data.area_hectares && (
              <span className="text-xs text-gray-500">
                Area: {layerData.final_agreed_data.area_hectares} hectares
              </span>
            )}
          </div>
        </div>

        {/* Map Preview */}
        {polygonCoords.length > 0 && (
          <div className="mb-6 rounded-xl overflow-hidden border-2 border-gray-200">
            <MapContainer
              center={markerCoord || defaultCenter}
              zoom={18}
              style={{ height: '300px', width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Polygon 
                positions={polygonCoords} 
                pathOptions={{ color: isRejected ? '#ef4444' : '#10b981', fillColor: isRejected ? '#fecaca' : '#d1fae5', fillOpacity: 0.5 }}
              />
              {markerCoord && (
                <Marker position={markerCoord} icon={customMarkerIcon}>
                  <div>Boundary Verification Point</div>
                </Marker>
              )}
            </MapContainer>
          </div>
        )}

        {/* Submitted Data Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <CheckCircle size={18} className="text-emerald-600" />
              Boundary Information
            </h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Compliance Status:</span>
                <p className="font-semibold text-gray-800 mt-0.5">
                  {layerData.final_agreed_data.compliance_status}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Polygon Points:</span>
                <p className="font-mono text-xs text-gray-600 mt-0.5">
                  {polygonCoords.length} vertices defined
                </p>
              </div>
              <div>
                <span className="text-gray-500">Verification Marker:</span>
                <p className="font-mono text-xs text-gray-600 mt-0.5">
                  {markerCoord?.[0].toFixed(6)}, {markerCoord?.[1].toFixed(6)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3">Inspector Notes</h4>
            <p className="text-sm text-gray-600 italic">
              {layerData.final_agreed_data.inspector_comment || 'No comments provided'}
            </p>
          </div>
        </div>

        {/* Calculated Result */}
        <div className={`rounded-xl p-5 border-2 ${
          isRejected 
            ? 'bg-red-50 border-red-200' 
            : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100'
        }`}>
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            📊 Calculated Result
            {isVeto && <AlertTriangle size={18} className="text-red-600" />}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 block text-xs">Normalized Score</span>
              <strong className="text-lg text-gray-800">{layerData.result.normalized_score}/100</strong>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Weight</span>
              <strong className="text-lg text-gray-800">{layerData.result.weight_percentage}%</strong>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Weighted Score</span>
              <strong className="text-lg text-emerald-600">+{layerData.result.weighted_score}</strong>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Veto Status</span>
              <strong className={`text-lg ${isVeto ? 'text-red-600' : 'text-emerald-600'}`}>
                {isVeto ? '⚠️ YES' : 'No'}
              </strong>
            </div>
          </div>
          
          {layerData.result.remark && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm">
                <span className="font-medium text-gray-700">Remark:</span>
                <span className="text-gray-600 ml-2">{layerData.result.remark}</span>
              </p>
            </div>
          )}
          
          {layerData.result.derived_mitigation && layerData.result.derived_mitigation !== 'None.' && (
            <div className="mt-2">
              <p className="text-sm">
                <span className="font-medium text-gray-700">Required Action:</span>
                <span className="text-gray-600 ml-2">{layerData.result.derived_mitigation}</span>
              </p>
            </div>
          )}
        </div>

        {/* Leader Comment */}
        {layerData.leader_comment && (
          <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
            <p className="text-xs text-indigo-600 uppercase font-semibold mb-1">Leader Consensus Notes</p>
            <p className="text-sm text-gray-700">{layerData.leader_comment}</p>
          </div>
        )}
      </div>
    );
  }

  // ============ EDIT FORM (Leader Input) ============
  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <span>⚖️</span> Legality Assessment
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Define project boundary and verify legal compliance
        </p>
      </div>

      {/* Map Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-semibold text-gray-700">
            1. Draw Project Boundary (Polygon)
          </label>
          <div className="flex gap-2">
            {!isDrawing ? (
              <button
                type="button"
                onClick={() => setIsDrawing(true)}
                disabled={polygonCoords.length > 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ✏️
                Draw Polygon
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={completePolygon}
                  disabled={tempPolygon.length < 3}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle size={16} />
                  Complete ({tempPolygon.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawing(false);
                    setTempPolygon([]);
                  }}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
            {polygonCoords.length > 0 && (
              <button
                type="button"
                onClick={clearPolygon}
                className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-200 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Map Container */}
        <div className="rounded-xl overflow-hidden border-2 border-gray-200 relative">
          <MapContainer
            center={mapCenter}
            zoom={18}
            style={{ height: '350px', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onMapClick={handleMapClick} />
            
            {/* Existing Polygon */}
            {polygonCoords.length > 0 && (
              <Polygon 
                positions={polygonCoords} 
                pathOptions={{ color: '#10b981', fillColor: '#d1fae5', fillOpacity: 0.5, weight: 3 }}
              />
            )}
            
            {/* Temporary Polygon while drawing */}
            {tempPolygon.length > 0 && (
              <Polygon 
                positions={[...tempPolygon, tempPolygon[0]]} 
                pathOptions={{ color: '#3b82f6', fillColor: '#dbeafe', fillOpacity: 0.3, dashArray: '5,5' }}
              />
            )}
            
            {/* Marker */}
            {markerCoord && (
              <Marker position={markerCoord} icon={customMarkerIcon}>
                <div>Boundary Verification Point</div>
              </Marker>
            )}
          </MapContainer>
          
          {/* Map Instructions Overlay */}
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-md text-xs">
            {isDrawing ? (
              <p className="text-blue-700 font-medium">
                📍 Click on map to add polygon points (min. 3)
              </p>
            ) : markerCoord ? (
              <p className="text-gray-600">
                ✓ Marker placed at {markerCoord[0].toFixed(4)}, {markerCoord[1].toFixed(4)}
              </p>
            ) : (
              <p className="text-gray-600">
                📍 Click anywhere to place verification marker
              </p>
            )}
            {polygonCoords.length > 0 && (
              <p className="text-emerald-600 font-medium mt-1">
                Area: ~{calculateArea()} hectares
              </p>
            )}
          </div>
        </div>

        {/* Marker Placement Section */}
        <div className="mt-3 flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-emerald-600" />
            <span className="text-sm font-medium text-gray-700">Boundary Verification Marker</span>
          </div>
          {!markerCoord ? (
            <span className="text-xs text-gray-500">Click on map to place</span>
          ) : (
            <button
              type="button"
              onClick={clearMarker}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium"
            >
              Remove Marker
            </button>
          )}
        </div>
      </div>

      {/* Compliance Status */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          2. Compliance Status <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            complianceStatus === 'Compliant' 
              ? 'border-emerald-500 bg-emerald-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input
              type="radio"
              name="complianceStatus"
              value="Compliant"
              checked={complianceStatus === 'Compliant'}
              onChange={(e) => setComplianceStatus(e.target.value as any)}
              className="w-4 h-4 text-emerald-600"
            />
            <div>
              <span className="font-semibold text-gray-800 block">Compliant</span>
              <span className="text-xs text-gray-500">All DENR clearances valid</span>
            </div>
            <span className="ml-auto text-2xl">✅</span>
          </label>

          <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            complianceStatus === 'Pending' 
              ? 'border-amber-500 bg-amber-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input
              type="radio"
              name="complianceStatus"
              value="Pending"
              checked={complianceStatus === 'Pending'}
              onChange={(e) => setComplianceStatus(e.target.value as any)}
              className="w-4 h-4 text-amber-600"
            />
            <div>
              <span className="font-semibold text-gray-800 block">Pending</span>
              <span className="text-xs text-gray-500">Documentation incomplete</span>
            </div>
            <span className="ml-auto text-2xl">⏳</span>
          </label>

          <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            complianceStatus === 'Disputed' 
              ? 'border-red-500 bg-red-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input
              type="radio"
              name="complianceStatus"
              value="Disputed"
              checked={complianceStatus === 'Disputed'}
              onChange={(e) => setComplianceStatus(e.target.value as any)}
              className="w-4 h-4 text-red-600"
            />
            <div>
              <span className="font-semibold text-gray-800 block">Disputed</span>
              <span className="text-xs text-gray-500">Land ownership conflict</span>
            </div>
            <span className="ml-auto text-2xl">⚠️</span>
          </label>

          <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            complianceStatus === 'Illegal' 
              ? 'border-red-500 bg-red-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input
              type="radio"
              name="complianceStatus"
              value="Illegal"
              checked={complianceStatus === 'Illegal'}
              onChange={(e) => setComplianceStatus(e.target.value as any)}
              className="w-4 h-4 text-red-600"
            />
            <div>
              <span className="font-semibold text-gray-800 block">Illegal</span>
              <span className="text-xs text-gray-500">Protected area / No consent</span>
            </div>
            <span className="ml-auto text-2xl">❌</span>
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          ⚠️ <strong>Warning:</strong> "Disputed" or "Illegal" status will trigger automatic rejection (Veto)
        </p>
      </div>

      {/* Inspector Comment */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          3. Inspector Comments
        </label>
        <textarea
          value={inspectorComment}
          onChange={(e) => setInspectorComment(e.target.value)}
          placeholder="e.g., Boundary verified with concrete markers. No disputes observed with neighboring landowners..."
          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
          rows={3}
        />
      </div>

      {/* Leader Consensus Comment */}
      <div className="mb-6 pb-6 border-b border-gray-100">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Leader Consensus Comment
        </label>
        <textarea
          value={leaderComment}
          onChange={(e) => setLeaderComment(e.target.value)}
          placeholder="Document the team's agreed assessment on legal status..."
          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          rows={2}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || polygonCoords.length < 3 || !markerCoord || !complianceStatus}
        className={`w-full py-3.5 px-6 rounded-xl font-semibold transition-all ${
          !isLoading && polygonCoords.length >= 3 && markerCoord && complianceStatus
            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⏳</span> Submitting Legality Assessment...
          </span>
        ) : (
          '💾 Save Legality Assessment (20% Weight)'
        )}
      </button>

      {/* Validation Warnings */}
      {(polygonCoords.length < 3 || !markerCoord || !complianceStatus) && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 font-medium mb-1">⚠️ Incomplete Assessment</p>
          <ul className="text-xs text-amber-700 space-y-1">
            {polygonCoords.length < 3 && <li>• Draw a polygon boundary (minimum 3 points)</li>}
            {!markerCoord && <li>• Place a verification marker on the map</li>}
            {!complianceStatus && <li>• Select compliance status</li>}
          </ul>
        </div>
      )}
    </form>
  );
}