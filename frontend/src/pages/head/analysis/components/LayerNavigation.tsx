// src/pages/multicriteria/components/LayerNavigation.tsx
import type { LayerKey } from '../types/mcda';

interface Layer {
  key: LayerKey;
  label: string;
  icon: string;
  weight: number; // for display
}

interface Props {
  layers: Layer[];
  selectedLayer: LayerKey;
  onSelectLayer: (key: LayerKey) => void;
  getLayerStatus: (layer: LayerKey) => { label: string; className: string };
  completedCount: number;
  totalCount: number;
}

export default function LayerNavigation({
  layers,
  selectedLayer,
  onSelectLayer,
  getLayerStatus,
  completedCount,
  totalCount
}: Props) {
  const progress = (completedCount / totalCount) * 100;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-24">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-gray-700">Progress</span>
          <span className="text-emerald-600 font-bold">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-emerald-400 to-teal-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {completedCount} of {totalCount} layers completed
        </p>
      </div>

      {/* Layer List */}
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <span>📋</span> Criteria Layers
      </h3>
      <div className="space-y-2">
        {layers.map((layer) => {
          const status = getLayerStatus(layer.key);
          return (
            <button
              key={layer.key}
              onClick={() => onSelectLayer(layer.key)}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 text-left group ${
                selectedLayer === layer.key
                  ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 shadow-sm'
                  : 'hover:bg-gray-50 border-2 border-transparent hover:border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg group-hover:scale-110 transition-transform">{layer.icon}</span>
                <div className="text-left">
                  <span className="font-medium text-gray-700 block">{layer.label}</span>
                  <span className="text-xs text-gray-400">{layer.weight}% weight</span>
                </div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${status.className}`}>
                {status.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}