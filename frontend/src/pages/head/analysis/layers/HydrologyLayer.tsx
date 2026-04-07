// src/pages/multicriteria/layers/HydrologyLayer.tsx
import { useState, useEffect } from 'react';
import { Droplets, AlertTriangle, CheckCircle } from 'lucide-react';
import type { LayerData, SiteData } from '../types/mcda';

interface Props {
  siteData: SiteData | null;
  layerData?: LayerData;
  isLoading: boolean;
  onSubmit: (data: Record<string, any>, comment?: string) => Promise<boolean>;
}

// Water source types
const WATER_SOURCE_TYPES = [
  { value: 'Stream', label: '🌊 Stream/Creek', desc: 'Flowing water body' },
  { value: 'River', label: '🏞️ River', desc: 'Large permanent water body' },
  { value: 'Spring', label: '💧 Natural Spring', desc: 'Groundwater emergence' },
  { value: 'Well', label: '🪣 Well/Deep Well', desc: 'Manual or mechanical pump' },
  { value: 'Seasonal Creek', label: '🌧️ Seasonal Creek', desc: 'Dry during summer' },
  { value: 'None', label: '❌ No Source', desc: 'No viable water source' }
];

// Flow status options
const FLOW_STATUS_OPTIONS = [
  { value: 'Perennial', label: 'Perennial (Year-round)', desc: 'Reliable throughout the year', icon: '✅' },
  { value: 'Seasonal', label: 'Seasonal (Rainy only)', desc: 'Dries up in summer', icon: '⚠️' }
];

// Auto-calculate water security category
const calculateWaterSecurity = (
  distance: number,
  flowStatus: string,
  hasSource: boolean
): string => {
  if (!hasSource || distance > 1000) return 'None';
  if (distance < 100 && flowStatus === 'Perennial') return 'Near';
  if (distance <= 300) return 'Moderate';
  return 'Far';
};

export default function HydrologyLayer({ siteData, layerData, isLoading, onSubmit }: Props) {
  // Form state
  const [sourceType, setSourceType] = useState('');
  const [distance, setDistance] = useState('');
  const [flowStatus, setFlowStatus] = useState('');
  const [pumpingFeasible, setPumpingFeasible] = useState<boolean | null>(null);
  const [inspectorComment, setInspectorComment] = useState('');
  const [leaderComment, setLeaderComment] = useState(layerData?.leader_comment || '');

  // Computed: Auto-calculated water security
  const waterSecurity = calculateWaterSecurity(
    parseInt(distance) || 9999,
    flowStatus,
    sourceType !== 'None'
  );

  // Load existing data if already submitted
  useEffect(() => {
    if (layerData?.final_agreed_data) {
      setSourceType(layerData.final_agreed_data.nearest_source_type || '');
      setDistance(String(layerData.final_agreed_data.distance_meters || ''));
      setFlowStatus(layerData.final_agreed_data.water_flow_status || '');
      setPumpingFeasible(layerData.final_agreed_data.pumping_feasible ?? null);
      setInspectorComment(layerData.final_agreed_data.inspector_comment || '');
    }
  }, [layerData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const dist = parseInt(distance, 10);
    
    if (sourceType === 'None') {
      alert('Please confirm: No water source means automatic FAIL. Proceed?');
    }
    
    if (sourceType && sourceType !== 'None' && (isNaN(dist) || dist < 0)) {
      alert('Please enter a valid distance to water source (meters)');
      return;
    }
    if (!flowStatus && sourceType !== 'None') {
      alert('Please select water flow status');
      return;
    }

    const finalAgreedData = {
      nearest_source_type: sourceType,
      distance_meters: sourceType === 'None' ? null : dist,
      water_flow_status: flowStatus || null,
      pumping_feasible: pumpingFeasible ?? false,
      water_security: waterSecurity, // Auto-calculated for scoring
      inspector_comment: inspectorComment
    };

    await onSubmit(finalAgreedData, leaderComment);
  };

  // ============ READ-ONLY VIEW (After Submission) ============
  if (layerData?.result) {
    const isVeto = layerData.result.critical_flag;
    const isWarning = layerData.result.verdict === 'WARNING' || layerData.result.verdict === 'FAIL';
    const noWater = sourceType === 'None';
    
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span>💧</span> Hydrology Assessment
            </h3>
            <p className="text-sm text-gray-500 mt-1">Water source availability & irrigation feasibility</p>
          </div>
          <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
            isVeto ? 'bg-red-100 text-red-700' : 
            isWarning ? 'bg-orange-100 text-orange-700' : 
            'bg-emerald-100 text-emerald-700'
          }`}>
            {layerData.result.verdict}
          </span>
        </div>

        {/* No Water Warning */}
        {noWater && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle size={24} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-800">No Water Source Identified</h4>
                <p className="text-sm text-red-700 mt-1">
                  This site has no viable water source within reasonable distance. Seedling survival rate will be critically low without major irrigation infrastructure.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Submitted Data Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Water Source Info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Droplets size={18} className="text-blue-600" />
              Water Source Details
            </h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Source Type:</span>
                <p className="font-semibold text-gray-800 mt-0.5">
                  {WATER_SOURCE_TYPES.find(s => s.value === layerData.final_agreed_data.nearest_source_type)?.label || layerData.final_agreed_data.nearest_source_type}
                </p>
              </div>
              {layerData.final_agreed_data.distance_meters && (
                <div>
                  <span className="text-gray-500">Distance:</span>
                  <p className="font-semibold text-gray-800 mt-0.5">
                    {layerData.final_agreed_data.distance_meters?.toLocaleString()} meters
                  </p>
                </div>
              )}
              {layerData.final_agreed_data.water_flow_status && (
                <div>
                  <span className="text-gray-500">Flow Status:</span>
                  <p className="font-medium text-gray-800 mt-0.5">
                    {FLOW_STATUS_OPTIONS.find(f => f.value === layerData.final_agreed_data.water_flow_status)?.label || layerData.final_agreed_data.water_flow_status}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Irrigation Feasibility */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            🫗
              Irrigation Options
            </h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Pumping Feasible:</span>
                <p className={`font-semibold mt-0.5 ${layerData.final_agreed_data.pumping_feasible ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {layerData.final_agreed_data.pumping_feasible ? '✅ Yes - Mechanical irrigation possible' : '⚠️ No - Manual water hauling required'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Water Security:</span>
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  waterSecurity === 'Near' ? 'bg-emerald-100 text-emerald-800' :
                  waterSecurity === 'Moderate' ? 'bg-amber-100 text-amber-800' :
                  waterSecurity === 'Far' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {waterSecurity.toUpperCase()}
                </span>
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
                <span className="font-medium text-gray-700">Water Management Plan:</span>
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
          <span>💧</span> Hydrology Assessment
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Evaluate water availability for sapling survival and irrigation planning
        </p>
      </div>

      {/* Water Source Type */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-semibold text-gray-800 mb-4">1. Nearest Water Source</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {WATER_SOURCE_TYPES.map((source) => (
            <label 
              key={source.value}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                sourceType === source.value 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              } ${source.value === 'None' ? 'border-red-200 hover:border-red-300' : ''}`}
            >
              <input
                type="radio"
                name="sourceType"
                value={source.value}
                checked={sourceType === source.value}
                onChange={(e) => {
                  setSourceType(e.target.value);
                  if (e.target.value === 'None') {
                    setFlowStatus('');
                    setDistance('');
                  }
                }}
                className="mt-1 w-4 h-4 text-blue-600"
              />
              <div className="flex-1">
                <span className={`font-semibold block ${source.value === 'None' ? 'text-red-700' : 'text-gray-800'}`}>
                  {source.label}
                </span>
                <span className="text-xs text-gray-500">{source.desc}</span>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Distance & Flow Status */}
      {sourceType && sourceType !== 'None' && (
        <fieldset className="mb-6 pb-6 border-b border-gray-100">
          <legend className="font-semibold text-gray-800 mb-4">2. Distance & Reliability</legend>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Distance to Water Source (meters) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="10"
                  required
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  className="w-full p-3 pr-16 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono"
                  placeholder="e.g., 120"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">meters</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {parseInt(distance) < 100 ? '✅ Excellent - High survival rate' : 
                 parseInt(distance) <= 300 ? '⚠️ Moderate - Water hauling needed' : 
                 '❌ Far - Irrigation infrastructure required'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Water Flow Status <span className="text-rose-500">*</span>
              </label>
              <div className="space-y-2">
                {FLOW_STATUS_OPTIONS.map((flow) => (
                  <label 
                    key={flow.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      flowStatus === flow.value 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="flowStatus"
                      value={flow.value}
                      checked={flowStatus === flow.value}
                      onChange={(e) => setFlowStatus(e.target.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-lg">{flow.icon}</span>
                    <div className="flex-1">
                      <span className="font-medium text-gray-800 block">{flow.label}</span>
                      <span className="text-xs text-gray-500">{flow.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Pumping Feasibility */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Pumping/Mechanical Irrigation Feasible?
            </label>
            <div className="flex gap-4">
              <label className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                pumpingFeasible === true 
                  ? 'border-emerald-500 bg-emerald-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="pumpingFeasible"
                  checked={pumpingFeasible === true}
                  onChange={() => setPumpingFeasible(true)}
                  className="w-4 h-4 text-emerald-600"
                />
                <span className="font-semibold text-emerald-700">✅ Yes</span>
                <span className="text-sm text-gray-500">- Can install pump/pipe</span>
              </label>

              <label className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                pumpingFeasible === false 
                  ? 'border-amber-500 bg-amber-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="pumpingFeasible"
                  checked={pumpingFeasible === false}
                  onChange={() => setPumpingFeasible(false)}
                  className="w-4 h-4 text-amber-600"
                />
                <span className="font-semibold text-amber-700">⚠️ No</span>
                <span className="text-sm text-gray-500">- Manual hauling only</span>
              </label>
            </div>
          </div>
        </fieldset>
      )}

      {/* Inspector Comment */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Field Notes
        </label>
        <textarea
          value={inspectorComment}
          onChange={(e) => setInspectorComment(e.target.value)}
          placeholder="e.g., Water source is clean and accessible. Stream flow reduces in summer but doesn't dry completely..."
          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={3}
        />
      </div>

      {/* Auto-Calculated Water Security Preview */}
      {sourceType && sourceType !== 'None' && distance && flowStatus && (
        <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-blue-600" />
            <span className="font-semibold text-blue-800">Auto-Calculated Water Security</span>
          </div>
          <p className="text-sm text-blue-700">
            Based on <strong>{distance}m</strong> + <strong>{FLOW_STATUS_OPTIONS.find(f => f.value === flowStatus)?.label}</strong>:
          </p>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold mt-2 ${
            waterSecurity === 'Near' ? 'bg-emerald-100 text-emerald-800' :
            waterSecurity === 'Moderate' ? 'bg-amber-100 text-amber-800' :
            waterSecurity === 'Far' ? 'bg-orange-100 text-orange-800' :
            'bg-red-100 text-red-800'
          }`}>
            {waterSecurity.toUpperCase()}
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
          placeholder="Document team agreement on water security and irrigation strategy..."
          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          rows={2}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={
          isLoading || 
          !sourceType || 
          (sourceType !== 'None' && (!distance || !flowStatus))
        }
        className={`w-full py-3.5 px-6 rounded-xl font-semibold transition-all ${
          !isLoading && sourceType && (sourceType === 'None' || (distance && flowStatus))
            ? 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white shadow-md hover:shadow-lg'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⏳</span> Submitting Hydrology Assessment...
          </span>
        ) : sourceType === 'None' ? (
          '⚠️ Submit with NO WATER SOURCE (Auto-Fail)'
        ) : (
          '💾 Save Hydrology Assessment (10% Weight)'
        )}
      </button>

      {/* Validation Warnings */}
      {sourceType === 'None' && (
        <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
          <p className="text-sm text-red-800 font-bold mb-1">⚠️ Critical Warning</p>
          <p className="text-xs text-red-700">
            Selecting "No Source" will result in a score of 0 for this layer. The site will likely be classified as <strong>Marginally Suitable</strong> or <strong>Not Suitable</strong> unless other layers score exceptionally high.
          </p>
        </div>
      )}
      {(!sourceType || (sourceType !== 'None' && (!distance || !flowStatus))) && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 font-medium mb-1">⚠️ Incomplete Assessment</p>
          <ul className="text-xs text-amber-700 space-y-1">
            {!sourceType && <li>• Select water source type</li>}
            {sourceType !== 'None' && !distance && <li>• Enter distance to water source</li>}
            {sourceType !== 'None' && !flowStatus && <li>• Select water flow status</li>}
          </ul>
        </div>
      )}
    </form>
  );
}