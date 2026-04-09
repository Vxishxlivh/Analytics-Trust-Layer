import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Login failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-tl-bg flex items-center justify-center px-6">
      <div className="w-full max-w-sm" data-testid="login-page">
        <div className="text-center mb-12">
          <h1 className="font-mono text-sm font-bold tracking-[0.15em] uppercase text-[#f8fafc] mb-3">
            [TRUST_LAYER]
          </h1>
          <p className="text-[#64748b] text-sm">
            AI Report Validation
          </p>
        </div>

        <form onSubmit={handleSubmit} className="border border-tl-border bg-tl-surface p-8">
          <h2 className="text-xl font-semibold tracking-tight mb-6 text-[#f8fafc]">
            Log In
          </h2>

          {error && (
            <div
              data-testid="login-error"
              className="mb-4 text-tl-wrong text-sm border border-tl-wrong/30 bg-tl-wrong/5 p-3"
            >
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="font-mono text-[10px] text-[#94a3b8] uppercase tracking-[0.1em] block mb-2">
              Email
            </label>
            <input
              data-testid="login-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full bg-tl-bg border border-tl-border p-3 text-sm text-[#f8fafc] placeholder:text-[#64748b] focus:ring-1 focus:ring-white focus:outline-none font-mono"
              autoFocus
            />
          </div>

          <div className="mb-6">
            <label className="font-mono text-[10px] text-[#94a3b8] uppercase tracking-[0.1em] block mb-2">
              Password
            </label>
            <input
              data-testid="login-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-tl-bg border border-tl-border p-3 text-sm text-[#f8fafc] placeholder:text-[#64748b] focus:ring-1 focus:ring-white focus:outline-none font-mono"
            />
          </div>

          <button
            data-testid="login-submit-btn"
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            className="w-full px-6 py-3 bg-[#f8fafc] text-[#0a0f1a] font-mono text-sm font-semibold tracking-wide uppercase hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#64748b]">
          No account?{" "}
          <Link
            to="/signup"
            data-testid="go-to-signup-link"
            className="text-[#f8fafc] hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
