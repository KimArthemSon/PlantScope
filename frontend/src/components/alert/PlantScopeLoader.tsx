// components/PlantScopeLoader.tsx
import "../../global css/loader.css";
export default function PlantScopeLoader() {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center">
        {/* Growing leaf animation */}
        <div className="relative w-24 h-24 mx-auto">
          {/* Leaf made of 3 rotating circles */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-full bg-linear-to-br from-green-400 to-emerald-600 opacity-80"
              style={{
                animation: `leafGrow 2s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
                transform: `rotate(${i * 120}deg)`,
              }}
            >
              <div
                className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-16 bg-green-500 rounded-full origin-bottom"
                style={{
                  animation: `leafPulse 2s ease-in-out infinite`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            </div>
          ))}
        </div>

        <p className="mt-8 text-lg font-medium text-green-700 animate-pulse">
          Loading your plants...
        </p>
        <p className="text-sm text-green-600 mt-2">PlantScope</p>
      </div>
    </div>
  );
}