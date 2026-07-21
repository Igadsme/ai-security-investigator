import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode, useEffect, useState } from "react";
import {
  Bell,
  Briefcase,
  LayoutDashboard,
  LogOut,
  Map,
  ScrollText,
  Search,
  Settings,
  Upload,
} from "lucide-react";
import { videoApi, Video } from "@/services/api";
import { ACCENT, ACCENT_SOFT, INK, INK2, PANEL, mapStatus } from "@/lib/theme";

interface LayoutProps {
  children: ReactNode;
  hideChrome?: boolean;
}

export default function Layout({ children, hideChrome }: LayoutProps) {
  const router = useRouter();
  const [processingCount, setProcessingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      videoApi
        .list()
        .then(({ data }) => {
          if (cancelled) return;
          const n = data.filter((v: Video) => {
            const s = mapStatus(v.status);
            return s === "processing" || s === "queued";
          }).length;
          setProcessingCount(n);
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [router.pathname]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    router.push("/login");
  };

  if (hideChrome) {
    return <>{children}</>;
  }

  const nav = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/cases", label: "Cases", icon: Briefcase },
    { href: "/upload", label: "Upload", icon: Upload },
    { href: "/search", label: "Search", icon: Search },
    { href: "/map", label: "Site map", icon: Map },
    { href: "/alerts", label: "Alerts", icon: Bell },
    { href: "/audit", label: "Audit log", icon: ScrollText },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "var(--background)" }}>
      <aside
        className="w-60 flex-shrink-0 flex flex-col border-r h-screen sticky top-0"
        style={{ backgroundColor: PANEL, borderColor: "var(--border)" }}
      >
        <div className="px-5 py-[18px] border-b" style={{ borderColor: "var(--border)" }}>
          <Link href="/" className="font-mono text-sm font-medium tracking-[0.08em]" style={{ color: INK }}>
            [ ASCI ]
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              router.pathname === href ||
              (href === "/" && router.pathname.startsWith("/video")) ||
              (href === "/cases" && router.pathname.startsWith("/cases"));
            return (
              <Link
                key={href}
                href={href}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                style={
                  active
                    ? { backgroundColor: ACCENT, color: "#FAFBFA" }
                    : { color: INK }
                }
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = ACCENT_SOFT;
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "";
                }}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        {processingCount > 0 && (
          <div
            className="mx-3 mb-2 px-3 py-2.5 rounded-md border"
            style={{ backgroundColor: "#F6EAD2", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#9C6B12" }} />
              <span className="text-xs" style={{ color: "#9C6B12" }}>
                {processingCount} job{processingCount > 1 ? "s" : ""} processing
              </span>
            </div>
          </div>
        )}

        <div className="px-3 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-left transition-colors"
            style={{ color: INK2 }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = ACCENT_SOFT;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "";
            }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
