import { ArrowLeft } from "lucide-react";

export default function AnalysisInput({
  analysisText,
  setAnalysisText,
  apiKey,
  setApiKey,
  onValidate,
  onDemo,
  onBack,
  error,
}) {
  const canValidate = analysisText.trim() && apiKey.trim();

  return (
    <div className="py-16 animate-fade-in-up">
      <button
        data-testid="back-to-data-btn"
        onClick={onBack}
        className="flex items-center gap-2 text-[#64748b] hover:text-[#f8fafc] text-sm font-mono mb-8 transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Back to data
      </button>

      <div className="mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tighter mb-4">
          Paste the Analysis
        </h1>
        <p className="text-[#94a3b8] text-base leading-relaxed max-w-2xl">
          Paste the AI-generated analysis or report text you want to validate
          against your source data.
        </p>
      </div>

      <div className="mb-8">
        <label className="font-mono text-xs text-[#94a3b8] uppercase tracking-[0.1em] block mb-3">
          Analysis Text
        </label>
        <textarea
          data-testid="analysis-input-textarea"
          value={analysisText}
          onChange={(e) => setAnalysisText(e.target.value)}
          placeholder={"Paste your AI-generated report here...\n\nExample: \"Our SaaS business showed strong growth in Q4 2024. Total MRR grew from $142K to $189K, representing a 33% increase. Customer acquisition cost decreased by 15% while the enterprise segment now represents 62% of total revenue...\""}
          className="w-full min-h-[400px] bg-tl-surface border border-tl-border p-8 text-base text-[#f8fafc] placeholder:text-[#64748b] focus:ring-1 focus:ring-white focus:outline-none resize-none leading-relaxed"
        />
      </div>

      <div className="mb-8">
        <label className="font-mono text-xs text-[#94a3b8] uppercase tracking-[0.1em] block mb-3">
          OpenAI API Key
        </label>
        <input
          data-testid="api-key-input"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="w-full max-w-lg bg-tl-surface border border-tl-border p-3 text-sm font-mono text-[#f8fafc] placeholder:text-[#64748b] focus:ring-1 focus:ring-white focus:outline-none"
        />
        <p className="mt-2 text-[#64748b] text-xs font-mono">
          Your key is sent directly to OpenAI and never stored.
        </p>
      </div>

      {error && (
        <div
          data-testid="validation-error"
          className="mb-6 text-tl-wrong text-sm border border-tl-wrong/30 bg-tl-wrong/5 p-4"
        >
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          data-testid="start-validation-button"
          onClick={onValidate}
          disabled={!canValidate}
          className="px-8 py-3 bg-[#f8fafc] text-[#0a0f1a] font-mono text-sm font-semibold tracking-wide uppercase hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Validate Report
        </button>
        <button
          data-testid="try-demo-analysis-btn"
          onClick={onDemo}
          className="px-8 py-3 border border-tl-border text-[#94a3b8] hover:text-[#f8fafc] hover:border-[#94a3b8] font-mono text-sm tracking-wide transition-colors"
        >
          Try Demo Instead
        </button>
      </div>
    </div>
  );
}
