// src/pages/multicriteria/layers/AccessibilityLayer.tsx
import { useState, useEffect } from 'react';
import { Truck, Footprints, AlertTriangle, CheckCircle, MapPin } from 'lucide-react';
import type { LayerData, SiteData } from '../types/mcda';

interface Props {
  siteData: SiteData | null;
  layerData?: LayerData;
  isLoading: boolean;
  onSubmit: (data: Record<string, any>, comment?: string) => Promise<boolean>;
}

// Road condition options
const ROAD_CONDITIONS = [
  { value: 'Paved', label: '🛣️ Paved/Concrete', desc: 'All-weather access' },
  { value: 'Unpaved / Dry', label: '🪨 Unpaved / Dry', desc: 'Passable in dry season' },
  { value: 'Unpaved / Muddy', label: '🌧️ Unpaved / Muddy', desc: 'Difficult in rain' },
  { value: 'Trail Only', label: '🥾 Trail / Footpath', desc: 'No vehicle access' },
  { value: 'None', label: '❌ No Access', desc: 'Requires clearing' }
];

// Vehicle access options
const VEHICLE_OPTIONS = [
  { value: '2WD OK', label: '🚙 2WD / Standard Vehicle' },
  { value: '4WD Only', label: '🚙 4WD / AWD Required' },
  { value: 'Motorcycle Only', label: '🏍️ Motorcycle / Habal-habal' },
  { value: 'None - Manual Carry', label: '🚶 Manual Carrying Only' }
];

// Auto-calculate access category based on distance + road condition
const calculateAccessCategory = (distance: number, roadCondition: string): string => {
  if (roadCondition === 'None') return 'Inaccessible';
  if (distance < 200 && (roadCondition === 'Paved' || roadCondition === 'Unpaved / Dry')) return 'Easy';
  if (distance <= 500) return 'Moderate';
  if (distance > 500 || roadCondition === 'Unpaved / Muddy' || roadCondition === 'Trail Only') return 'Difficult';
  return 'Moderate';
};

export default function AccessibilityLayer({ siteData, layerData, isLoading, onSubmit }: Props) {
  // Form state
  const [roadCondition, setRoadCondition] = useState('');
  const [distance, setDistance] = useState('');
  const [vehicleAccess, setVehicleAccess] = useState('');
  const [walkingTime, setWalkingTime] = useState('');
  const [inspectorComment, setInspectorComment] = useState('');
  const [leaderComment, setLeaderComment] = useState(layerData?.leader_comment || '');

  // Computed: Auto-calculated access category
  const accessCategory = calculateAccessCategory(
    parseInt(distance) || 0,
    roadCondition
  );

  // Load existing data if already submitted
  useEffect(() => {
    if (layerData?.final_agreed_data) {
      setRoadCondition(layerData.final_agreed_data.road_condition || '');
      setDistance(String(layerData.final_agreed_data.distance_to_road_meters || ''));
      setVehicleAccess(layerData.final_agreed_data.vehicle_access || '');
      setWalkingTime(String(layerData.final_agreed_data.walking_time_minutes || ''));
      setInspectorComment(layerData.final_agreed_data.inspector_comment || '');
    }
  }, [layerData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const dist = parseInt(distance, 10);
    const walkTime = parseInt(walkingTime, 10);
    
    if (isNaN(dist) || dist < 0) {
      alert('Please enter a valid distance to road (meters)');
      return;
    }
    if (!roadCondition) {
      alert('Please select road condition');
      return;
    }
    if (!vehicleAccess) {
      alert('Please select vehicle access type');
      return;
    }
    if (isNaN(walkTime) || walkTime < 0) {
      alert('Please enter valid walking time (minutes)');
      return;
    }

    const finalAgreedData = {
      road_condition: roadCondition,
      distance_to_road_meters: dist,
      vehicle_access: vehicleAccess,
      walking_time_minutes: walkTime,
      access_category: accessCategory, // Auto-calculated for scoring
      inspector_comment: inspectorComment
    };

    await onSubmit(finalAgreedData, leaderComment);
  };

  // ============ READ-ONLY VIEW (After Submission) ============
  if (layerData?.result) {
    const isVeto = layerData.result.critical_flag;
    const isWarning = layerData.result.verdict === 'WARNING' || layerData.result.verdict === 'FAIL';
    
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span>🚶</span> Accessibility Assessment
            </h3>
            <p className="text-sm text-gray-500 mt-1">Logistics feasibility & transport analysis</p>
          </div>
          <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
            isVeto ? 'bg-red-100 text-red-700' : 
            isWarning ? 'bg-orange-100 text-orange-700' : 
            'bg-emerald-100 text-emerald-700'
          }`}>
            {layerData.result.verdict}
          </span>
        </div>

        {/* Submitted Data Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Road & Distance */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <MapPin size={18} className="text-blue-600" />
              Access Route
            </h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Road Condition:</span>
                <p className="font-semibold text-gray-800 mt-0.5">
                  {ROAD_CONDITIONS.find(r => r.value === layerData.final_agreed_data.road_condition)?.label || layerData.final_agreed_data.road_condition}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Distance to Main Road:</span>
                <p className="font-semibold text-gray-800 mt-0.5">
                  {layerData.final_agreed_data.distance_to_road_meters?.toLocaleString()} meters
                </p>
              </div>
              <div>
                <span className="text-gray-500">Access Category:</span>
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  accessCategory === 'Easy' ? 'bg-emerald-100 text-emerald-800' :
                  accessCategory === 'Moderate' ? 'bg-amber-100 text-amber-800' :
                  accessCategory === 'Difficult' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {accessCategory}
                </span>
              </div>
            </div>
          </div>

          {/* Transport & Time */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Truck size={18} className="text-emerald-600" />
              Transport Requirements
            </h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Vehicle Access:</span>
                <p className="font-medium text-gray-800 mt-0.5">
                  {VEHICLE_OPTIONS.find(v => v.value === layerData.final_agreed_data.vehicle_access)?.label || layerData.final_agreed_data.vehicle_access}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Walking Time:</span>
                <p className="font-semibold text-gray-800 mt-0.5">
                  ~{layerData.final_agreed_data.walking_time_minutes} minutes
                </p>
              </div>
              <div>
                <span className="text-gray-500">Field Notes:</span>
                <p className="text-gray-600 italic mt-0.5">
                  {layerData.final_agreed_data.inspector_comment || 'None'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Calculated Result */}
        <div className={`rounded-xl p-5 border-2 ${
          isVeto ? 'bg-red-50 border-red-200' : 
          isWarning ? 'bg-orange-50 border-orange-200' : 
          'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100'
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
              <strong className={`text-lg ${isVeto ? 'text-red-600' : 'text-emerald-600'}`}>
                +{layerData.result.weighted_score}
              </strong>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Veto</span>
              <strong className={`text-lg ${isVeto ? 'text-red-600' : 'text-emerald-600'}`}>
                {isVeto ? '⚠️ YES' : 'No'}
              </strong>
            </div>
          </div>
          
          {layerData.result.derived_mitigation && layerData.result.derived_mitigation !== 'None.' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm">
                <span className="font-medium text-gray-700">Logistics Mitigation:</span>
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
          <span>🚶</span> Accessibility Assessment
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Evaluate transport feasibility and logistics costs
        </p>
      </div>

      {/* Road Condition */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-semibold text-gray-800 mb-4">1. Road Condition</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ROAD_CONDITIONS.map((road) => (
            <label 
              key={road.value}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                roadCondition === road.value 
                  ? 'border-emerald-500 bg-emerald-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="roadCondition"
                value={road.value}
                checked={roadCondition === road.value}
                onChange={(e) => setRoadCondition(e.target.value)}
                className="mt-1 w-4 h-4 text-emerald-600"
              />
              <div>
                <span className="font-semibold text-gray-800 block">{road.label}</span>
                <span className="text-xs text-gray-500">{road.desc}</span>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Distance & Walking Time */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-semibold text-gray-800 mb-4">2. Distance & Time</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Distance to Main Road (meters) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="10"
                required
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className="w-full p-3 pr-16 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg font-mono"
                placeholder="e.g., 450"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">meters</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {parseInt(distance) < 200 ? '✅ Easy access' : 
               parseInt(distance) <= 500 ? '⚠️ Moderate distance' : 
               '❌ Far - higher logistics cost'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Walking Time (minutes) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="5"
                required
                value={walkingTime}
                onChange={(e) => setWalkingTime(e.target.value)}
                className="w-full p-3 pr-16 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg font-mono"
                placeholder="e.g., 15"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">minutes</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Estimate from road to planting area
            </p>
          </div>
        </div>
      </fieldset>

      {/* Vehicle Access */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-semibold text-gray-800 mb-4">3. Vehicle Access</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {VEHICLE_OPTIONS.map((vehicle) => (
            <label 
              key={vehicle.value}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                vehicleAccess === vehicle.value 
                  ? 'border-emerald-500 bg-emerald-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="vehicleAccess"
                value={vehicle.value}
                checked={vehicleAccess === vehicle.value}
                onChange={(e) => setVehicleAccess(e.target.value)}
                className="w-4 h-4 text-emerald-600"
              />
              <span className="font-medium text-gray-700">{vehicle.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Inspector Comment */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Field Notes
        </label>
        <textarea
          value={inspectorComment}
          onChange={(e) => setInspectorComment(e.target.value)}
          placeholder="e.g., Path clears up after the bridge. Muddy during rainy season..."
          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
          rows={3}
        />
      </div>

      {/* Auto-Calculated Access Category Preview */}
      {roadCondition && distance && (
        <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-blue-600" />
            <span className="font-semibold text-blue-800">Auto-Calculated Access Category</span>
          </div>
          <p className="text-sm text-blue-700">
            Based on <strong>{distance}m</strong> + <strong>{ROAD_CONDITIONS.find(r => r.value === roadCondition)?.label}</strong>:
          </p>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold mt-2 ${
            accessCategory === 'Easy' ? 'bg-emerald-100 text-emerald-800' :
            accessCategory === 'Moderate' ? 'bg-amber-100 text-amber-800' :
            accessCategory === 'Difficult' ? 'bg-orange-100 text-orange-800' :
            'bg-red-100 text-red-800'
          }`}>
            {accessCategory}
          </span>
          <p className="text-xs text-blue-600 mt-2">
            This category determines your score per MCDA config rules.
          </p>
        </div>
      )}

      {/* Leader Consensus Comment */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Leader Consensus Comment
        </label>
        <textarea
          value={leaderComment}
          onChange={(e) => setLeaderComment(e.target.value)}
          placeholder="Document team agreement on logistics feasibility and cost considerations..."
          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          rows={2}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !roadCondition || !distance || !vehicleAccess || !walkingTime}
        className={`w-full py-3.5 px-6 rounded-xl font-semibold transition-all ${
          !isLoading && roadCondition && distance && vehicleAccess && walkingTime
            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⏳</span> Submitting Accessibility Assessment...
          </span>
        ) : (
          '💾 Save Accessibility Assessment (10% Weight)'
        )}
      </button>

      {/* Validation Warnings */}
      {(!roadCondition || !distance || !vehicleAccess || !walkingTime) && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 font-medium mb-1">⚠️ Incomplete Assessment</p>
          <ul className="text-xs text-amber-700 space-y-1">
            {!roadCondition && <li>• Select road condition</li>}
            {!distance && <li>• Enter distance to main road</li>}
            {!vehicleAccess && <li>• Select vehicle access type</li>}
            {!walkingTime && <li>• Enter estimated walking time</li>}
          </ul>
        </div>
      )}
    </form>
  );
}