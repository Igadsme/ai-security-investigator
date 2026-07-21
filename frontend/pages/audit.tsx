import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { TopBar } from "@/components/ui-kit";
import { AuditEntry, forensicApi } from "@/services/api";
import { BORDER, CANVAS, INK, INK2, PANEL } from "@/lib/theme";

export default function AuditPage() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    forensicApi
      .audit(200)
      .then(({ data }) => setRows(data))
      .catch(() => setError("Audit log requires investigator or admin role."));
  }, []);

  return (
    <Layout>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: CANVAS }}>
        <TopBar title="Chain of custody" subtitle="Every upload, view, export, search, and clip — who and when" />
        <div className="px-8 py-6">
          {error && (
            <p className="text-sm mb-4" style={{ color: "#A33232" }}>
              {error}
            </p>
          )}
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: BORDER }}>
            <div
              className="grid text-[11px] font-semibold uppercase tracking-[0.06em] px-4 py-3 border-b"
              style={{
                gridTemplateColumns: "160px 120px 1fr 100px 140px",
                backgroundColor: PANEL,
                color: INK2,
                borderColor: BORDER,
              }}
            >
              <div>When</div>
              <div>User</div>
              <div>Action</div>
              <div>Resource</div>
              <div>IP</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.id}
                className="grid px-4 py-2.5 border-b last:border-0 text-xs"
                style={{
                  gridTemplateColumns: "160px 120px 1fr 100px 140px",
                  backgroundColor: i % 2 === 0 ? CANVAS : PANEL,
                  borderColor: BORDER,
                  color: INK,
                }}
              >
                <div className="font-mono" style={{ color: INK2 }}>
                  {new Date(r.created_at).toLocaleString()}
                </div>
                <div>{r.username || "—"}</div>
                <div>
                  <span className="font-mono">{r.action}</span>
                  {r.details && (
                    <span className="block text-[10px] mt-0.5 truncate" style={{ color: INK2 }}>
                      {JSON.stringify(r.details)}
                    </span>
                  )}
                </div>
                <div className="font-mono" style={{ color: INK2 }}>
                  {r.resource_type || "—"}
                  {r.resource_id != null ? ` #${r.resource_id}` : ""}
                </div>
                <div className="font-mono" style={{ color: INK2 }}>
                  {r.ip_address || "—"}
                </div>
              </div>
            ))}
            {!rows.length && !error && (
              <p className="px-4 py-8 text-sm" style={{ color: INK2 }}>
                No audit entries yet. Actions will appear here as the team works.
              </p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
