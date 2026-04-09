import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const STEPS = [
  "Decomposing into atomic claims",
  "Generating verification code",
  "Executing against data",
  "Validating reasoning",
  "Building trust report",
];

export default function ValidationLoader({ onComplete, isDemo, hasResult }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  useEffect(() => {
    const delay = isDemo ? 500 : 1200;
    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < STEPS.length) {
          setCompletedSteps((cs) => [...cs, prev]);
          return prev + 1;
        }
        return prev;
      });
    }, delay);

    return () => clearInterval(timer);
  }, [isDemo]);

  useEffect(() => {
    if (currentStep >= STEPS.length && (hasResult || isDemo)) {
      const timeout = setTimeout(onComplete, 400);
      return () => clearTimeout(timeout);
    }
  }, [currentStep, hasResult, isDemo, onComplete]);

  const progress = (completedSteps.length / STEPS.length) * 100;

  return (
    <div className="py-24 animate-fade-in-up" data-testid="validation-loader">
      <div className="max-w-2xl mx-auto">
        <div className="mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2">
            Validating Report
          </h2>
          <p className="text-[#64748b] text-sm font-mono">
            {isDemo ? "Loading demo data..." : "Running AI-powered verification pipeline"}
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-[2px] w-full bg-tl-border mb-12">
          <motion.div
            className="h-full bg-[#f8fafc]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>

        {/* Terminal output */}
        <div className="bg-tl-surface border border-tl-border p-6 font-mono text-sm">
          {STEPS.map((step, i) => (
            <div key={i} className="mb-2 flex items-center gap-3">
              {i <= currentStep ? (
                <motion.div
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-3 w-full"
                >
                  <span className="text-[#64748b]">&gt;</span>
                  <span className={completedSteps.includes(i) ? "text-[#f8fafc]" : "text-[#94a3b8]"}>
                    {step}...
                  </span>
                  {completedSteps.includes(i) ? (
                    <span className="text-tl-verified ml-auto font-semibold">[DONE]</span>
                  ) : i === currentStep ? (
                    <span className="terminal-cursor ml-auto" />
                  ) : null}
                </motion.div>
              ) : (
                <div className="h-5" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
