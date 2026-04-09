export default function Navbar({ onReset, currentStep }) {
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
          <StepIndicator step="data" label="01 DATA" active={currentStep === "data"} />
          <StepIndicator step="analysis" label="02 ANALYSIS" active={currentStep === "analysis"} />
          <StepIndicator step="loading" label="03 VALIDATE" active={currentStep === "loading"} />
          <StepIndicator step="results" label="04 RESULTS" active={currentStep === "results"} />
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
