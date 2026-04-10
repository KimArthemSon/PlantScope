// src/pages/multicriteria/components/SideBySideComparison.tsx
import type { LayerKey, FieldAssessment, LayerValidation } from '../types/mcda';

interface Props {
  layer: LayerKey;
  inspectorData?: FieldAssessment;
  leaderData?: LayerValidation;
  isLeaderView: boolean;
}

export default function SideBySideComparison({ 
  layer, 
  inspectorData, 
  leaderData, 
  isLeaderView 
}: Props) {
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '—';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const renderDataBlock = (data: Record<string, any> | undefined, title: string, isLeader: boolean) => (
    <div className={`p-4 rounded-xl border ${isLeader ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
      <h4 className={`font-medium mb-3 ${isLeader ? 'text-emerald-800' : 'text-gray-700'}`}>
        {title}
      </h4>
      {data ? (
        <div className="space-y-2 text-sm">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex">
              <span className="font-medium text-gray-500 w-1/3 capitalize">{key.replace(/_/g, ' ')}:</span>
              <span className="text-gray-700 w-2/3">{formatValue(value)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">No data submitted</p>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-24">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <span>👥</span> {layer.replace('_', ' ').toUpperCase()} Comparison
      </h3>
      
      <div className="space-y-4">
        {/* Inspector's Raw Submission */}
        {renderDataBlock(
          inspectorData?.final_agreed_data,
          "🔹 Inspector Submission",
          false
        )}
        
        {inspectorData?.inspector_comment && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs text-blue-600 font-medium mb-1">Inspector Notes</p>
            <p className="text-sm text-gray-700">{inspectorData.inspector_comment}</p>
          </div>
        )}

        {/* Leader's Validated Version (if exists) */}
        {leaderData && (
          <>
            <div className="border-t border-gray-100 pt-4">
              {renderDataBlock(
                leaderData.final_agreed_data,
                "✅ Leader Validated",
                true
              )}
              
              {leaderData.additional_documentation_note && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 mt-3">
                  <p className="text-xs text-emerald-600 font-medium mb-1">Leader Documentation</p>
                  <p className="text-sm text-gray-700">{leaderData.additional_documentation_note}</p>
                </div>
              )}
              
              {leaderData.leader_comment && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 mt-3">
                  <p className="text-xs text-emerald-600 font-medium mb-1">Leader Decision Notes</p>
                  <p className="text-sm text-gray-700">{leaderData.leader_comment}</p>
                </div>
              )}
              
              <div className={`mt-3 px-3 py-2 rounded-lg text-center font-medium ${
                leaderData.leader_decision === 'ACCEPT' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-rose-100 text-rose-700'
              }`}>
                Decision: {leaderData.leader_decision}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Helper text for leaders */}
      {isLeaderView && !leaderData && inspectorData && (
        <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100 text-sm text-amber-800">
          💡 <strong>Leader Tip:</strong> Review the inspector's submission above. 
          Use the form to confirm (ACCEPT) or request changes (REJECT) with your comments.
        </div>
      )}
    </div>
  );
}