// src/pages/multicriteria/layers/SlopeLayer.tsx
import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, TrendingUp, Wind } from 'lucide-react';
import type { LayerData, SiteData } from '../types/mcda';

interface Props {
  siteData: SiteData | null;
  layerData?: LayerData;
  isLoading: boolean;
  onSubmit: (data: Record<string, any>, comment?: string) => Promise<boolean>;
}

// Slope categories mapped to degree ranges (matches MCDA config)
const SLOPE_CATEGORIES = [
  { value: 'Flat/Gentle', label: 'Flat/Gentle (0-15°)', min: 0, max: 15, color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'Moderate', label: 'Moderate (16-30°)', min: 16, max: 30, color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'Steep', label: 'Steep (31-45°)', min: 31, max: 45, color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'Very Steep', label: 'Very Steep (>45°)', min: 46, max: 90, color: 'bg-red-100 text-red-800 border-red-200' }
];

const EROSION_OPTIONS = [
  { value: 'None', label: 'None - Stable soil surface' },
  { value: 'Minor sheet erosion', label: 'Minor - Slight topsoil loss' },
  { value: 'Moderate rilling', label: 'Moderate - Small channels forming' },
  { value: 'Severe gullies/slumping', label: 'Severe - Deep erosion/slides' }
];

export default function SlopeLayer({ siteData, layerData, isLoading, onSubmit }: Props) {
  // Form state
  const [slopeCategory, setSlopeCategory] = useState('');
  const [degrees, setDegrees] = useState('');
  const [erosionSigns, setErosionSigns] = useState('');
  const [inspectorComment, setInspectorComment] = useState('');
  const [leaderComment, setLeaderComment] = useState(layerData?.leader_comment || '');

  // Load existing data if already submitted
  useEffect(() => {
    if (layerData?.final_agreed_data) {
      setSlopeCategory(layerData.final_agreed_data.slope_category || '');
      setDegrees(String(layerData.final_agreed_data.visual_estimate_degrees || ''));
      setErosionSigns(layerData.final_agreed_data.erosion_signs || '');
      setInspectorComment(layerData.final_agreed_data.inspector_comment || '');
    }
  }, [layerData]);

  // Auto-calculate category from degrees input
  const handleDegreeChange = (val: string) => {
    setDegrees(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      const match = SLOPE_CATEGORIES.find(cat => num >= cat.min && num <= cat.max);
      if (match) setSlopeCategory(match.value);
    } else {
      setSlopeCategory('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!degrees || parseInt(degrees) < 0 || parseInt(degrees) > 90) {
      alert('Please enter a valid slope angle (0-90°)');
      return;
    }
    if (!slopeCategory) {
      alert('Please select a slope category');
      return;
    }

    const finalAgreedData = {
      visual_estimate_degrees: parseInt(degrees, 10),
      slope_category: slopeCategory,
      erosion_signs: erosionSigns || 'None observed',
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
              <span>📐</span> Slope & Topography Assessment
            </h3>
            <p className="text-sm text-gray-500 mt-1">Terrain steepness & erosion risk analysis</p>
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
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-600" />
              Slope Measurement
            </h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Estimated Degrees:</span>
                <p className="font-semibold text-gray-800 mt-0.5">
                  {layerData.final_agreed_data.visual_estimate_degrees}°
                </p>
              </div>
              <div>
                <span className="text-gray-500">Category:</span>
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  SLOPE_CATEGORIES.find(c => c.value === layerData.final_agreed_data.slope_category)?.color || 'bg-gray-100 text-gray-700'
                }`}>
                  {layerData.final_agreed_data.slope_category}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Wind size={18} className="text-amber-600" />
              Erosion & Stability
            </h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Erosion Signs:</span>
                <p className="font-medium text-gray-800 mt-0.5">
                  {layerData.final_agreed_data.erosion_signs}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Inspector Notes:</span>
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
                <span className="font-medium text-gray-700">Required Mitigation:</span>
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
          <span>📐</span> Slope & Topography Assessment
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Measure terrain steepness and identify erosion risks
        </p>
      </div>

      {/* Slope Measurement */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-semibold text-gray-800 mb-4">1. Slope Measurement</legend>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Degrees Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visual Estimate (Degrees) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="90"
                step="1"
                required
                value={degrees}
                onChange={(e) => handleDegreeChange(e.target.value)}
                className="w-full p-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg font-mono"
                placeholder="e.g., 25"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">°</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Use clinometer app or visual estimation guide</p>
          </div>

          {/* Auto-Calculated Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Slope Category (Auto)
            </label>
            <div className={`p-3 border rounded-xl text-sm font-medium flex items-center gap-2 ${
              slopeCategory 
                ? SLOPE_CATEGORIES.find(c => c.value === slopeCategory)?.color || 'bg-gray-50 border-gray-200'
                : 'bg-gray-50 border-gray-200 text-gray-400'
            }`}>
              {slopeCategory ? (
                <>
                  <CheckCircle size={16} className="flex-shrink-0" />
                  {SLOPE_CATEGORIES.find(c => c.value === slopeCategory)?.label}
                </>
              ) : (
                'Enter degrees to auto-calculate'
              )}
            </div>
          </div>
        </div>
      </fieldset>

      {/* Erosion & Stability */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-semibold text-gray-800 mb-4">2. Erosion & Soil Stability</legend>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observed Erosion Signs
          </label>
          <select
            value={erosionSigns}
            onChange={(e) => setErosionSigns(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">Select erosion level...</option>
            {EROSION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Inspector Field Notes
          </label>
          <textarea
            value={inspectorComment}
            onChange={(e) => setInspectorComment(e.target.value)}
            placeholder="e.g., Stable enough for planting with terracing. Some minor sheet erosion on north face..."
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            rows={3}
          />
        </div>
      </fieldset>

      {/* Leader Consensus Comment */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Leader Consensus Comment
        </label>
        <textarea
          value={leaderComment}
          onChange={(e) => setLeaderComment(e.target.value)}
          placeholder="Document team agreement on slope suitability and required controls..."
          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          rows={2}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !degrees || !slopeCategory}
        className={`w-full py-3.5 px-6 rounded-xl font-semibold transition-all ${
          !isLoading && degrees && slopeCategory
            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⏳</span> Submitting Slope Assessment...
          </span>
        ) : (
          '💾 Save Slope Assessment (10% Weight)'
        )}
      </button>

      {/* Validation Warnings */}
      {(!degrees || !slopeCategory) && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 font-medium mb-1">⚠️ Incomplete Assessment</p>
          <ul className="text-xs text-amber-700 space-y-1">
            {!degrees && <li>• Enter slope angle in degrees</li>}
            {!slopeCategory && <li>• Slope category required (auto-calculated from degrees)</li>}
          </ul>
        </div>
      )}
    </form>
  );
}