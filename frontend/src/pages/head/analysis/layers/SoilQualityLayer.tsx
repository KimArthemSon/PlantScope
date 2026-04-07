// src/pages/multicriteria/layers/SoilQualityLayer.tsx
import { useState, useEffect } from 'react';
import { Leaf, AlertTriangle, CheckCircle, Database, Info, Search } from 'lucide-react';
import type { LayerData, SiteData } from '../types/mcda';

interface Soil {
  soil_id: number;
  name: string;
  description: string;
}

interface Props {
  siteData: SiteData | null;
  layerData?: LayerData;
  isLoading: boolean;
  onSubmit: (data: Record<string, any>, comment?: string) => Promise<boolean>;
  onDetailsUpdate?: (payload: { soil_id?: number | null }) => Promise<void>;
}

// Fertility status options mapped to MCDA scoring
const FERTILITY_OPTIONS = [
  { value: 'High', label: '🌿 High Fertility', desc: 'Deep loam, rich organic matter', score: 95, verdict: 'HIGHLY_SUITABLE' },
  { value: 'Moderate', label: '🌾 Moderate', desc: 'Acceptable texture, may need fertilizer', score: 70, verdict: 'PASS' },
  { value: 'Low', label: '🏜️ Low', desc: 'Sandy/Rocky or dry, needs amelioration', score: 30, verdict: 'WARNING' },
  { value: 'Poor', label: '🪨 Poor', desc: 'Solid rock or toxic, unsuitable', score: 5, verdict: 'FAIL' }
];

const MOISTURE_OPTIONS = ['High', 'Moderate', 'Low'];
const ROCKINESS_OPTIONS = ['Low', 'Moderate', 'High', 'Very High'];

export default function SoilQualityLayer({ siteData, layerData, isLoading, onSubmit, onDetailsUpdate }: Props) {
  // Form state
  const [soilList, setSoilList] = useState<Soil[]>([]);
  const [loadingSoils, setLoadingSoils] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedSoilId, setSelectedSoilId] = useState<number | null>(null);
  const [selectedSoilName, setSelectedSoilName] = useState('');
  
  const [moistureLevel, setMoistureLevel] = useState('');
  const [rockiness, setRockiness] = useState('');
  const [fertilityStatus, setFertilityStatus] = useState('');
  const [inspectorComment, setInspectorComment] = useState('');
  const [leaderComment, setLeaderComment] = useState(layerData?.leader_comment || '');

  // Filter soils by search
  const filteredSoils = soilList.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fetch soils list on mount
  useEffect(() => {
    const fetchSoils = async () => {
      try {
        setLoadingSoils(true);
        const res = await fetch('http://localhost:8000/api/get_soils_list/', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSoilList(data);
        }
      } catch (err) {
        console.error('Failed to fetch soils:', err);
      } finally {
        setLoadingSoils(false);
      }
    };
    fetchSoils();
  }, []);

  // Load existing data if submitted
  useEffect(() => {
    if (layerData?.final_agreed_data) {
      const d = layerData.final_agreed_data;
      setSelectedSoilId(d.soil_id || null);
      setSelectedSoilName(d.soil_name || '');
      setMoistureLevel(d.moisture_level || '');
      setRockiness(d.rockiness || '');
      setFertilityStatus(d.fertility_status || '');
      setInspectorComment(d.inspector_comment || '');
    }
  }, [layerData]);

  // Auto-suggest fertility based on moisture + rockiness
  useEffect(() => {
    if (!moistureLevel || !rockiness) return;
    if (moistureLevel === 'High' && rockiness === 'Low') setFertilityStatus('High');
    else if (moistureLevel === 'Low' && (rockiness === 'High' || rockiness === 'Very High')) setFertilityStatus('Poor');
    else setFertilityStatus('Moderate');
  }, [moistureLevel, rockiness]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fertilityStatus) {
      alert('Please select fertility status');
      return;
    }

    const finalAgreedData = {
      soil_id: selectedSoilId,
      soil_name: selectedSoilName,
      moisture_level: moistureLevel,
      rockiness: rockiness,
      fertility_status: fertilityStatus,
      inspector_comment: inspectorComment
    };

    const mcdaSuccess = await onSubmit(finalAgreedData, leaderComment);
    
    // Optionally update relational Site_details
    if (mcdaSuccess && onDetailsUpdate && selectedSoilId) {
      await onDetailsUpdate({ soil_id: selectedSoilId });
    }
  };

  const selectedFertility = FERTILITY_OPTIONS.find(f => f.value === fertilityStatus);

  // ============ READ-ONLY VIEW ============
  if (layerData?.result) {
    const isVeto = layerData.result.critical_flag;
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span>🌱</span> Soil Quality Assessment
            </h3>
            <p className="text-sm text-gray-500 mt-1">Nutrient capacity & water retention analysis</p>
          </div>
          <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
            isVeto ? 'bg-red-100 text-red-700' : layerData.result.verdict === 'HIGHLY_SUITABLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {layerData.result.verdict}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Database size={18} className="text-blue-600" />
              Soil Classification
            </h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Soil Type:</span>
                <p className="font-semibold text-gray-800 mt-0.5">
                  {layerData.final_agreed_data.soil_name || 'Not specified'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Fertility Status:</span>
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  selectedFertility?.value === 'High' ? 'bg-emerald-100 text-emerald-800' :
                  selectedFertility?.value === 'Moderate' ? 'bg-amber-100 text-amber-800' :
                  selectedFertility?.value === 'Low' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                }`}>
                  {selectedFertility?.label || fertilityStatus}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Moisture / Rockiness:</span>
                <p className="font-medium text-gray-700 mt-0.5">
                  {moistureLevel} / {rockiness}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3">Field Notes</h4>
            <p className="text-sm text-gray-600 italic">
              {layerData.final_agreed_data.inspector_comment || 'None'}
            </p>
          </div>
        </div>

        <div className={`rounded-xl p-5 border-2 ${isVeto ? 'bg-red-50 border-red-200' : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100'}`}>
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            📊 Calculated Result
            {isVeto && <AlertTriangle size={18} className="text-red-600" />}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500 block text-xs">Normalized Score</span><strong className="text-lg">{layerData.result.normalized_score}/100</strong></div>
            <div><span className="text-gray-500 block text-xs">Weight</span><strong className="text-lg">{layerData.result.weight_percentage}%</strong></div>
            <div><span className="text-gray-500 block text-xs">Weighted Score</span><strong className={`text-lg ${isVeto ? 'text-red-600' : 'text-emerald-600'}`}>+{layerData.result.weighted_score}</strong></div>
            <div><span className="text-gray-500 block text-xs">Veto</span><strong className={`text-lg ${isVeto ? 'text-red-600' : 'text-emerald-600'}`}>{isVeto ? '⚠️ YES' : 'No'}</strong></div>
          </div>
          {layerData.result.derived_mitigation && layerData.result.derived_mitigation !== 'None.' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm"><span className="font-medium text-gray-700">Soil Action:</span><span className="text-gray-600 ml-2">{layerData.result.derived_mitigation}</span></p>
            </div>
          )}
        </div>

        {layerData.leader_comment && (
          <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
            <p className="text-xs text-indigo-600 uppercase font-semibold mb-1">Leader Consensus Notes</p>
            <p className="text-sm text-gray-700">{layerData.leader_comment}</p>
          </div>
        )}
      </div>
    );
  }

  // ============ EDIT FORM ============
  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <span>🌱</span> Soil Quality Assessment
        </h3>
        <p className="text-sm text-gray-500 mt-1">Evaluate nutrient capacity, moisture retention, and texture</p>
      </div>

      {/* Soil Type Selector */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-semibold text-gray-800 mb-3">1. Soil Classification</legend>
        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search soil type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        {loadingSoils ? (
          <div className="flex items-center justify-center py-4 text-gray-500"><span className="animate-spin mr-2">⏳</span> Loading soils...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-2 bg-gray-50">
            {filteredSoils.map(soil => (
              <button
                key={soil.soil_id}
                type="button"
                onClick={() => { setSelectedSoilId(soil.soil_id); setSelectedSoilName(soil.name); }}
                className={`p-3 rounded-lg text-left transition-all border-2 ${
                  selectedSoilId === soil.soil_id 
                    ? 'border-emerald-500 bg-emerald-50' 
                    : 'border-transparent hover:bg-white hover:border-gray-200'
                }`}
              >
                <span className="font-medium text-gray-800 block">{soil.name}</span>
                <span className="text-xs text-gray-500">{soil.description}</span>
              </button>
            ))}
          </div>
        )}
      </fieldset>

      {/* Physical Properties */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-semibold text-gray-800 mb-4">2. Physical Properties</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Moisture Level</label>
            <select value={moistureLevel} onChange={(e) => setMoistureLevel(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500">
              <option value="">Select...</option>
              {MOISTURE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rockiness</label>
            <select value={rockiness} onChange={(e) => setRockiness(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500">
              <option value="">Select...</option>
              {ROCKINESS_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </fieldset>

      {/* Fertility Status (Drives MCDA Score) */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-semibold text-gray-800 mb-4">3. Fertility Status <span className="text-rose-500">*</span></legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FERTILITY_OPTIONS.map(opt => (
            <label key={opt.value} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${fertilityStatus === opt.value ? `${opt.value === 'High' ? 'border-emerald-500 bg-emerald-50' : opt.value === 'Moderate' ? 'border-amber-500 bg-amber-50' : opt.value === 'Low' ? 'border-orange-500 bg-orange-50' : 'border-red-500 bg-red-50'}` : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="fertility" value={opt.value} checked={fertilityStatus === opt.value} onChange={(e) => setFertilityStatus(e.target.value)} className="mt-1 w-4 h-4" />
              <div>
                <span className="font-semibold text-gray-800 block">{opt.label}</span>
                <span className="text-xs text-gray-500">{opt.desc}</span>
                <div className="flex gap-2 mt-1.5 text-xs font-medium">
                  <span className="bg-white/60 px-2 py-0.5 rounded">Score: {opt.score}</span>
                  <span className="bg-white/60 px-2 py-0.5 rounded">{opt.verdict}</span>
                </div>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Comments */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Inspector Field Notes</label>
        <textarea value={inspectorComment} onChange={(e) => setInspectorComment(e.target.value)} placeholder="e.g., Dark loam soil, ideal for planting..." className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 resize-none" rows={2} />
      </div>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Leader Consensus Comment</label>
        <textarea value={leaderComment} onChange={(e) => setLeaderComment(e.target.value)} placeholder="Document team agreement on soil suitability..." className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none" rows={2} />
      </div>

      <button type="submit" disabled={isLoading || !fertilityStatus} className={`w-full py-3.5 px-6 rounded-xl font-semibold transition-all ${!isLoading && fertilityStatus ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
        {isLoading ? '⏳ Submitting...' : '💾 Save Soil Assessment (15% Weight)'}
      </button>
    </form>
  );
}