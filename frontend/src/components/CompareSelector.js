import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

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

export default function CompareSelector({ open, onClose, currentResult }) {
  const navigate = useNavigate();
  const [validations, setValidations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/validations`);
        // Filter out the current result if it has an id
        const filtered = currentResult?.id
          ? res.data.filter((v) => v.id !== currentResult.id)
          : res.data;
        setValidations(filtered);
      } catch {
        toast.error("Failed to load validation history");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [open, currentResult?.id]);

  const handleSelect = (id) => {
    onClose();
    navigate(`/compare?right=${id}`, {
      state: { currentResult },
    });
  };

  const formatDate = (ts) => {
    try {
      return new Date(ts).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      });
    } catch { return "N/A"; }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-tl-surface border-tl-border max-w-lg rounded-none sm:rounded-none">
        <DialogHeader>
          <DialogTitle className="text-[#f8fafc] font-bold tracking-tight">
            Select Report to Compare
          </DialogTitle>
          <DialogDescription className="text-[#64748b] text-sm">
            Choose a saved validation to compare side-by-side with the current report.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 max-h-[400px] overflow-y-auto">
          {loading && (
            <p className="text-[#94a3b8] text-sm font-mono py-8 text-center">
              Loading...
            </p>
          )}

          {!loading && validations.length === 0 && (
            <div className="border border-tl-border p-6 text-center">
              <p className="text-[#64748b] text-sm font-mono">
                No other validations found. Run more validations to enable comparison.
              </p>
            </div>
          )}

          {!loading && validations.length > 0 && (
            <div className="flex flex-col gap-2">
              {validations.map((v) => (
                <button
                  key={v.id}
                  data-testid={`compare-select-${v.id}`}
                  onClick={() => handleSelect(v.id)}
                  className="flex items-center gap-4 w-full px-4 py-3 bg-tl-bg border border-tl-border hover:bg-tl-surface-hover text-left transition-colors"
                >
                  <span
                    className="font-mono text-xl font-bold w-12 text-right flex-shrink-0"
                    style={{ color: getScoreColor(v.trust_score) }}
                  >
                    {v.trust_score}
                  </span>
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 border flex-shrink-0"
                    style={{
                      borderColor: RISK_COLORS[v.decision_risk],
                      color: RISK_COLORS[v.decision_risk],
                    }}
                  >
                    {v.decision_risk}
                  </span>
                  {v.summary && (
                    <span className="font-mono text-xs text-[#64748b] flex-shrink-0">
                      {v.summary.verified}v / {v.summary.wrong}w / {v.summary.partial}p
                    </span>
                  )}
                  <span className="font-mono text-xs text-[#64748b] ml-auto flex-shrink-0">
                    {formatDate(v.timestamp)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
