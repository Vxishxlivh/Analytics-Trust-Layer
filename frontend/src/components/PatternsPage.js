import { useState, useEffect } from "react";
import axios from "axios";
import { AUTH_API } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STATUS_COLORS = {
  verified: "#10b981",
  wrong: "#ef4444",
  partial: "#f59e0b",
  logic_gap: "#8b5cf6",
  unverifiable: "#6b7280",
};

const STATUS_LABELS = {
  verified: "Verified",
  wrong: "Wrong",
  partial: "Partial",
  logic_gap: "Logic Gap",
  unverifiable: "Unverifiable",
};

function getScoreColor(score) {
  if (score >= 75) return "#10b981";
  if (score >= 50) return "#f59e0b";
  if (score >= 25) return "#ef4444";
  return "#991b1b";
}

export default function PatternsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPatterns = async () => {
      try {
        const res = await axios.get(`${AUTH_API}/patterns`);
        setData(res.data);
      } catch (e) {
        const msg = e.response?.data?.detail || e.message || "Failed to load patterns";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchPatterns();
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center" data-testid="patterns-loading">
        <span className="font-mono text-sm text-[#94a3b8]">Loading intelligence report...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16" data-testid="patterns-error">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-[#64748b] hover:text-[#f8fafc] text-sm font-mono mb-8 transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          Back
        </button>
        <div className="border border-tl-wrong/30 bg-tl-wrong/5 p-6 text-tl-wrong text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalClaims = data.total_claims_validated ?? data.total_claims ?? 0;
  const statusDist = data.status_distribution ?? {};
  const typeAccuracy = data.type_accuracy_breakdown ?? data.type_accuracy ?? {};
  const failurePatterns = data.ai_failure_patterns ?? data.failure_patterns ?? [];
  const scoreTrend = data.trust_score_trend ?? data.score_trend ?? [];
  const wrongKeywords = data.top_wrong_keywords ?? data.wrong_keywords ?? [];
  const insights = data.insights ?? data.auto_insights ?? [];

  const totalStatusClaims = Object.values(statusDist).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0) || 1;

  return (
    <div className="py-16 animate-fade-in-up" data-testid="patterns-page">
      <button
        data-testid="patterns-back-btn"
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-[#64748b] hover:text-[#f8fafc] text-sm font-mono mb-8 transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Back
      </button>

      <div className="mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tighter mb-2">
          Validation Intelligence
        </h1>
        <p className="text-[#94a3b8] text-base">
          Patterns and insights from{" "}
          <span className="font-mono text-[#f8fafc] font-bold">{totalClaims.toLocaleString()}</span>{" "}
          validated claims.
        </p>
      </div>

      {/* Status Distribution */}
      <Section number="01" title="Status Distribution">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {Object.entries(statusDist).map(([key, val]) => {
            const count = typeof val === "number" ? val : (val?.count ?? 0);
            return (
              <div
                key={key}
                className="border border-tl-border bg-tl-surface p-4"
                data-testid={`pattern-stat-${key}`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div
                    className="status-dot"
                    style={{ backgroundColor: STATUS_COLORS[key] || "#6b7280" }}
                  />
                  <span className="font-mono text-[9px] text-[#64748b] uppercase tracking-[0.1em]">
                    {STATUS_LABELS[key] || key.replace(/_/g, " ")}
                  </span>
                </div>
                <span
                  className="font-mono text-2xl font-bold"
                  style={{ color: STATUS_COLORS[key] || "#6b7280" }}
                >
                  {count.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Stacked bar */}
        <div className="h-3 flex overflow-hidden" data-testid="status-bar">
          {Object.entries(statusDist).map(([key, val]) => {
            const count = typeof val === "number" ? val : (val?.count ?? 0);
            const pct = (count / totalStatusClaims) * 100;
            return (
              <div
                key={key}
                style={{
                  width: `${pct}%`,
                  backgroundColor: STATUS_COLORS[key] || "#6b7280",
                }}
                title={`${STATUS_LABELS[key] || key}: ${count} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
      </Section>

      {/* Trust Score Trend */}
      {scoreTrend.length > 0 && (
        <Section number="02" title="Trust Score Trend">
          <div className="flex items-end gap-1 h-40" data-testid="score-trend-chart">
            {scoreTrend.map((item, i) => {
              const score = item.score ?? item.avg_score ?? item.average ?? item.value ?? 0;
              const label = item.date ?? item.period ?? item.label ?? `#${i + 1}`;
              const height = Math.max(score, 2);
              return (
                <div key={i} className="flex flex-col items-center flex-1 gap-1">
                  <span className="font-mono text-[9px] text-[#94a3b8]">{score}</span>
                  <div
                    className="w-full min-w-[12px] transition-all"
                    style={{
                      height: `${height}%`,
                      backgroundColor: getScoreColor(score),
                      opacity: 0.85,
                    }}
                  />
                  <span className="font-mono text-[8px] text-[#64748b] truncate max-w-full">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Type Accuracy Breakdown */}
      {Object.keys(typeAccuracy).length > 0 && (
        <Section number="03" title="Claim Type Accuracy">
          <div className="flex flex-col gap-3">
            {Object.entries(typeAccuracy).map(([type, val]) => {
              const accuracy = typeof val === "number" ? val : (val?.accuracy ?? val?.correct_pct ?? 0);
              const total = typeof val === "object" ? (val?.total ?? 0) : 0;
              return (
                <div key={type} className="flex items-center gap-4" data-testid={`type-accuracy-${type}`}>
                  <span className="font-mono text-xs text-[#94a3b8] uppercase tracking-[0.05em] w-36 flex-shrink-0">
                    {type.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 h-2 bg-tl-border">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${Math.min(accuracy, 100)}%`,
                        backgroundColor: getScoreColor(accuracy),
                      }}
                    />
                  </div>
                  <span className="font-mono text-sm font-bold w-14 text-right" style={{ color: getScoreColor(accuracy) }}>
                    {accuracy.toFixed(0)}%
                  </span>
                  {total > 0 && (
                    <span className="font-mono text-[10px] text-[#64748b] w-16 text-right">
                      n={total}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* AI Failure Patterns */}
      {failurePatterns.length > 0 && (
        <Section number="04" title="AI Failure Patterns">
          <div className="flex flex-col gap-3">
            {failurePatterns.map((p, i) => {
              const pattern = typeof p === "string" ? p : (p.pattern ?? p.description ?? p.name ?? JSON.stringify(p));
              const freq = typeof p === "object" ? (p.frequency ?? p.count ?? p.occurrences ?? null) : null;
              return (
                <div
                  key={i}
                  className="flex items-start gap-4 border border-tl-border bg-tl-surface p-4"
                  data-testid={`failure-pattern-${i}`}
                >
                  <span className="font-mono text-xs text-[#64748b] flex-shrink-0 w-6 text-right">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-sm text-[#94a3b8] leading-relaxed flex-1">{pattern}</p>
                  {freq !== null && (
                    <span className="font-mono text-xs text-tl-wrong flex-shrink-0">
                      {freq}x
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Top Wrong Keywords */}
      {wrongKeywords.length > 0 && (
        <Section number="05" title="Top Wrong Keywords">
          <div className="flex flex-wrap gap-2" data-testid="wrong-keywords">
            {wrongKeywords.map((kw, i) => {
              const word = typeof kw === "string" ? kw : (kw.keyword ?? kw.word ?? kw.term ?? "");
              const count = typeof kw === "object" ? (kw.count ?? kw.frequency ?? kw.occurrences ?? null) : null;
              return (
                <span
                  key={i}
                  className="px-3 py-1.5 border border-tl-wrong/40 text-tl-wrong font-mono text-xs"
                  data-testid={`keyword-${i}`}
                >
                  {word}
                  {count !== null && (
                    <span className="ml-1.5 text-tl-wrong/60">{count}</span>
                  )}
                </span>
              );
            })}
          </div>
        </Section>
      )}

      {/* Auto-Generated Insights */}
      {insights.length > 0 && (
        <Section number="06" title="Auto-Generated Insights">
          <div className="flex flex-col gap-3" data-testid="insights-list">
            {insights.map((insight, i) => {
              const text = typeof insight === "string" ? insight : (insight.text ?? insight.message ?? insight.insight ?? JSON.stringify(insight));
              return (
                <div
                  key={i}
                  className="flex items-start gap-4 border-l-2 border-tl-logic pl-4 py-1"
                  data-testid={`insight-${i}`}
                >
                  <span className="font-mono text-xs text-[#64748b] flex-shrink-0 w-5 text-right">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-sm text-[#f8fafc] leading-relaxed">{text}</p>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <div className="py-16" />
    </div>
  );
}

function Section({ number, title, children }) {
  return (
    <div className="mb-12 border-t border-tl-border pt-8">
      <div className="flex items-baseline gap-4 mb-6">
        <span className="font-mono text-xs text-[#64748b]">{number}</span>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </div>
  );
}
