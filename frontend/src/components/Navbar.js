import { useNavigate, useLocation } from "react-router-dom";
import { Clock } from "lucide-react";

export default function Navbar({ onReset, currentStep }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHistory = location.pathname === "/history";

  return (
    <nav
      data-testid="navbar"
      className="sticky top-0 z-50 bg-tl-bg border-b border-tl-border"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 h-14 flex items-center justify-between">
        <button
          data-testid="nav-home-link"
          onClick={onReset}
          className="font-mono text-sm font-bold tracking-[0.15em] uppercase text-[#f8fafc] hover:text-white transition-colors"
        >
          [TRUST_LAYER]
        </button>
        <div className="flex items-center gap-6">
          {!isHistory && (
            <>
              <StepIndicator label="01 DATA" active={currentStep === "data"} />
              <StepIndicator label="02 ANALYSIS" active={currentStep === "analysis"} />
              <StepIndicator label="03 VALIDATE" active={currentStep === "loading"} />
              <StepIndicator label="04 RESULTS" active={currentStep === "results"} />
              <div className="w-px h-4 bg-tl-border mx-1" />
            </>
          )}
          <button
            data-testid="nav-history-link"
            onClick={() => navigate("/history")}
            className={`flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] uppercase transition-colors ${
              isHistory ? "text-[#f8fafc]" : "text-[#64748b] hover:text-[#94a3b8]"
            }`}
          >
            <Clock size={12} strokeWidth={1.5} />
            History
          </button>
        </div>
      </div>
    </nav>
  );
}

function StepIndicator({ label, active }) {
  return (
    <span
      className={`font-mono text-[10px] tracking-[0.1em] uppercase transition-colors ${
        active ? "text-[#f8fafc]" : "text-[#64748b]"
      }`}
    >
      {label}
    </span>
  );
}
