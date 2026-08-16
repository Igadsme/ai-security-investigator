import React, { useState } from 'react';
import {
  Bell,
  Plus,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  Play,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { CaseData, StandingAlert, ObjectClass, ActivityAction } from '@/types/verisight';

interface StandingAlertsProps {
  currentCase: CaseData;
  onSaveAlert: (alert: StandingAlert) => void;
  onToggleAlert: (alertId: string) => void;
  onDeleteAlert: (alertId: string) => void;
  onJumpToEvent: (timeSec: number) => void;
}

export const StandingAlerts: React.FC<StandingAlertsProps> = ({
  currentCase,
  onSaveAlert,
  onToggleAlert,
  onDeleteAlert,
  onJumpToEvent,
}) => {
  const [isCreatingAlert, setIsCreatingAlert] = useState<boolean>(false);
  const [alertName, setAlertName] = useState<string>('');
  const [targetClass, setTargetClass] = useState<ObjectClass | 'any'>('person');
  const [camera, setCamera] = useState<string>('all');
  const [action, setAction] = useState<ActivityAction | 'any'>('loitering');
  const [minConfidence, setMinConfidence] = useState<number>(85);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertName.trim()) return;

    const newAlert: StandingAlert = {
      id: `alert-${Date.now()}`,
      name: alertName.trim(),
      targetClass,
      camera,
      action,
      timeWindow: { start: '22:00', end: '06:00' },
      minConfidence: minConfidence / 100,
      enabled: true,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      triggeredCount: 0,
    };

    onSaveAlert(newAlert);
    setIsCreatingAlert(false);
    setAlertName('');
  };

  return (
    <div id="standing-alerts-view" className="p-5 max-w-7xl mx-auto space-y-5">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div>
          <h2 className="text-base font-semibold text-white">
            Automated Event Rules & Trigger Alerts
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure automated surveillance rules for boundary crossings, loitering, unattended bags, and restricted area incursions.
          </p>
        </div>

        <button
          onClick={() => setIsCreatingAlert(true)}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Event Rule</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: Active Rules */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-slate-200 font-semibold text-xs">
                Active Rules ({currentCase.standingAlerts.length})
              </span>
            </div>

            {currentCase.standingAlerts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 border border-slate-800 rounded-lg bg-slate-950">
                No active event rules for this case. Create a rule above to receive automated event notifications.
              </div>
            ) : (
              <div className="space-y-3">
                {currentCase.standingAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      alert.enabled
                        ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/20 border-slate-800/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Bell className={`w-4 h-4 ${alert.enabled ? 'text-blue-400' : 'text-slate-500'}`} />
                        <h4 className="text-xs font-semibold text-white">{alert.name}</h4>
                      </div>
                      <button
                        onClick={() => onToggleAlert(alert.id)}
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                          alert.enabled
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {alert.enabled ? 'Active' : 'Disabled'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-400 my-2 bg-slate-900/90 p-2.5 rounded border border-slate-800/80">
                      <div>
                        Target: <strong className="text-slate-200 capitalize">{alert.targetClass}</strong>
                      </div>
                      <div>
                        Action: <strong className="text-slate-200 capitalize">{alert.action.replace('_', ' ')}</strong>
                      </div>
                      <div>
                        Feed: <strong className="text-slate-200 truncate">{alert.camera}</strong>
                      </div>
                      <div>
                        Sensitivity: <strong className="text-slate-200">{Math.round(alert.minConfidence * 100)}%</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <span>
                        Total Triggers: <strong className="text-slate-200">{alert.triggeredCount}</strong>
                      </span>
                      <button
                        onClick={() => onDeleteAlert(alert.id)}
                        className="text-slate-400 hover:text-rose-400 flex items-center space-x-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Recent Automated Event Triggers */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-slate-200 font-semibold text-xs flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Recent Rule Trigger Log</span>
              </span>
            </div>

            <div className="space-y-2.5">
              {(currentCase.clips || []).flatMap((c) => c.events || []).slice(0, 5).map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{evt.title}</span>
                    <span className="font-mono text-slate-400 text-[11px]">{evt.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{evt.description}</p>
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 capitalize">
                      {evt.action.replace('_', ' ')}
                    </span>
                    <button
                      onClick={() => onJumpToEvent(evt.timeSeconds)}
                      className="text-blue-400 hover:text-blue-300 font-medium flex items-center space-x-1"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Review In Studio</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Create Rule Modal */}
      {isCreatingAlert && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <Bell className="w-4 h-4 text-blue-400" />
                <span>Create Automated Event Rule</span>
              </h3>
              <button
                onClick={() => setIsCreatingAlert(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Rule Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Loading Dock After-Hours Ingress"
                  value={alertName}
                  onChange={(e) => setAlertName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Target Entity:</label>
                  <select
                    value={targetClass}
                    onChange={(e) => setTargetClass(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded px-2.5 py-2"
                  >
                    <option value="person">Person</option>
                    <option value="car">Vehicle / Car</option>
                    <option value="bag">Unattended Bag</option>
                    <option value="bike">Bicycle</option>
                    <option value="any">Any Entity</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Action Trigger:</label>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded px-2.5 py-2"
                  >
                    <option value="loitering">Loitering (&gt;20s)</option>
                    <option value="entry">Restricted Zone Entry</option>
                    <option value="left_object">Left Object</option>
                    <option value="running">Rapid Movement / Running</option>
                    <option value="any">Any Activity</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Camera Feed Assignment:</label>
                <select
                  value={camera}
                  onChange={(e) => setCamera(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded px-2.5 py-2"
                >
                  <option value="all">All Cameras (Facility-Wide)</option>
                  {currentCase.clips.map((c) => (
                    <option key={c.id} value={c.camera}>
                      {c.camera}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1 font-medium">
                  <span>Confidence Threshold</span>
                  <span className="font-mono text-slate-200">{minConfidence}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={99}
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreatingAlert(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
                >
                  Save Event Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
