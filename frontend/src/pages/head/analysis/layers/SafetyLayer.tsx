// src/pages/multicriteria/layers/SafetyLayer.tsx
import { useState } from 'react';
import type { LayerData, SiteData } from '../types/mcda';

interface Props {
  siteData: SiteData | null;
  layerData?: LayerData;
  isLoading: boolean;
  onSubmit: (data: Record<string, any>, comment?: string) => Promise<boolean>;
}

export default function SafetyLayer({ siteData, layerData, isLoading, onSubmit }: Props) {
  const [formData, setFormData] = useState({
    geophysical_assessment: {
      observed_hazards: [] as string[],
      risk_level: '' as 'Low' | 'Medium' | 'High' | 'Critical',
      inspector_comment_hazard: ''
    },
    human_security_assessment: {
      security_threat_level: '' as 'Low' | 'Medium' | 'High' | 'Critical',
      specific_threats: [] as string[],
      inspector_comment_security: ''
    }
  });
  const [leaderComment, setLeaderComment] = useState(layerData?.leader_comment || '');
  const [newHazard, setNewHazard] = useState('');
  const [newThreat, setNewThreat] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onSubmit(formData, leaderComment);
    if (success) {
      // Optionally reset or keep data for editing
    }
  };

  const addHazard = () => {
    if (newHazard.trim()) {
      setFormData(prev => ({
        ...prev,
        geophysical_assessment: {
          ...prev.geophysical_assessment,
          observed_hazards: [...prev.geophysical_assessment.observed_hazards, newHazard.trim()]
        }
      }));
      setNewHazard('');
    }
  };

  const removeHazard = (index: number) => {
    setFormData(prev => ({
      ...prev,
      geophysical_assessment: {
        ...prev.geophysical_assessment,
        observed_hazards: prev.geophysical_assessment.observed_hazards.filter((_, i) => i !== index)
      }
    }));
  };

  // If already submitted, show read-only view + result
  if (layerData?.result) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">🛡️ Safety Assessment</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            layerData.result.critical_flag 
              ? 'bg-red-100 text-red-700' 
              : layerData.result.verdict === 'PASS' 
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
          }`}>
            {layerData.result.verdict}
          </span>
        </div>

        {/* Submitted Data Summary */}
        <div className="space-y-4 mb-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Geophysical Risk</h4>
            <p className="text-sm text-gray-600">
              <strong>Level:</strong> {layerData.final_agreed_data.geophysical_assessment?.risk_level}
            </p>
            {layerData.final_agreed_data.geophysical_assessment?.observed_hazards?.length > 0 && (
              <ul className="mt-1 text-sm text-gray-600 list-disc list-inside">
                {layerData.final_agreed_data.geophysical_assessment.observed_hazards.map((h: string, i: number) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}
          </div>
          
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Human Security</h4>
            <p className="text-sm text-gray-600">
              <strong>Threat Level:</strong> {layerData.final_agreed_data.human_security_assessment?.security_threat_level}
            </p>
          </div>
        </div>

        {/* Calculated Result */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
          <h4 className="font-semibold text-emerald-800 mb-2">📊 Calculated Result</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Normalized Score:</span> <strong>{layerData.result.normalized_score}/100</strong></div>
            <div><span className="text-gray-500">Weight:</span> <strong>{layerData.result.weight_percentage}%</strong></div>
            <div><span className="text-gray-500">Weighted Score:</span> <strong>+{layerData.result.weighted_score}</strong></div>
            <div><span className="text-gray-500">Veto:</span> <strong>{layerData.result.critical_flag ? '⚠️ YES' : 'No'}</strong></div>
          </div>
          {layerData.result.derived_mitigation && layerData.result.derived_mitigation !== 'None.' && (
            <p className="mt-3 text-sm text-emerald-700">
              <strong>Required Mitigation:</strong> {layerData.result.derived_mitigation}
            </p>
          )}
        </div>

        {/* Leader Comment */}
        {layerData.leader_comment && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 uppercase font-medium mb-1">Leader Notes</p>
            <p className="text-sm text-gray-700">{layerData.leader_comment}</p>
          </div>
        )}
      </div>
    );
  }

  // Edit form for leader input
  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-6">🛡️ Safety Assessment</h3>
      
      {/* Geophysical Assessment */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-medium text-gray-700 mb-4">Geophysical Hazards</legend>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Risk Level *</label>
          <select
            required
            value={formData.geophysical_assessment.risk_level}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              geophysical_assessment: { ...prev.geophysical_assessment, risk_level: e.target.value as any }
            }))}
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select risk level...</option>
            <option value="Low">Low - Minimal hazards</option>
            <option value="Medium">Medium - Manageable with controls</option>
            <option value="High">High - Significant intervention needed</option>
            <option value="Critical">Critical - Immediate danger</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Observed Hazards</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newHazard}
              onChange={(e) => setNewHazard(e.target.value)}
              placeholder="e.g., Loose soil on ridge"
              className="flex-1 p-2 border border-gray-200 rounded-lg"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addHazard())}
            />
            <button type="button" onClick={addHazard} className="px-4 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200">
              Add
            </button>
          </div>
          {formData.geophysical_assessment.observed_hazards.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.geophysical_assessment.observed_hazards.map((hazard, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                  {hazard}
                  <button type="button" onClick={() => removeHazard(idx)} className="text-gray-400 hover:text-rose-500">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Inspector Comment</label>
          <textarea
            value={formData.geophysical_assessment.inspector_comment_hazard}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              geophysical_assessment: { ...prev.geophysical_assessment, inspector_comment_hazard: e.target.value }
            }))}
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
            rows={2}
            placeholder="Additional notes from field inspection..."
          />
        </div>
      </fieldset>

      {/* Human Security Assessment */}
      <fieldset className="mb-6 pb-6 border-b border-gray-100">
        <legend className="font-medium text-gray-700 mb-4">Human Security</legend>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Threat Level *</label>
          <select
            required
            value={formData.human_security_assessment.security_threat_level}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              human_security_assessment: { ...prev.human_security_assessment, security_threat_level: e.target.value as any }
            }))}
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select threat level...</option>
            <option value="Low">Low - Area secure</option>
            <option value="Medium">Medium - Monitor situation</option>
            <option value="High">High - Coordination required</option>
            <option value="Critical">Critical - Access restricted</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Specific Threats</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newThreat}
              onChange={(e) => setNewThreat(e.target.value)}
              placeholder="e.g., Local land dispute"
              className="flex-1 p-2 border border-gray-200 rounded-lg"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), setFormData(prev => ({
                ...prev,
                human_security_assessment: {
                  ...prev.human_security_assessment,
                  specific_threats: [...prev.human_security_assessment.specific_threats, newThreat.trim()]
                }
              })), setNewThreat(''))}
            />
            <button type="button" onClick={() => {
              if (newThreat.trim()) {
                setFormData(prev => ({
                  ...prev,
                  human_security_assessment: {
                    ...prev.human_security_assessment,
                    specific_threats: [...prev.human_security_assessment.specific_threats, newThreat.trim()]
                  }
                }));
                setNewThreat('');
              }
            }} className="px-4 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200">
              Add
            </button>
          </div>
          {formData.human_security_assessment.specific_threats.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.human_security_assessment.specific_threats.map((threat, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                  {threat}
                  <button type="button" onClick={() => setFormData(prev => ({
                    ...prev,
                    human_security_assessment: {
                      ...prev.human_security_assessment,
                      specific_threats: prev.human_security_assessment.specific_threats.filter((_, i) => i !== idx)
                    }
                  }))} className="text-gray-400 hover:text-rose-500">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </fieldset>

      {/* Leader Consensus Comment */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Leader Consensus Comment</label>
        <textarea
          value={leaderComment}
          onChange={(e) => setLeaderComment(e.target.value)}
          placeholder="Document the team's agreed assessment rationale..."
          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
          rows={3}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !formData.geophysical_assessment.risk_level || !formData.human_security_assessment.security_threat_level}
        className={`w-full py-3 px-6 rounded-xl font-semibold transition-all ${
          !isLoading && formData.geophysical_assessment.risk_level && formData.human_security_assessment.security_threat_level
            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⏳</span> Submitting...
          </span>
        ) : (
          '💾 Save Safety Assessment'
        )}
      </button>
    </form>
  );
}