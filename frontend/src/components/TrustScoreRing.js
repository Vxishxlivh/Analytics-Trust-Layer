import { useEffect, useState, useRef } from "react";

const COLORS = {
  verified: "#10b981",
  wrong: "#ef4444",
  partial: "#f59e0b",
  logic_gap: "#8b5cf6",
  unverifiable: "#6b7280",
};

function getScoreColor(score) {
  if (score >= 75) return "#10b981";
  if (score >= 50) return "#f59e0b";
  if (score >= 25) return "#ef4444";
  return "#991b1b";
}

export default function TrustScoreRing({ score }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [mounted, setMounted] = useState(false);
  const ref = useRef(null);

  const size = 240;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;
  const color = getScoreColor(score);

  useEffect(() => {
    setMounted(true);
    const duration = 1500;
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * score));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [score]);

  return (
    <div
      data-testid="trust-score-ring"
      className="flex flex-col items-center"
      ref={ref}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth={strokeWidth}
        />
        {/* Score ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={mounted ? color : "#1e293b"}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={mounted ? offset : circumference}
          strokeLinecap="butt"
          style={{
            transition: "stroke-dashoffset 1.5s ease-out, stroke 0.3s ease",
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span
          className="font-mono text-6xl font-bold tracking-tight"
          style={{ color }}
        >
          {animatedScore}
        </span>
        <span className="font-mono text-xs text-[#64748b] uppercase tracking-[0.15em] mt-1">
          Trust Score
        </span>
      </div>
    </div>
  );
}

export { COLORS, getScoreColor };
