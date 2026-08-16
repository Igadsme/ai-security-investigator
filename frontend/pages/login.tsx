import { useState } from "react";
import { useRouter } from "next/router";
import { Shield } from "lucide-react";
import { authApi } from "@/services/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = mode === "register" ? username || email.split("@")[0] : username || email;
      if (mode === "register") {
        await authApi.register(email, user, password);
      }
      const { data } = await authApi.login(user, password);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("username", user);
      const next = typeof router.query.next === "string" ? router.query.next : "/";
      window.location.href = next.startsWith("/") ? next : "/";
    } catch {
      setError(mode === "register" ? "Registration failed" : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-white">VeriSight</p>
            <p className="text-xs text-slate-400">Security Investigation Platform</p>
          </div>
        </div>
        <form onSubmit={submit} className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
          <p className="text-sm font-medium text-white">{mode === "login" ? "Sign in" : "Create account"}</p>
          {mode === "register" && (
            <input
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
          <input
            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 rounded"
          >
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Register"}
          </button>
          <button
            type="button"
            className="w-full text-xs text-slate-400 hover:text-slate-200"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
