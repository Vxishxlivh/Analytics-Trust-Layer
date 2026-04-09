import { useState } from "react";
import { ChevronDown } from "lucide-react";

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

const STATUS_ICONS = {
  verified: "\u2713",
  wrong: "\u2715",
  partial: "\u25D0",
  logic_gap: "\u25C7",
  unverifiable: "?",
};

const TYPE_LABELS = {
  numeric_fact: "Numeric Fact",
  causal_argument: "Causal Argument",
  comparison: "Comparison",
  projection: "Projection",
  recommendation: "Recommendation",
};

export default function ClaimCard({ claim, index }) {
  const [expanded, setExpanded] = useState(false);
  const color = STATUS_COLORS[claim.status] || "#6b7280";

  return (
    <div
      data-testid={`claim-card-${index}`}
      className="bg-tl-surface border border-tl-border border-l-4 transition-colors hover:bg-tl-surface-hover cursor-pointer"
      style={{ borderLeftColor: color }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-4" data-testid={`claim-expand-${index}`}>
        <span
          className="font-mono text-sm font-bold flex-shrink-0 w-6 text-center"
          style={{ color }}
        >
          {STATUS_ICONS[claim.status]}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-[#f8fafc] text-base leading-snug truncate">
            {claim.claim_text}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 border"
            style={{ borderColor: color, color }}
          >
            {TYPE_LABELS[claim.claim_type] || claim.claim_type}
          </span>
          {claim.risk_level === "HIGH" && (
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 border border-tl-wrong text-tl-wrong">
              HIGH
            </span>
          )}
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            className={`text-[#64748b] transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          className="border-t border-tl-border p-4 animate-fade-in-up"
          data-testid={`claim-details-${index}`}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="status-dot" style={{ backgroundColor: color }} />
            <span className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color }}>
              {STATUS_LABELS[claim.status]}
            </span>
          </div>

          {(claim.claimed_value || claim.actual_value) && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="border border-tl-border p-3">
                <span className="font-mono text-[10px] text-[#64748b] uppercase tracking-[0.1em] block mb-1">
                  Claimed
                </span>
                <span className="font-mono text-sm text-[#f8fafc]">
                  {claim.claimed_value || "N/A"}
                </span>
              </div>
              <div className="border border-tl-border p-3">
                <span className="font-mono text-[10px] text-[#64748b] uppercase tracking-[0.1em] block mb-1">
                  Actual
                </span>
                <span className="font-mono text-sm" style={{ color }}>
                  {claim.actual_value || "N/A"}
                </span>
              </div>
            </div>
          )}

          {claim.explanation && (
            <div className="mb-4">
              <span className="font-mono text-[10px] text-[#64748b] uppercase tracking-[0.1em] block mb-2">
                Explanation
              </span>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                {claim.explanation}
              </p>
            </div>
          )}

          {claim.verification_code && (
            <div>
              <span className="font-mono text-[10px] text-[#64748b] uppercase tracking-[0.1em] block mb-2">
                Verification Code
              </span>
              <pre className="code-block">{claim.verification_code}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
