import React, { useState } from 'react';
import {
  Search,
  Filter,
  Clock,
  User,
  Car,
  Package,
  Bike,
  Bell,
  Play,
  Check,
  AlertCircle,
  ArrowRight,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react';
import { CaseData, ObjectClass, ActivityAction, StandingAlert } from '@/types/verisight';
import { searchCctvFootage, AiSearchResponse } from '@/services/api';
import { formatTimestamp } from '@/lib/format';

interface SearchInvestigationProps {
  currentCase: CaseData;
  onJumpToClipTime: (clipId: string, timeSec: number) => void;
  onSaveAlert: (alert: StandingAlert) => void;
}

export const SearchInvestigation: React.FC<SearchInvestigationProps> = ({
  currentCase,
  onJumpToClipTime,
  onSaveAlert,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchResponse, setSearchResponse] = useState<AiSearchResponse | null>(null);

  // Multi-modal filters state
  const [selectedClasses, setSelectedClasses] = useState<ObjectClass[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedCameras, setSelectedCameras] = useState<string[]>([]);
  const [selectedActions, setSelectedActions] = useState<ActivityAction[]>([]);
  const [minConfidence, setMinConfidence] = useState<number>(75);
  const [alertSavedNotice, setAlertSavedNotice] = useState<boolean>(false);

  const sampleQueries = [
    'Show all persons entering the room',
    'When did the white vehicle appear?',
    'Find people running while carrying a bag',
    'Show all loitering activity over 20 seconds',
    'Find unattended objects left in loading zone',
  ];

  const handleExecuteSearch = async (queryText?: string) => {
    const q = queryText !== undefined ? queryText : searchQuery;
    if (!q.trim() && selectedClasses.length === 0 && selectedActions.length === 0) return;

    setIsLoading(true);
    setSearchQuery(q);

    try {
      const result = await searchCctvFootage(q, currentCase, {
        object_class: selectedClasses[0],
        color: selectedColors[0],
        min_confidence: minConfidence / 100,
      });
      setSearchResponse(result);
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleClass = (c: ObjectClass) => {
    setSelectedClasses((prev) =>
      prev.includes(c) ? prev.filter((item) => item !== c) : [...prev, c]
    );
  };

  const toggleColor = (col: string) => {
    setSelectedColors((prev) =>
      prev.includes(col) ? prev.filter((item) => item !== col) : [...prev, col]
    );
  };

  const toggleAction = (act: ActivityAction) => {
    setSelectedActions((prev) =>
      prev.includes(act) ? prev.filter((item) => item !== act) : [...prev, act]
    );
  };

  const handleSaveAsAlert = () => {
    const newAlert: StandingAlert = {
      id: `alert-${Date.now()}`,
      name: searchQuery ? `Rule: ${searchQuery}` : `Rule: ${selectedClasses.join(', ')}`,
      targetClass: selectedClasses[0] || 'any',
      camera: selectedCameras[0] || 'all',
      action: selectedActions[0] || 'any',
      minConfidence: minConfidence / 100,
      enabled: true,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      triggeredCount: 0,
    };

    onSaveAlert(newAlert);
    setAlertSavedNotice(true);
    setTimeout(() => setAlertSavedNotice(false), 3000);
  };

  const getClipForCamera = (cameraName: string) => {
    return (
      currentCase.clips.find((c) => c.camera.includes(cameraName) || cameraName.includes(c.camera)) ||
      currentCase.clips[0]
    );
  };

  return (
    <div id="search-investigation-view" className="p-5 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">
            Natural Language & Attribute Video Search
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Search events, persons, vehicles, and behavioral patterns across all synchronized camera angles.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
            {currentCase.clips.length} Feeds Indexed
          </span>
        </div>
      </div>

      {/* Main Search Input & Quick Samples */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleExecuteSearch();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
            <input
              id="natural-search-input"
              type="text"
              placeholder="e.g. Find all persons entering after 14:00 or a white vehicle parked in Zone A..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 shadow-sm"
          >
            {isLoading ? (
              <span>Searching...</span>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Search Footage</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Query Suggestions */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          <span className="text-slate-500">Suggested queries:</span>
          {sampleQueries.map((sample) => (
            <button
              key={sample}
              onClick={() => {
                setSearchQuery(sample);
                handleExecuteSearch(sample);
              }}
              className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>

      {/* Multi-modal Parametric Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
            <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            <span>Structured Filters & Attributes</span>
          </div>
          <button
            onClick={() => {
              setSelectedClasses([]);
              setSelectedColors([]);
              setSelectedActions([]);
              setSelectedCameras([]);
              setMinConfidence(75);
            }}
            className="text-xs text-slate-400 hover:text-white"
          >
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Object Class */}
          <div className="space-y-2">
            <label className="text-slate-400 font-medium">Object Type</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'person', label: 'Person', icon: User },
                { id: 'car', label: 'Car / Vehicle', icon: Car },
                { id: 'bag', label: 'Bag / Object', icon: Package },
                { id: 'bike', label: 'Bicycle', icon: Bike },
              ].map((c) => {
                const Icon = c.icon;
                const active = selectedClasses.includes(c.id as ObjectClass);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleClass(c.id as ObjectClass)}
                    className={`px-2.5 py-1.5 rounded-md flex items-center space-x-1.5 transition-colors border ${
                      active
                        ? 'bg-blue-600 text-white border-blue-500 font-medium'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activity / Action */}
          <div className="space-y-2">
            <label className="text-slate-400 font-medium">Activity Type</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'entry', label: 'Entry' },
                { id: 'exit', label: 'Exit' },
                { id: 'loitering', label: 'Loitering' },
                { id: 'running', label: 'Running' },
                { id: 'left_object', label: 'Unattended Object' },
              ].map((a) => {
                const active = selectedActions.includes(a.id as ActivityAction);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleAction(a.id as ActivityAction)}
                    className={`px-2.5 py-1.5 rounded-md transition-colors border ${
                      active
                        ? 'bg-blue-600 text-white border-blue-500 font-medium'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Filter */}
          <div className="space-y-2">
            <label className="text-slate-400 font-medium">Color Attribute</label>
            <div className="flex flex-wrap gap-1.5">
              {['black', 'white', 'blue', 'yellow', 'red', 'dark'].map((color) => {
                const active = selectedColors.includes(color);
                return (
                  <button
                    key={color}
                    onClick={() => toggleColor(color)}
                    className={`px-2.5 py-1.5 rounded-md capitalize transition-colors border ${
                      active
                        ? 'bg-blue-600 text-white border-blue-500 font-medium'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {color}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minimum Confidence */}
          <div className="space-y-2">
            <div className="flex justify-between text-slate-400">
              <label className="font-medium">Min Confidence</label>
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
        </div>
      </div>

      {/* Search Results Display */}
      {searchResponse && (
        <div className="space-y-4">
          {/* AI Synthesis Summary Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white">
                Investigation Query Analysis
              </h3>
              <button
                onClick={handleSaveAsAlert}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-1.5 transition-colors"
              >
                <Bell className="w-3.5 h-3.5 text-blue-400" />
                <span>Save as Standing Rule</span>
              </button>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              {searchResponse.explanation}
            </p>

            {alertSavedNotice && (
              <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Standing event rule saved successfully. You will be alerted when new footage matches this condition.</span>
              </div>
            )}
          </div>

          {/* Results Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Matching Incidents ({searchResponse.matchingClips?.length || 0})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResponse.matchingClips?.map((match, idx) => {
                const targetClip = getClipForCamera(match.camera);
                return (
                  <div
                    key={idx}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">
                        {match.camera}
                      </span>
                      <span className="text-xs font-mono text-blue-400 font-medium">
                        {formatTimestamp(match.timeSec)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {match.reason}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                      <span className="text-slate-400">
                        Confidence: <strong className="text-slate-200">{Math.round(match.confidence * 100)}%</strong>
                      </span>
                      <button
                        onClick={() => onJumpToClipTime(match.clipId || targetClip?.id || "", match.timeSec)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium flex items-center space-x-1.5 transition-colors"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Jump to Timestamp</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
