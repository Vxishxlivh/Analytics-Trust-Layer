import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Trash2, ExternalLink, ArrowLeft, GitCompareArrows } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RISK_COLORS = {
  LOW: "#10b981",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
  CRITICAL: "#991b1b",
};

function getScoreColor(score) {
  if (score >= 75) return "#10b981";
  if (score >= 50) return "#f59e0b";
  if (score >= 25) return "#ef4444";
  return "#991b1b";
}

export default function HistoryPage({ onViewResult }) {
  const navigate = useNavigate();
  const [validations, setValidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState(null);
  const [selected, setSelected] = useState([]);

  const fetchValidations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/validations`);
      setValidations(res.data);
    } catch (e) {
      toast.error("Failed to load validation history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchValidations();
  }, [fetchValidations]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API}/validations/${id}`);
      setValidations((prev) => prev.filter((v) => v.id !== id));
      setSelected((prev) => prev.filter((s) => s !== id));
      toast.success("Validation deleted");
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleCompare = () => {
    if (selected.length !== 2) return;
    navigate(`/compare?left=${selected[0]}&right=${selected[1]}`);
  };

  const handleView = async (id) => {
    setLoadingId(id);
    try {
      const res = await axios.get(`${API}/validations/${id}`);
      onViewResult(res.data);
    } catch (e) {
      toast.error("Failed to load validation");
    } finally {
      setLoadingId(null);
    }
  };

  const formatDate = (ts) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  return (
    <div className="py-16 animate-fade-in-up" data-testid="history-page">
      <button
        data-testid="back-to-home-btn"
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-[#64748b] hover:text-[#f8fafc] text-sm font-mono mb-8 transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Back to validation
      </button>

      <div className="mb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tighter mb-4">
              Validation History
            </h1>
            <p className="text-[#94a3b8] text-base leading-relaxed max-w-2xl">
              Review past validations. Select two reports to compare side-by-side.
            </p>
          </div>
          {selected.length === 2 && (
            <button
              data-testid="compare-selected-btn"
              onClick={handleCompare}
              className="flex items-center gap-2 px-6 py-3 bg-[#f8fafc] text-[#0a0f1a] font-mono text-sm font-semibold tracking-wide uppercase hover:bg-white transition-colors"
            >
              <GitCompareArrows size={14} strokeWidth={2} />
              Compare Selected
            </button>
          )}
          {selected.length === 1 && (
            <span className="font-mono text-xs text-[#64748b]">
              Select one more to compare
            </span>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-[#94a3b8] text-sm font-mono py-12 text-center">
          Loading history...
        </div>
      )}

      {!loading && validations.length === 0 && (
        <div data-testid="history-empty" className="border border-tl-border bg-tl-surface p-12 text-center">
          <p className="text-[#64748b] text-sm font-mono mb-4">
            No validations yet.
          </p>
          <button
            onClick={() => navigate("/")}
            className="text-[#94a3b8] hover:text-[#f8fafc] font-mono text-sm transition-colors"
          >
            Run your first validation
          </button>
        </div>
      )}

      {!loading && validations.length > 0 && (
        <div className="flex flex-col gap-3" data-testid="history-list">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2">
            <span className="col-span-1 font-mono text-[10px] text-[#64748b] uppercase tracking-[0.1em]">
              Select
            </span>
            <span className="col-span-2 font-mono text-[10px] text-[#64748b] uppercase tracking-[0.1em]">
              Score
            </span>
            <span className="col-span-1 font-mono text-[10px] text-[#64748b] uppercase tracking-[0.1em]">
              Risk
            </span>
            <span className="col-span-4 font-mono text-[10px] text-[#64748b] uppercase tracking-[0.1em]">
              Summary
            </span>
            <span className="col-span-3 font-mono text-[10px] text-[#64748b] uppercase tracking-[0.1em]">
              Date
            </span>
            <span className="col-span-1" />
          </div>

          {validations.map((v) => (
            <div
              key={v.id}
              data-testid={`history-item-${v.id}`}
              onClick={() => handleView(v.id)}
              className={`grid grid-cols-12 gap-4 items-center px-4 py-4 bg-tl-surface border hover:bg-tl-surface-hover cursor-pointer transition-colors group ${
                selected.includes(v.id)
                  ? "border-[#f8fafc]/30"
                  : "border-tl-border"
              }`}
            >
              {/* Checkbox */}
              <div className="col-span-1 flex items-center">
                <button
                  data-testid={`select-validation-${v.id}`}
                  onClick={(e) => toggleSelect(v.id, e)}
                  className={`w-5 h-5 border flex items-center justify-center transition-colors ${
                    selected.includes(v.id)
                      ? "border-[#f8fafc] bg-[#f8fafc]"
                      : "border-[#64748b] hover:border-[#94a3b8]"
                  }`}
                >
                  {selected.includes(v.id) && (
                    <span className="text-[#0a0f1a] text-xs font-bold">
                      {selected.indexOf(v.id) === 0 ? "A" : "B"}
                    </span>
                  )}
                </button>
              </div>

              {/* Score */}
              <div className="col-span-2 flex items-center gap-3">
                <span
                  className="font-mono text-2xl font-bold"
                  style={{ color: getScoreColor(v.trust_score) }}
                >
                  {v.trust_score}
                </span>
              </div>

              {/* Risk */}
              <div className="col-span-1">
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-1 border inline-block"
                  style={{
                    borderColor: RISK_COLORS[v.decision_risk],
                    color: RISK_COLORS[v.decision_risk],
                  }}
                >
                  {v.decision_risk}
                </span>
              </div>

              {/* Summary */}
              <div className="col-span-4 flex items-center gap-3">
                {v.summary && (
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-tl-verified">{v.summary.verified}v</span>
                    <span className="text-[#64748b]">/</span>
                    <span className="text-tl-wrong">{v.summary.wrong}w</span>
                    <span className="text-[#64748b]">/</span>
                    <span className="text-tl-partial">{v.summary.partial}p</span>
                    <span className="text-[#64748b]">/</span>
                    <span className="text-tl-logic">{v.summary.logic_gap}l</span>
                  </div>
                )}
              </div>

              {/* Date */}
              <div className="col-span-3">
                <span className="font-mono text-xs text-[#64748b]">
                  {formatDate(v.timestamp)}
                </span>
              </div>

              {/* Actions */}
              <div className="col-span-1 flex items-center justify-end gap-2">
                {loadingId === v.id ? (
                  <span className="font-mono text-xs text-[#94a3b8]">...</span>
                ) : (
                  <>
                    <ExternalLink
                      size={14}
                      strokeWidth={1.5}
                      className="text-[#64748b] group-hover:text-[#94a3b8] transition-colors"
                    />
                    <button
                      data-testid={`delete-validation-${v.id}`}
                      onClick={(e) => handleDelete(v.id, e)}
                      className="text-[#64748b] hover:text-tl-wrong transition-colors p-1"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
