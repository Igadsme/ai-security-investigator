import React, { useState } from 'react';
import {
  MapPin,
  Camera,
  Layers,
  Radio,
  Maximize2,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { CaseData, CameraMeta } from '@/types/verisight';

interface FacilityMapProps {
  currentCase: CaseData;
  onSelectCameraClip: (cameraName: string) => void;
}

export const FacilityMap: React.FC<FacilityMapProps> = ({
  currentCase,
  onSelectCameraClip,
}) => {
  const [selectedCam, setSelectedCam] = useState<CameraMeta | null>(currentCase.cameras[0] || null);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showFovCones, setShowFovCones] = useState<boolean>(true);

  return (
    <div id="facility-map-view" className="p-5 max-w-7xl mx-auto space-y-5">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div>
          <h2 className="text-base font-semibold text-white">
            Facility Floor Plan & Camera Placements
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive spatial layout showing camera coverage angles, restricted zones, and correlated suspect transit paths.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setShowFovCones(!showFovCones)}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center space-x-1.5 border ${
              showFovCones
                ? 'bg-blue-600 text-white border-blue-500 font-medium'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Coverage Cones</span>
          </button>
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center space-x-1.5 border ${
              showHeatmap
                ? 'bg-blue-600 text-white border-blue-500 font-medium'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Transit Paths</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 8 Cols: Interactive 2D Blueprint Canvas */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-lg p-4 relative min-h-[500px] flex items-center justify-center overflow-hidden">
          {/* Blueprint SVG Layout */}
          <svg className="w-full h-full min-h-[480px]" viewBox="0 0 1000 600">
            {/* Grid lines */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(51, 65, 85, 0.3)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Outer Perimeter */}
            <rect x="50" y="50" width="900" height="500" fill="#0f172a" stroke="#334155" strokeWidth="2" rx="6" />

            {/* Warehouse Facility Interior */}
            <rect x="250" y="120" width="500" height="320" fill="#1e293b" stroke="#475569" strokeWidth="1.5" rx="4" />

            {/* Bay 4 Loading Dock Zone */}
            <rect
              x="350"
              y="320"
              width="220"
              height="120"
              fill="rgba(239, 68, 68, 0.08)"
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text x="360" y="340" fill="#ef4444" fontSize="11" fontWeight="600">
              Zone A: Loading Dock (Restricted)
            </text>

            {/* Interior Staging Rack Area */}
            <rect
              x="480"
              y="150"
              width="240"
              height="140"
              fill="rgba(245, 158, 11, 0.08)"
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text x="490" y="170" fill="#f59e0b" fontSize="11" fontWeight="600">
              Zone B: Pallet Staging Area
            </text>

            {/* South Gate Entrance */}
            <path d="M 120 550 L 180 550" stroke="#10b981" strokeWidth="4" />
            <text x="110" y="575" fill="#10b981" fontSize="10">
              South Gate Access
            </text>

            {/* East Perimeter Boundary */}
            <path d="M 950 200 L 950 400" stroke="#64748b" strokeWidth="3" strokeDasharray="4 4" />
            <text x="830" y="300" fill="#94a3b8" fontSize="10">
              East Perimeter
            </text>

            {/* Heatmap Trails (if enabled) */}
            {showHeatmap && (
              <g opacity="0.8">
                {/* Vehicle path */}
                <path
                  d="M 150 550 Q 200 480 380 420"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="5"
                  strokeLinecap="round"
                  opacity="0.5"
                />
                {/* Person trajectory path */}
                <path
                  d="M 380 420 L 440 380 L 520 230 L 440 380 L 380 420"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="3"
                  strokeDasharray="4 4"
                />
                <circle cx="520" cy="230" r="6" fill="#ef4444" />
                <text x="532" y="234" fill="#fca5a5" fontSize="10" fontWeight="600">
                  Incident Point
                </text>
              </g>
            )}

            {/* Camera FOV Cones & Markers */}
            {currentCase.cameras.map((cam) => {
              const isSelected = selectedCam?.id === cam.id;
              
              // Normalize coordinates to 1000x600 viewBox
              const rawX = cam.mapCoords?.x ?? 50;
              const rawY = cam.mapCoords?.y ?? 50;
              const camX = rawX <= 100 ? (rawX / 100) * 1000 : rawX;
              const camY = rawY <= 100 ? (rawY / 100) * 600 : rawY;
              const fovAngle = cam.mapCoords?.angle ?? 45;
              const fovSpread = cam.mapCoords?.fov ?? 70;

              const angleRad = (fovAngle * Math.PI) / 180;
              const halfFov = ((fovSpread / 2) * Math.PI) / 180;
              const range = 140;

              const x1 = camX + Math.cos(angleRad - halfFov) * range;
              const y1 = camY + Math.sin(angleRad - halfFov) * range;
              const x2 = camX + Math.cos(angleRad + halfFov) * range;
              const y2 = camY + Math.sin(angleRad + halfFov) * range;

              return (
                <g key={cam.id} className="cursor-pointer" onClick={() => setSelectedCam(cam)}>
                  {/* FOV Cone */}
                  {showFovCones && (
                    <path
                      d={`M ${camX} ${camY} L ${x1} ${y1} A ${range} ${range} 0 0 1 ${x2} ${y2} Z`}
                      fill={isSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.1)'}
                      stroke={isSelected ? '#3b82f6' : 'rgba(59, 130, 246, 0.4)'}
                      strokeWidth="1"
                    />
                  )}

                  {/* Camera Pin Circle */}
                  <circle
                    cx={camX}
                    cy={camY}
                    r={isSelected ? 10 : 8}
                    fill={isSelected ? '#3b82f6' : '#1e293b'}
                    stroke={isSelected ? '#ffffff' : '#64748b'}
                    strokeWidth="2"
                  />
                  <text
                    x={camX}
                    y={camY + 22}
                    textAnchor="middle"
                    fill={isSelected ? '#ffffff' : '#cbd5e1'}
                    fontSize="11"
                    fontWeight={isSelected ? 'bold' : 'normal'}
                  >
                    {cam.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right 4 Cols: Selected Camera Details */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <Camera className="w-4 h-4 text-blue-400" />
                <span>Camera Feed Information</span>
              </h3>
              {selectedCam?.status === 'online' && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Online</span>
                </span>
              )}
            </div>

            {selectedCam ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400">Camera Name:</label>
                  <div className="font-semibold text-white text-sm mt-0.5">{selectedCam.name}</div>
                </div>

                <div>
                  <label className="text-slate-400">Physical Location:</label>
                  <div className="text-slate-200 mt-0.5">{selectedCam.location}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400">Stream Resolution</span>
                    <div className="font-semibold text-slate-200 mt-0.5">{selectedCam.resolution}</div>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400">Lens FOV Angle</span>
                    <div className="font-semibold text-slate-200 mt-0.5">
                      {selectedCam.mapCoords?.angle ?? 45}° Direction ({selectedCam.mapCoords?.fov ?? 70}° FOV)
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="text-slate-400">Coverage Description:</label>
                  <p className="text-slate-300 mt-1 leading-relaxed">
                    Provides continuous surveillance of {selectedCam.location.toLowerCase()} with AI object classification and motion trigger tracking.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-slate-500">
                Click any camera icon on the floor plan to view details.
              </div>
            )}
          </div>

          {selectedCam && (
            <button
              onClick={() => onSelectCameraClip(selectedCam.name)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center justify-center space-x-2 transition-colors shadow-sm"
            >
              <Eye className="w-4 h-4" />
              <span>Review Camera Footage in Studio</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
