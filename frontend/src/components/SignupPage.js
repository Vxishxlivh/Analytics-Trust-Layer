import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, User, Building2 } from "lucide-react";

const PERSONAL_ROLES = [
  { value: "student", label: "Student" },
  { value: "analyst", label: "Analyst" },
  { value: "researcher", label: "Researcher" },
  { value: "other", label: "Other" },
];

const BUSINESS_ROLES = [
  { value: "analyst", label: "Analyst" },
  { value: "data_scientist", label: "Data Scientist" },
  { value: "manager", label: "Manager" },
  { value: "executive", label: "Executive" },
  { value: "other", label: "Other" },
];

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [step, setStep] = useState(1);
  const [useType, setUseType] = useState(null);
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const detectedOrg = useMemo(() => {
    if (useType !== "business" || !email.includes("@")) return null;
    const domain = email.split("@")[1];
    if (!domain) return null;
    const org = domain.split(".")[0];
    return org.charAt(0).toUpperCase() + org.slice(1);
  }, [email, useType]);

  const handleSelectType = (type) => {
    setUseType(type);
    setRole("");
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signup({
        email,
        password,
        name,
        use_type: useType,
        role,
        company: detectedOrg || "",
      });
      navigate("/");
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Signup failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const roles = useType === "personal" ? PERSONAL_ROLES : BUSINESS_ROLES;
  const canSubmit = name.trim() && email.trim() && password.trim() && role;

  return (
    <div className="min-h-screen bg-tl-bg flex items-center justify-center px-6">
      <div className="w-full max-w-lg" data-testid="signup-page">
        <div className="text-center mb-10">
          <h1 className="font-mono text-sm font-bold tracking-[0.15em] uppercase text-[#f8fafc] mb-3">
            [TRUST_LAYER]
          </h1>
        </div>

        {/* Step 1: Choose use type */}
        {step === 1 && (
          <div className="animate-fade-in-up" data-testid="signup-step-1">
            <h2 className="text-2xl font-semibold tracking-tight mb-2 text-center text-[#f8fafc]">
              Create Account
            </h2>
            <p className="text-[#64748b] text-sm text-center mb-10">
              How will you use TrustLayer?
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button
                data-testid="select-personal-btn"
                onClick={() => handleSelectType("personal")}
                className="border border-tl-border bg-tl-surface p-8 text-left hover:border-[#94a3b8] hover:bg-tl-surface-hover transition-colors group"
              >
                <User
                  size={24}
                  strokeWidth={1.5}
                  className="text-[#64748b] group-hover:text-[#f8fafc] mb-4 transition-colors"
                />
                <h3 className="text-[#f8fafc] font-semibold mb-2">Personal Use</h3>
                <p className="text-[#64748b] text-xs leading-relaxed">
                  For analysts, students, and researchers validating reports individually.
                </p>
              </button>
              <button
                data-testid="select-business-btn"
                onClick={() => handleSelectType("business")}
                className="border border-tl-border bg-tl-surface p-8 text-left hover:border-[#94a3b8] hover:bg-tl-surface-hover transition-colors group"
              >
                <Building2
                  size={24}
                  strokeWidth={1.5}
                  className="text-[#64748b] group-hover:text-[#f8fafc] mb-4 transition-colors"
                />
                <h3 className="text-[#f8fafc] font-semibold mb-2">Business Use</h3>
                <p className="text-[#64748b] text-xs leading-relaxed">
                  For teams validating AI-generated reports at scale within an organization.
                </p>
              </button>
            </div>

            <p className="mt-8 text-center text-sm text-[#64748b]">
              Already have an account?{" "}
              <Link
                to="/login"
                data-testid="go-to-login-link"
                className="text-[#f8fafc] hover:underline"
              >
                Log in
              </Link>
            </p>
          </div>
        )}

        {/* Step 2: Details form */}
        {step === 2 && (
          <div className="animate-fade-in-up" data-testid="signup-step-2">
            <button
              data-testid="signup-back-btn"
              onClick={() => { setStep(1); setUseType(null); }}
              className="flex items-center gap-2 text-[#64748b] hover:text-[#f8fafc] text-sm font-mono mb-6 transition-colors"
            >
              <ArrowLeft size={14} strokeWidth={1.5} />
              Back
            </button>

            <h2 className="text-2xl font-semibold tracking-tight mb-1 text-[#f8fafc]">
              {useType === "personal" ? "Personal Account" : "Business Account"}
            </h2>
            <p className="text-[#64748b] text-sm mb-8">
              {useType === "personal"
                ? "Set up your personal validation workspace."
                : "Connect with your organization."}
            </p>

            <form
              onSubmit={handleSubmit}
              className="border border-tl-border bg-tl-surface p-8"
            >
              {error && (
                <div
                  data-testid="signup-error"
                  className="mb-4 text-tl-wrong text-sm border border-tl-wrong/30 bg-tl-wrong/5 p-3"
                >
                  {error}
                </div>
              )}

              {/* Business: email first for org detection */}
              {useType === "business" && (
                <div className="mb-5">
                  <label className="font-mono text-[10px] text-[#94a3b8] uppercase tracking-[0.1em] block mb-2">
                    Company Email
                  </label>
                  <input
                    data-testid="signup-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-tl-bg border border-tl-border p-3 text-sm text-[#f8fafc] placeholder:text-[#64748b] focus:ring-1 focus:ring-white focus:outline-none font-mono"
                    autoFocus
                  />
                  {detectedOrg && (
                    <div
                      data-testid="detected-org"
                      className="mt-2 flex items-center gap-2"
                    >
                      <div className="w-1.5 h-1.5 bg-tl-verified rounded-full" />
                      <span className="text-tl-verified text-xs font-mono">
                        Organization detected: {detectedOrg}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Role selection */}
              <div className="mb-5">
                <label className="font-mono text-[10px] text-[#94a3b8] uppercase tracking-[0.1em] block mb-3">
                  Your Role
                </label>
                <div className="flex flex-wrap gap-2" data-testid="role-selector">
                  {roles.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      data-testid={`role-${r.value}`}
                      onClick={() => setRole(r.value)}
                      className={`px-4 py-2 text-xs font-mono uppercase tracking-[0.05em] border transition-colors ${
                        role === r.value
                          ? "bg-[#f8fafc] text-[#0a0f1a] border-[#f8fafc]"
                          : "text-[#94a3b8] border-tl-border hover:border-[#94a3b8] hover:text-[#f8fafc]"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div className="mb-5">
                <label className="font-mono text-[10px] text-[#94a3b8] uppercase tracking-[0.1em] block mb-2">
                  Full Name
                </label>
                <input
                  data-testid="signup-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-tl-bg border border-tl-border p-3 text-sm text-[#f8fafc] placeholder:text-[#64748b] focus:ring-1 focus:ring-white focus:outline-none"
                />
              </div>

              {/* Personal: email after role/name */}
              {useType === "personal" && (
                <div className="mb-5">
                  <label className="font-mono text-[10px] text-[#94a3b8] uppercase tracking-[0.1em] block mb-2">
                    Email
                  </label>
                  <input
                    data-testid="signup-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="w-full bg-tl-bg border border-tl-border p-3 text-sm text-[#f8fafc] placeholder:text-[#64748b] focus:ring-1 focus:ring-white focus:outline-none font-mono"
                  />
                </div>
              )}

              {/* Password */}
              <div className="mb-6">
                <label className="font-mono text-[10px] text-[#94a3b8] uppercase tracking-[0.1em] block mb-2">
                  Password
                </label>
                <input
                  data-testid="signup-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-tl-bg border border-tl-border p-3 text-sm text-[#f8fafc] placeholder:text-[#64748b] focus:ring-1 focus:ring-white focus:outline-none font-mono"
                />
              </div>

              <button
                data-testid="signup-submit-btn"
                type="submit"
                disabled={loading || !canSubmit}
                className="w-full px-6 py-3 bg-[#f8fafc] text-[#0a0f1a] font-mono text-sm font-semibold tracking-wide uppercase hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
