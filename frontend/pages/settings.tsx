import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { forensicApi, authApi } from "@/services/api";
import { useCase } from "@/lib/CaseContext";

export default function SettingsPage() {
  const ctx = useCase();
  const [days, setDays] = useState(90);
  const [autoDelete, setAutoDelete] = useState(true);
  const [roleUserId, setRoleUserId] = useState("");
  const [role, setRole] = useState("investigator");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    forensicApi.getRetention().then(({ data }) => {
      const d = data as { retention_days?: number; auto_delete?: boolean };
      if (d.retention_days) setDays(d.retention_days);
      if (d.auto_delete != null) setAutoDelete(Boolean(d.auto_delete));
    }).catch(() => {});
  }, []);

  return (
    <Layout>
      <div className="p-5 max-w-xl mx-auto space-y-4">
        <h1 className="text-sm font-semibold text-white">Settings</h1>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2 text-sm">
          <p className="text-slate-400 text-xs uppercase tracking-wide">Signed in</p>
          <p className="text-slate-100">
            {ctx.me?.username} · <span className="capitalize">{ctx.me?.role}</span>
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Retention</p>
          <label className="block text-xs text-slate-400">
            Days
            <input
              type="number"
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-100"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center space-x-2 text-xs text-slate-300">
            <input type="checkbox" checked={autoDelete} onChange={(e) => setAutoDelete(e.target.checked)} />
            <span>Auto-delete expired footage</span>
          </label>
          <button
            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded"
            onClick={async () => {
              await forensicApi.updateRetention({ retention_days: days, auto_delete: autoDelete });
              setMsg("Retention saved");
            }}
          >
            Save policy
          </button>
        </div>
        {ctx.me?.role === "admin" && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">Assign role</p>
            <input
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100"
              placeholder="User id"
              value={roleUserId}
              onChange={(e) => setRoleUserId(e.target.value)}
            />
            <select
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="viewer">Viewer</option>
              <option value="investigator">Investigator</option>
              <option value="admin">Admin</option>
            </select>
            <button
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-xs rounded text-slate-100"
              onClick={async () => {
                await forensicApi.setUserRole(Number(roleUserId), role);
                setMsg("Role updated");
                await authApi.me();
              }}
            >
              Update role
            </button>
          </div>
        )}
        {msg && <p className="text-xs text-emerald-400">{msg}</p>}
      </div>
    </Layout>
  );
}
