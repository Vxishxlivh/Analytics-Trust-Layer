import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, ArrowUp, ArrowDown, Minus } from "lucide-react";
import TrustScoreRing, { getScoreColor, COLORS } from "@/components/TrustScoreRing";
import ClaimCard from "@/components/ClaimCard";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RISK_COLORS = {
  LOW: "#10b981",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
  CRITICAL: "#991b1b",
};

const STAT_ITEMS = [
  { key: "verified", label: "Verified", color: COLORS.verified },
  { key: "wrong", label: "Wrong", color: COLORS.wrong },
  { key: "partial", label: "Partial", color: COLORS.partial },
  { key: "logic_gap", label: "Logic Gaps", color: COLORS.logic_gap },
  { key: "unverifiable", label: "Unverifiable", color: COLORS.unverifiable },
];

function DeltaBadge({ value }) {
  if (value === 0) return null;
  const positive = value > 0;
  return (
    <span
      className="font-mono text-[10px] ml-1"
      style={{ color: positive ? "#ef4444" : "#10b981" }}
    >
      {positive ? "+" : ""}{value}
    </span>
  );
}

function ScoreDelta({ left, right }) {
  const delta = right - left;
  if (delta === 0) return <span className="font-mono text-sm text-[#64748b]">No change</span>;
  const better = delta > 0;
  return (
    <div className="flex items-center gap-1">
      {better ? (
        <ArrowUp size={14} strokeWidth={2} className="text-tl-verified" />
      ) : (
        <ArrowDown size={14} strokeWidth={2} className="text-tl-wrong" />
      )}
      <span
        className="font-mono text-sm font-bold"
        style={{ color: better ? "#10b981" : "#ef4444" }}
      >
        {delta > 0 ? "+" : ""}{delta}
      </span>
    </div>
  );
}

export default function ComparisonView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async (id) => {
    const res = await axios.get(`${API}/validations/${id}`);
    return res.data;
  }, []);

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      try {
        const leftId = searchParams.get("left");
        const rightId = searchParams.get("right");

        // Check if current result was passed via navigation state
        const stateResult = location.state?.currentResult;

        let leftData, rightData;

        if (stateResult && !leftId) {
          leftData = stateResult;
        } else if (leftId) {
          leftData = await fetchReport(leftId);
        }

        if (rightId) {
          rightData = await fetchReport(rightId);
        }

        if (!leftData || !rightData) {
          toast.error("Could not load both reports for comparison");
          navigate("/history");
          return;
        }

        setLeft(leftData);
        setRight(rightData);
      } catch (e) {
        toast.error("Failed to load reports");
        navigate("/history");
      } finally {
        setLoading(false);
      }
    };
    loadReports();
  }, [searchParams, location.state, fetchReport, navigate]);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <span className="font-mono text-sm text-[#94a3b8]">Loading comparison...</span>
      </div>
    );
  }

  if (!left || !right) return null;

  const scoreDelta = right.trust_score - left.trust_score;
  const formatDate = (ts) => {
    try {
      return new Date(ts).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      });
    } catch { return "N/A"; }
  };

  return (
    <div className="py-16 animate-fade-in-up" data-testid="comparison-view">
      {/* Header */}
      <button
        data-testid="compare-back-btn"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-[#64748b] hover:text-[#f8fafc] text-sm font-mono mb-8 transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Back
      </button>

      <div className="mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tighter mb-2">
          Report Comparison
        </h1>
        <p className="text-[#94a3b8] text-base">
          Side-by-side analysis of two validation reports.
        </p>
      </div>

      {/* Score Comparison */}
      <div className="border-y border-tl-border py-12 mb-12">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-center">
          {/* Left Score */}
          <div className="flex flex-col items-center" data-testid="compare-left-score">
            <PanelLabel label="Report A" date={formatDate(left.timestamp)} />
            <div className="relative mt-4">
              <TrustScoreRing score={left.trust_score} size={160} />
            </div>
            <div className="mt-4">
              <RiskBadge risk={left.decision_risk} />
            </div>
          </div>

          {/* Delta */}
          <div className="flex flex-col items-center gap-2 px-4" data-testid="score-delta">
            <span className="font-mono text-[10px] text-[#64748b] uppercase tracking-[0.1em]">
              Delta
            </span>
            <ScoreDelta left={left.trust_score} right={right.trust_score} />
          </div>

          {/* Right Score */}
          <div className="flex flex-col items-center" data-testid="compare-right-score">
            <PanelLabel label="Report B" date={formatDate(right.timestamp)} />
            <div className="relative mt-4">
              <TrustScoreRing score={right.trust_score} size={160} />
            </div>
            <div className="mt-4">
              <RiskBadge risk={right.decision_risk} />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Comparison */}
      <div className="mb-12" data-testid="compare-stats">
        <SectionTitle number="01" title="Summary Statistics" />
        <div className="grid grid-cols-2 gap-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STAT_ITEMS.map((item) => (
              <StatCard key={item.key} item={item} value={left.summary?.[item.key] || 0} />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STAT_ITEMS.map((item) => {
              const lv = left.summary?.[item.key] || 0;
              const rv = right.summary?.[item.key] || 0;
              return (
                <StatCard key={item.key} item={item} value={rv} delta={rv - lv} />
              );
            })}
          </div>
        </div>
      </div>

      {/* Claims Side-by-Side */}
      <div className="mb-12">
        <SectionTitle number="02" title="Claims" />
        <div className="grid grid-cols-2 gap-6" data-testid="compare-claims">
          {/* Left Claims */}
          <div className="flex flex-col gap-2">
            <PanelSubhead
              label="Report A"
              count={left.claims?.length || 0}
            />
            {left.claims?.map((claim, i) => (
              <ClaimCard key={claim.id || i} claim={claim} index={i} />
            ))}
          </div>
          {/* Right Claims */}
          <div className="flex flex-col gap-2">
            <PanelSubhead
              label="Report B"
              count={right.claims?.length || 0}
            />
            {right.claims?.map((claim, i) => (
              <ClaimCard key={claim.id || i} claim={claim} index={i} />
            ))}
          </div>
        </div>
      </div>

      {/* Analysis Sections Side-by-Side */}
      <CompareSection
        number="03"
        title="What's Missing"
        leftItems={left.missing_context}
        rightItems={right.missing_context}
      />
      <CompareSection
        number="04"
        title="Hidden Assumptions"
        leftItems={left.hidden_assumptions}
        rightItems={right.hidden_assumptions}
      />
      <CompareSection
        number="05"
        title="Alternative Explanations"
        leftItems={left.alternative_explanations}
        rightItems={right.alternative_explanations}
      />

      <div className="py-16" />
    </div>
  );
}

function PanelLabel({ label, date }) {
  return (
    <div className="text-center">
      <span className="font-mono text-xs text-[#f8fafc] uppercase tracking-[0.1em] font-bold">
        {label}
      </span>
      <br />
      <span className="font-mono text-[10px] text-[#64748b]">{date}</span>
    </div>
  );
}

function PanelSubhead({ label, count }) {
  return (
    <div className="flex items-center justify-between mb-2 pb-2 border-b border-tl-border">
      <span className="font-mono text-xs text-[#94a3b8] uppercase tracking-[0.1em]">
        {label}
      </span>
      <span className="font-mono text-xs text-[#64748b]">
        {count} claims
      </span>
    </div>
  );
}

function RiskBadge({ risk }) {
  return (
    <span
      className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1 border"
      style={{
        borderColor: RISK_COLORS[risk],
        color: RISK_COLORS[risk],
      }}
    >
      {risk} RISK
    </span>
  );
}

function SectionTitle({ number, title }) {
  return (
    <div className="flex items-baseline gap-4 mb-6 border-t border-tl-border pt-8">
      <span className="font-mono text-xs text-[#64748b]">{number}</span>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

function StatCard({ item, value, delta }) {
  return (
    <div className="border border-tl-border bg-tl-surface p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <div className="status-dot" style={{ backgroundColor: item.color }} />
        <span className="font-mono text-[9px] text-[#64748b] uppercase tracking-[0.1em]">
          {item.label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-xl font-bold" style={{ color: item.color }}>
          {value}
        </span>
        {delta !== undefined && <DeltaBadge value={delta} />}
      </div>
    </div>
  );
}

function CompareSection({ number, title, leftItems, rightItems }) {
  if ((!leftItems || leftItems.length === 0) && (!rightItems || rightItems.length === 0)) {
    return null;
  }

  return (
    <div className="mb-12">
      <SectionTitle number={number} title={title} />
      <div className="grid grid-cols-2 gap-6">
        <ItemList items={leftItems} label="Report A" />
        <ItemList items={rightItems} label="Report B" />
      </div>
    </div>
  );
}

function ItemList({ items, label }) {
  return (
    <div>
      <div className="mb-3 pb-2 border-b border-tl-border">
        <span className="font-mono text-xs text-[#94a3b8] uppercase tracking-[0.1em]">
          {label}
        </span>
        <span className="font-mono text-xs text-[#64748b] ml-2">
          {items?.length || 0} items
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {items?.map((item, i) => (
          <div key={i} className="flex items-start gap-3 text-sm">
            <span className="font-mono text-[#64748b] flex-shrink-0 w-5 text-right text-xs">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="text-[#94a3b8] leading-relaxed text-xs">{item}</p>
          </div>
        )) || (
          <p className="text-[#64748b] text-xs font-mono">No items</p>
        )}
      </div>
    </div>
  );
}
