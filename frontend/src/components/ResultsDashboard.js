import { useState } from "react";
import TrustScoreRing, { COLORS } from "@/components/TrustScoreRing";
import ClaimCard from "@/components/ClaimCard";
import { RotateCcw, Download } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RISK_COLORS = {
  LOW: "#10b981",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
  CRITICAL: "#991b1b",
};

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "wrong", label: "Wrong" },
  { key: "verified", label: "Verified" },
  { key: "partial", label: "Partial" },
  { key: "logic_gap", label: "Logic Gaps" },
  { key: "unverifiable", label: "Unverifiable" },
];

const STAT_ITEMS = [
  { key: "verified", label: "Verified", color: COLORS.verified },
  { key: "wrong", label: "Wrong", color: COLORS.wrong },
  { key: "partial", label: "Partial", color: COLORS.partial },
  { key: "logic_gap", label: "Logic Gaps", color: COLORS.logic_gap },
  { key: "unverifiable", label: "Unverifiable", color: COLORS.unverifiable },
];

export default function ResultsDashboard({ result, onReset }) {
  const [filter, setFilter] = useState("all");
  const [exporting, setExporting] = useState(false);

  const filteredClaims = filter === "all"
    ? result.claims
    : result.claims.filter((c) => c.status === filter);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const response = await axios.post(`${API}/export-pdf`, result, {
        responseType: "blob",
        validateStatus: (status) => status < 500,
      });
      if (response.status !== 200) {
        toast.error("PDF export failed");
        return;
      }
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `trustlayer-report-${result.trust_score}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("PDF exported successfully");
    } catch (e) {
      toast.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="py-16 animate-fade-in-up" data-testid="results-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-16">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tighter">
            Trust Report
          </h1>
          {result.is_demo && (
            <span className="font-mono text-xs text-[#64748b] uppercase tracking-[0.1em] mt-2 inline-block">
              Demo Mode — Sample SaaS Financial Report
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            data-testid="export-pdf-btn"
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 border border-tl-border text-[#94a3b8] hover:text-[#f8fafc] hover:border-[#94a3b8] font-mono text-sm transition-colors disabled:opacity-40"
          >
            <Download size={14} strokeWidth={1.5} />
            {exporting ? "Exporting..." : "Export PDF"}
          </button>
          <button
            data-testid="start-new-btn"
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 border border-tl-border text-[#94a3b8] hover:text-[#f8fafc] hover:border-[#94a3b8] font-mono text-sm transition-colors"
          >
            <RotateCcw size={14} strokeWidth={1.5} />
            New Validation
          </button>
        </div>
      </div>

      {/* Score Section */}
      <div className="flex flex-col items-center py-16 border-y border-tl-border mb-16">
        <div className="relative">
          <TrustScoreRing score={result.trust_score} />
        </div>
        <div className="mt-8">
          <span
            data-testid="decision-risk-badge"
            className="font-mono text-sm font-bold tracking-[0.15em] uppercase px-4 py-2 border"
            style={{
              borderColor: RISK_COLORS[result.decision_risk],
              color: RISK_COLORS[result.decision_risk],
            }}
          >
            {result.decision_risk} RISK
          </span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-16" data-testid="summary-stats">
        {STAT_ITEMS.map((item) => (
          <div
            key={item.key}
            className="border border-tl-border bg-tl-surface p-4"
            data-testid={`stat-${item.key}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="status-dot" style={{ backgroundColor: item.color }} />
              <span className="font-mono text-[10px] text-[#64748b] uppercase tracking-[0.1em]">
                {item.label}
              </span>
            </div>
            <span className="font-mono text-2xl font-bold" style={{ color: item.color }}>
              {result.summary?.[item.key] || 0}
            </span>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6" data-testid="claim-filters">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            data-testid={`filter-${opt.key}-btn`}
            onClick={() => setFilter(opt.key)}
            className={`px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] transition-colors ${
              filter === opt.key
                ? "bg-[#f8fafc] text-[#0a0f1a]"
                : "text-[#94a3b8] hover:text-[#f8fafc]"
            }`}
          >
            {opt.label}
            {opt.key !== "all" && (
              <span className="ml-1 opacity-60">
                {result.summary?.[opt.key] || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Claims List */}
      <div className="flex flex-col gap-3 mb-24" data-testid="claims-list">
        {filteredClaims.map((claim, i) => (
          <ClaimCard key={claim.id || i} claim={claim} index={i} />
        ))}
        {filteredClaims.length === 0 && (
          <p className="text-[#64748b] text-sm font-mono py-8 text-center">
            No claims match this filter.
          </p>
        )}
      </div>

      {/* Analysis Sections */}
      <AnalysisSection
        testId="missing-context-section"
        index="01"
        title="What's Missing"
        subtitle="Things the analysis should have mentioned but didn't"
        items={result.missing_context}
      />
      <AnalysisSection
        testId="hidden-assumptions-section"
        index="02"
        title="Hidden Assumptions"
        subtitle="Assumptions baked into the analysis"
        items={result.hidden_assumptions}
      />
      <AnalysisSection
        testId="alternative-explanations-section"
        index="03"
        title="Alternative Explanations"
        subtitle="Other ways to interpret the data"
        items={result.alternative_explanations}
      />

      <div className="py-16" />
    </div>
  );
}

function AnalysisSection({ testId, index, title, subtitle, items }) {
  if (!items || items.length === 0) return null;

  return (
    <div data-testid={testId} className="mb-16 border-t border-tl-border pt-12">
      <div className="flex items-baseline gap-4 mb-2">
        <span className="font-mono text-xs text-[#64748b]">{index}</span>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h2>
      </div>
      <p className="text-[#64748b] text-sm mb-8 ml-8">{subtitle}</p>
      <div className="flex flex-col gap-3 ml-8">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-4 text-sm">
            <span className="font-mono text-[#64748b] flex-shrink-0 w-6 text-right">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="text-[#94a3b8] leading-relaxed">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
