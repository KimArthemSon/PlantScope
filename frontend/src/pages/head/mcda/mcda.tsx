import { useEffect, useState } from "react";
import { Save, AlertCircle, CheckCircle, Edit2, X } from "lucide-react";

const API = "http://127.0.0.1:8000/api";

// Types
interface ScoringRule {
  status_input: string;
  normalized_score: number;
  verdict: string;
  is_veto: boolean;
}

interface LayerConfig {
  id: number;
  layer_name: string;
  layer_display: string;
  weight_percentage: number;
  scoring_rules: {
    input_field?: string;
    rules: ScoringRule[];
  };
}

export default function Mcda_config_manager() {
  const [configs, setConfigs] = useState<LayerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null); // ID of saving layer
  const [totalWeight, setTotalWeight] = useState(0);
  const [isValid, setIsValid] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  // Fetch Configs
  const fetchConfigs = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/get_mcda_config/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setConfigs(data.configurations);
        setTotalWeight(data.total_weight);
        setIsValid(data.is_valid);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  // Handle Weight Change
  const handleWeightChange = (id: number, newWeight: number) => {
    setConfigs(prev => prev.map(c => 
      c.id === id ? { ...c, weight_percentage: newWeight } : c
    ));
  };

  // Handle Rule Change (Score)
  const handleRuleChange = (layerId: number, ruleIndex: number, field: keyof ScoringRule, value: any) => {
    setConfigs(prev => prev.map(c => {
      if (c.id !== layerId) return c;
      const newRules = [...c.scoring_rules.rules];
      newRules[ruleIndex] = { ...newRules[ruleIndex], [field]: value };
      return { ...c, scoring_rules: { ...c.scoring_rules, rules: newRules } };
    }));
  };

  // Save Single Layer
  const saveLayer = async (layer: LayerConfig) => {
    setSaving(layer.id);
    setMessage(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/update_mcda_config/${layer.layer_name}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          weight_percentage: layer.weight_percentage,
          scoring_rules: layer.scoring_rules,
        }),
      });
      
      if (res.ok) {
        setMessage({ type: 'success', text: `${layer.layer_display} saved!` });
        fetchConfigs(); // Refresh to get new total weight
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || "Failed to save" });
      }
    } catch (err) {
      setMessage({ type: 'error', text: "Network error" });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading Configuration...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header & Validation Status */}
        <div className="mb-8 flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-green-800">MCDA Scoring Engine</h1>
            <p className="text-gray-500 text-sm mt-1">Configure weights and scoring rules for all 8 assessment layers.</p>
          </div>
          <div className={`px-4 py-2 rounded-lg flex items-center gap-2 ${isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {isValid ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
            <div>
              <div className="font-bold">Total Weight: {totalWeight.toFixed(1)}%</div>
              <div className="text-xs">{isValid ? "Valid Configuration" : "Must equal 100%"}</div>
            </div>
          </div>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message.text}
          </div>
        )}

        {/* Layers Grid */}
        <div className="grid grid-cols-1 gap-6">
          {configs.map((layer) => (
            <div key={layer.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              
              {/* Layer Header (Weight) */}
              <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-green-700 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                    {layer.weight_percentage}%
                  </div>
                  <h2 className="text-lg font-bold text-gray-800">{layer.layer_display}</h2>
                  <span className="text-xs text-gray-400 uppercase tracking-wide">({layer.layer_name})</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-gray-600">Weight:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={layer.weight_percentage}
                      onChange={(e) => handleWeightChange(layer.id, parseFloat(e.target.value) || 0)}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-right focus:ring-2 focus:ring-green-500 outline-none"
                    />
                  </div>
                  <button
                    onClick={() => saveLayer(layer)}
                    disabled={saving === layer.id}
                    className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {saving === layer.id ? "Saving..." : <><Save size={16} /> Save Layer</>}
                  </button>
                </div>
              </div>

              {/* Scoring Rules Table */}
              <div className="p-6">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Scoring Rules Matrix</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-xs text-gray-500">
                        <th className="py-2 px-2">Status Input</th>
                        <th className="py-2 px-2">Meaning</th>
                        <th className="py-2 px-2 w-32">Score (0-100)</th>
                        <th className="py-2 px-2">Verdict</th>
                        <th className="py-2 px-2 w-24 text-center">Veto?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {layer.scoring_rules.rules.map((rule, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-2 px-2">
                            <input
                              value={rule.status_input}
                              onChange={(e) => handleRuleChange(layer.id, idx, 'status_input', e.target.value)}
                              className="w-full bg-transparent border-b border-gray-300 focus:border-green-600 outline-none py-1 text-sm font-medium"
                            />
                          </td>
                          <td className="py-2 px-2 text-sm text-gray-600">
                             {/* Optional: Add meaning field if needed, otherwise derived */}
                             <span className="italic text-gray-400 text-xs">Auto-derived</span>
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={rule.normalized_score}
                              onChange={(e) => handleRuleChange(layer.id, idx, 'normalized_score', parseInt(e.target.value) || 0)}
                              className={`w-full bg-transparent border-b border-gray-300 focus:border-green-600 outline-none py-1 text-sm font-bold ${rule.normalized_score < 50 ? 'text-red-600' : 'text-green-700'}`}
                            />
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={rule.verdict}
                              onChange={(e) => handleRuleChange(layer.id, idx, 'verdict', e.target.value)}
                              className="w-full bg-transparent border-b border-gray-300 focus:border-green-600 outline-none py-1 text-xs font-semibold uppercase"
                            >
                              <option value="PASS">Pass</option>
                              <option value="PASS_WITH_MITIGATION">Pass w/ Mitigation</option>
                              <option value="WARNING">Warning</option>
                              <option value="FAIL">Fail</option>
                              <option value="AUTO_REJECT">Auto Reject</option>
                            </select>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={rule.is_veto}
                              onChange={(e) => handleRuleChange(layer.id, idx, 'is_veto', e.target.checked)}
                              className="w-4 h-4 text-green-600 rounded focus:ring-green-500 cursor-pointer"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}