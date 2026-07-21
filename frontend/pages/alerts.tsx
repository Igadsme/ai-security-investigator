import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PrimaryBtn, TopBar } from "@/components/ui-kit";
import { forensicApi, SavedSearch } from "@/services/api";
import { BORDER, CANVAS, INK, INK2, PANEL } from "@/lib/theme";

export default function AlertsPage() {
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [objectClass, setObjectClass] = useState("");
  const [color, setColor] = useState("");
  const [asAlert, setAsAlert] = useState(true);
  const [evalResult, setEvalResult] = useState("");

  const load = () =>
    forensicApi.listSavedSearches().then(({ data }) => setItems(data)).catch(() => setItems([]));

  useEffect(() => {
    load();
  }, []);

  return (
    <Layout>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: CANVAS }}>
        <TopBar title="Saved searches & alerts" subtitle="Standing watches — notify when future footage matches" />
        <div className="px-8 py-6 grid lg:grid-cols-[360px_1fr] gap-6">
          <div className="border rounded-lg p-5 h-fit" style={{ backgroundColor: PANEL, borderColor: BORDER }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-3" style={{ color: INK2 }}>
              Create standing alert
            </p>
            <input
              className="w-full text-sm px-3 py-2 border rounded-sm mb-2"
              style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
              placeholder="Name (e.g. Red truck after hours)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="w-full text-sm px-3 py-2 border rounded-sm mb-2"
              style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
              placeholder="NL query (optional)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                className="text-sm px-3 py-2 border rounded-sm"
                style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
                placeholder="Class"
                value={objectClass}
                onChange={(e) => setObjectClass(e.target.value)}
              />
              <input
                className="text-sm px-3 py-2 border rounded-sm"
                style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
                placeholder="Color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-xs mb-3" style={{ color: INK }}>
              <input type="checkbox" checked={asAlert} onChange={(e) => setAsAlert(e.target.checked)} />
              Standing alert (proactive)
            </label>
            <PrimaryBtn
              disabled={!name.trim()}
              onClick={async () => {
                await forensicApi.createSavedSearch({
                  name: name.trim(),
                  query: query.trim() || undefined,
                  filters: {
                    ...(objectClass ? { object_class: objectClass } : {}),
                    ...(color ? { color } : {}),
                  },
                  is_alert: asAlert,
                });
                setName("");
                setQuery("");
                setObjectClass("");
                setColor("");
                load();
              }}
            >
              Save
            </PrimaryBtn>
            <div className="mt-4 pt-4 border-t" style={{ borderColor: BORDER }}>
              <PrimaryBtn
                onClick={async () => {
                  try {
                    const { data } = await forensicApi.evaluateAlerts();
                    setEvalResult(
                      data.triggered.length
                        ? `Triggered: ${data.triggered.map((t) => `${t.name} (${t.hit_count})`).join(", ")}`
                        : "No alerts triggered"
                    );
                    load();
                  } catch {
                    setEvalResult("Evaluate failed (investigator role required)");
                  }
                }}
              >
                Evaluate alerts now
              </PrimaryBtn>
              {evalResult && (
                <p className="text-xs mt-2" style={{ color: INK2 }}>
                  {evalResult}
                </p>
              )}
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden" style={{ borderColor: BORDER }}>
            {items.map((s, i) => (
              <div
                key={s.id}
                className="px-4 py-3 border-b last:border-0"
                style={{ backgroundColor: i % 2 === 0 ? CANVAS : PANEL, borderColor: BORDER }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium" style={{ color: INK }}>
                    {s.name}
                  </p>
                  <span className="text-[10px] uppercase font-mono" style={{ color: INK2 }}>
                    {s.is_alert ? `alert · ${s.alert_status || "active"}` : "saved"}
                  </span>
                </div>
                {s.query && (
                  <p className="text-xs mt-1" style={{ color: INK2 }}>
                    {s.query}
                  </p>
                )}
                {s.last_triggered_at && (
                  <p className="font-mono text-[10px] mt-1" style={{ color: "#9C6B12" }}>
                    Last triggered {new Date(s.last_triggered_at).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
            {!items.length && (
              <p className="px-4 py-8 text-sm" style={{ color: INK2 }}>
                No saved searches yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
