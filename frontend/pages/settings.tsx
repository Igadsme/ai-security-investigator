import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PrimaryBtn, TopBar } from "@/components/ui-kit";
import { authApi, forensicApi } from "@/services/api";
import { BORDER, CANVAS, INK, INK2, PANEL } from "@/lib/theme";

export default function SettingsPage() {
  const [me, setMe] = useState<{ id: number; username: string; role: string } | null>(null);
  const [retention, setRetention] = useState<{ retention_days?: number; auto_delete?: boolean }>({});
  const [days, setDays] = useState(90);
  const [autoDelete, setAutoDelete] = useState(true);
  const [roleUserId, setRoleUserId] = useState("");
  const [role, setRole] = useState("investigator");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    authApi.me().then(({ data }) => setMe(data)).catch(() => setMe(null));
    forensicApi
      .getRetention()
      .then(({ data }) => {
        const d = data as any;
        setRetention(d);
        if (d.retention_days) setDays(d.retention_days);
        if (d.auto_delete != null) setAutoDelete(Boolean(d.auto_delete));
      })
      .catch(() => {});
  }, []);

  return (
    <Layout>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: CANVAS }}>
        <TopBar title="Settings" subtitle="Roles, retention policy, operational controls" />
        <div className="px-8 py-6 max-w-2xl space-y-6">
          <div className="border rounded-lg p-5" style={{ backgroundColor: PANEL, borderColor: BORDER }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: INK2 }}>
              Your role
            </p>
            {me ? (
              <p className="text-sm" style={{ color: INK }}>
                Signed in as <span className="font-mono">{me.username}</span> · role{" "}
                <span className="font-mono">{me.role}</span>
              </p>
            ) : (
              <p className="text-sm" style={{ color: INK2 }}>
                Not signed in.
              </p>
            )}
            <p className="text-xs mt-2" style={{ color: INK2 }}>
              viewer · investigator · admin — viewers cannot export evidence or delete footage.
            </p>
          </div>

          <div className="border rounded-lg p-5" style={{ backgroundColor: PANEL, borderColor: BORDER }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-3" style={{ color: INK2 }}>
              Retention & auto-delete
            </p>
            <label className="block text-xs mb-1" style={{ color: INK2 }}>
              Default retention days
            </label>
            <input
              type="number"
              className="w-40 text-sm px-3 py-2 border rounded-sm mb-3"
              style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
            <label className="flex items-center gap-2 text-xs mb-3" style={{ color: INK }}>
              <input type="checkbox" checked={autoDelete} onChange={(e) => setAutoDelete(e.target.checked)} />
              Auto-delete after retention window
            </label>
            <div className="flex gap-2 flex-wrap">
              <PrimaryBtn
                onClick={async () => {
                  try {
                    await forensicApi.updateRetention({ retention_days: days, auto_delete: autoDelete });
                    setMsg("Retention policy saved");
                  } catch {
                    setMsg("Admin required to update retention");
                  }
                }}
              >
                Save policy
              </PrimaryBtn>
              <PrimaryBtn
                onClick={async () => {
                  try {
                    const { data } = await forensicApi.runRetention();
                    setMsg(`Cleanup: ${JSON.stringify(data)}`);
                  } catch {
                    setMsg("Cleanup failed");
                  }
                }}
              >
                Run cleanup now
              </PrimaryBtn>
            </div>
            {retention.retention_days != null && (
              <p className="text-xs mt-2 font-mono" style={{ color: INK2 }}>
                Current: {retention.retention_days}d · auto={String(retention.auto_delete)}
              </p>
            )}
          </div>

          <div className="border rounded-lg p-5" style={{ backgroundColor: PANEL, borderColor: BORDER }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-3" style={{ color: INK2 }}>
              Assign user role (admin)
            </p>
            <div className="flex gap-2 flex-wrap">
              <input
                className="text-sm px-3 py-2 border rounded-sm w-28"
                style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
                placeholder="User ID"
                value={roleUserId}
                onChange={(e) => setRoleUserId(e.target.value)}
              />
              <select
                className="text-sm px-3 py-2 border rounded-sm"
                style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="viewer">viewer</option>
                <option value="investigator">investigator</option>
                <option value="admin">admin</option>
              </select>
              <PrimaryBtn
                onClick={async () => {
                  try {
                    await forensicApi.setUserRole(Number(roleUserId), role);
                    setMsg(`User ${roleUserId} → ${role}`);
                  } catch {
                    setMsg("Admin required");
                  }
                }}
              >
                Update role
              </PrimaryBtn>
            </div>
          </div>

          {msg && (
            <p className="text-sm font-mono" style={{ color: INK2 }}>
              {msg}
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
