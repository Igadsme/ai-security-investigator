import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Camera } from "lucide-react";
import { authApi } from "@/services/api";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
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
      if (isRegister) {
        await authApi.register(email, username, password);
      }
      const { data } = await authApi.login(username, password);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("username", username);
      router.push("/");
    } catch {
      setError(isRegister ? "Registration failed" : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-accent/20 flex items-center justify-center mx-auto mb-4">
            <Camera className="w-8 h-8 text-accent-glow" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">AI Security Investigator</h1>
          <p className="text-slate-500 mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={submit} className="card space-y-4">
          {isRegister && (
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Email</label>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Username</label>
            <input
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Password</label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "..." : isRegister ? "Create Account" : "Sign In"}
          </button>

          <p className="text-center text-sm text-slate-500">
            {isRegister ? "Already have an account?" : "No account?"}{" "}
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-accent hover:text-accent-glow"
            >
              {isRegister ? "Sign in" : "Register"}
            </button>
          </p>
        </form>

        <p className="text-center mt-4">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
            Continue without signing in
          </Link>
        </p>
      </div>
    </div>
  );
}
