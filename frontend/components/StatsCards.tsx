import { Users, Car, Activity, Eye } from "lucide-react";
import { Stats } from "@/services/api";

interface Props {
  stats: Stats;
}

export default function StatsCards({ stats }: Props) {
  const cards = [
    {
      label: "Total Detections",
      value: stats.total_detections,
      icon: Eye,
      color: "text-blue-400",
    },
    {
      label: "Unique People",
      value: stats.unique_people,
      icon: Users,
      color: "text-green-400",
    },
    {
      label: "Vehicles",
      value: (stats.unique_tracks?.car || 0) + (stats.unique_tracks?.truck || 0),
      icon: Car,
      color: "text-amber-400",
    },
    {
      label: "Activity Events",
      value: stats.activity_count,
      icon: Activity,
      color: "text-purple-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="card">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-surface-700 flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        </div>
      ))}
      {stats.peak_activity_timestamp && (
        <div className="col-span-2 lg:col-span-4 card bg-accent/5 border-accent/20">
          <p className="text-sm text-slate-400">
            Peak activity at{" "}
            <span className="font-mono text-accent-glow">{stats.peak_activity_timestamp}</span>
          </p>
        </div>
      )}
    </div>
  );
}
