import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { authApi } from "@/services/api";
import { FieldLabel, PrimaryBtn, TextInput } from "@/components/ui-kit";
import { ACCENT, CANVAS, GRID_BG, INK, INK2, PANEL } from "@/lib/theme";

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
      router.push(next.startsWith("/") ? next : "/");
    } catch {
      setError(mode === "register" ? "Registration failed" : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: CANVAS, ...GRID_BG }}>
      <div className="w-full max-w-[360px] px-4">
        <div className="mb-6">
          <span className="font-mono text-sm font-medium tracking-[0.08em]" style={{ color: INK }}>
            [ ASCI ]
          </span>
        </div>

        <div className="border rounded-lg overflow-hidden" style={{ backgroundColor: PANEL, borderColor: "var(--border)" }}>
          <form onSubmit={submit} className="px-8 pt-8 pb-6">
            <h2 className="text-xl font-semibold mb-1" style={{ color: INK }}>
              {mode === "login" ? "Sign in" : "Create account"}
            </h2>
            <p className="text-sm mb-7" style={{ color: INK2 }}>
              {mode === "login"
                ? "Investigate footage with questions, not scrubbing."
                : "Join your organisation's investigation workspace."}
            </p>

            <div className="flex flex-col gap-4">
              {mode === "register" && (
                <div>
                  <FieldLabel>Email</FieldLabel>
                  <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="analyst@agency.gov" required />
                </div>
              )}
              <div>
                <FieldLabel>{mode === "register" ? "Username" : "Email / username"}</FieldLabel>
                <TextInput
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={mode === "register" ? "analyst" : "analyst@agency.gov"}
                  required
                />
              </div>
              <div>
                <FieldLabel>Password</FieldLabel>
                <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>

              {error && <p className="text-sm" style={{ color: "#A33232" }}>{error}</p>}

              <PrimaryBtn type="submit" disabled={loading} className="w-full">
                {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
              </PrimaryBtn>
            </div>

            <p className="text-center text-sm mt-6" style={{ color: INK2 }}>
              {mode === "login" ? "No account?" : "Already have an account?"}{" "}
              <button
                type="button"
                className="font-medium"
                style={{ color: ACCENT }}
                onClick={() => setMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Register" : "Sign in"}
              </button>
            </p>
          </form>
        </div>

        <p className="text-center mt-4">
          <Link href="/" className="text-sm" style={{ color: INK2 }}>
            Continue without signing in
          </Link>
        </p>
      </div>
    </div>
  );
}
