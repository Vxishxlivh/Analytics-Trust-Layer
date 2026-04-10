import { useState, useCallback } from "react";
import "@/App.css";
import "@/lib/api"; // initialize auth token from localStorage
import axios from "axios";
import { BrowserRouter, Routes, Route, useNavigate, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import DataConnection from "@/components/DataConnection";
import AnalysisInput from "@/components/AnalysisInput";
import ValidationLoader from "@/components/ValidationLoader";
import ResultsDashboard from "@/components/ResultsDashboard";
import HistoryPage from "@/components/HistoryPage";
import ComparisonView from "@/components/ComparisonView";
import PatternsPage from "@/components/PatternsPage";
import LoginPage from "@/components/LoginPage";
import SignupPage from "@/components/SignupPage";
import { getDemoResult } from "@/data/demoData";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-tl-bg flex items-center justify-center">
        <span className="font-mono text-sm text-[#94a3b8]">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function AppContent() {
  const navigate = useNavigate();
  const [step, setStep] = useState("data");
  const [csvData, setCsvData] = useState(null);
  const [analysisText, setAnalysisText] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState(null);

  const handleDataReady = useCallback((data) => {
    setCsvData(data);
    setStep("analysis");
  }, []);

  const handleValidate = useCallback(async () => {
    setError(null);
    setStep("loading");
    setIsDemo(false);
    try {
      const response = await axios.post(`${API}/validate`, {
        csv_data: csvData.all_rows,
        analysis_text: analysisText,
        api_key: apiKey,
      });
      setResult(response.data);
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || "Validation failed";
      setError(msg);
      toast.error(msg);
      setStep("analysis");
    }
  }, [csvData, analysisText, apiKey]);

  const handleDemo = useCallback(() => {
    setIsDemo(true);
    setResult(getDemoResult());
    setStep("loading");
  }, []);

  const handleLoadingComplete = useCallback(() => {
    setStep("results");
  }, []);

  const handleReset = useCallback(() => {
    setStep("data");
    setCsvData(null);
    setAnalysisText("");
    setApiKey("");
    setResult(null);
    setIsDemo(false);
    setError(null);
    navigate("/");
  }, [navigate]);

  const handleViewHistoryResult = useCallback((data) => {
    setResult(data);
    setIsDemo(false);
    setStep("results");
    navigate("/");
  }, [navigate]);

  return (
    <div className="min-h-screen bg-tl-bg text-[#f8fafc]">
      <Navbar onReset={handleReset} currentStep={step} />
      <main className="max-w-7xl mx-auto px-6 md:px-12">
        <Routes>
          <Route
            path="/history"
            element={<HistoryPage onViewResult={handleViewHistoryResult} />}
          />
          <Route
            path="/compare"
            element={<ComparisonView />}
          />
          <Route
            path="/patterns"
            element={<PatternsPage />}
          />
          <Route
            path="*"
            element={
              <>
                {step === "data" && (
                  <DataConnection onDataReady={handleDataReady} onDemo={handleDemo} />
                )}
                {step === "analysis" && (
                  <AnalysisInput
                    analysisText={analysisText}
                    setAnalysisText={setAnalysisText}
                    apiKey={apiKey}
                    setApiKey={setApiKey}
                    onValidate={handleValidate}
                    onDemo={handleDemo}
                    onBack={() => setStep("data")}
                    error={error}
                  />
                )}
                {step === "loading" && (
                  <ValidationLoader
                    onComplete={handleLoadingComplete}
                    isDemo={isDemo}
                    hasResult={!!result}
                  />
                )}
                {step === "results" && result && (
                  <ResultsDashboard result={result} onReset={handleReset} />
                )}
              </>
            }
          />
        </Routes>
      </main>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#111827",
            border: "1px solid #1e293b",
            color: "#f8fafc",
            borderRadius: "0px",
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <AppContent />
              </RequireAuth>
            }
          />
        </Routes>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#111827",
              border: "1px solid #1e293b",
              color: "#f8fafc",
              borderRadius: "0px",
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
