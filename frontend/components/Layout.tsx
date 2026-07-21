import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode, useEffect, useState } from "react";
import { Camera, LogOut, Search, Upload, LayoutDashboard } from "lucide-react";
import clsx from "clsx";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    setUsername(localStorage.getItem("username"));
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    router.push("/login");
  };

  const nav = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/upload", label: "Upload", icon: Upload },
    { href: "/search", label: "Search", icon: Search },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-surface-800 border-r border-surface-600 flex flex-col">
        <div className="p-6 border-b border-surface-600">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <Camera className="w-5 h-5 text-accent-glow" />
            </div>
            <div>
              <h1 className="font-semibold text-sm leading-tight">AI Security</h1>
              <p className="text-xs text-slate-500">Investigator</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                router.pathname === href
                  ? "bg-accent/15 text-accent-glow"
                  : "text-slate-400 hover:text-slate-200 hover:bg-surface-700"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-surface-600">
          {username ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 truncate">{username}</span>
              <button onClick={logout} className="text-slate-500 hover:text-slate-300">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link href="/login" className="text-sm text-accent hover:text-accent-glow">
              Sign in
            </Link>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
