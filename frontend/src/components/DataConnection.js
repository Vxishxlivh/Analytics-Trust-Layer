import { useState, useCallback, useRef } from "react";
import axios from "axios";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, Link, Database } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DataConnection({ onDataReady, onDemo }) {
  const [activeTab, setActiveTab] = useState("upload");
  const [csvData, setCsvData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [dbForm, setDbForm] = useState({ host: "", port: "", database: "", table: "" });
  const fileInputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(`${API}/upload-csv`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCsvData(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to parse file");
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePaste = useCallback(async () => {
    if (!pasteText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API}/parse-csv-text`, { csv_text: pasteText });
      setCsvData(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to parse CSV text");
    } finally {
      setLoading(false);
    }
  }, [pasteText]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragActive(false), []);

  const handleGoogleSheet = useCallback(async () => {
    if (!sheetsUrl.trim()) return;
    setSheetsLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API}/parse-google-sheet`, { url: sheetsUrl });
      setCsvData(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to fetch Google Sheet");
    } finally {
      setSheetsLoading(false);
    }
  }, [sheetsUrl]);

  return (
    <div className="py-16 animate-fade-in-up">
      <div className="mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tighter mb-4">
          Connect Your Data
        </h1>
        <p className="text-[#94a3b8] text-base leading-relaxed max-w-2xl">
          Upload the source data that your AI-generated report was built from.
          We will validate every claim against this data.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-transparent border-b border-tl-border rounded-none h-auto p-0 gap-0 w-full justify-start">
          <TabButton value="upload" active={activeTab === "upload"} testId="data-connect-csv-tab">
            <Upload size={14} strokeWidth={1.5} className="mr-2" />CSV / Excel Upload
          </TabButton>
          <TabButton value="paste" active={activeTab === "paste"} testId="data-connect-paste-tab">
            <FileSpreadsheet size={14} strokeWidth={1.5} className="mr-2" />Paste Data
          </TabButton>
          <TabButton value="sheets" active={activeTab === "sheets"} testId="data-connect-sheets-tab">
            <Link size={14} strokeWidth={1.5} className="mr-2" />Google Sheets
          </TabButton>
          <TabButton value="database" active={activeTab === "database"} testId="data-connect-db-tab">
            <Database size={14} strokeWidth={1.5} className="mr-2" />Database
          </TabButton>
        </TabsList>

        <TabsContent value="upload" className="mt-8">
          <div
            data-testid="upload-dropzone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
              dragActive
                ? "border-[#94a3b8] bg-tl-surface/50"
                : "border-tl-border hover:border-[#94a3b8]"
            }`}
          >
            <Upload size={32} strokeWidth={1} className="mx-auto mb-4 text-[#64748b]" />
            <p className="text-[#f8fafc] mb-2">
              Drop your CSV or Excel file here
            </p>
            <p className="text-[#64748b] text-sm font-mono">
              .csv, .xlsx, .xls supported
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
              data-testid="file-input"
            />
          </div>
        </TabsContent>

        <TabsContent value="paste" className="mt-8">
          <textarea
            data-testid="paste-csv-textarea"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste your CSV data here...&#10;&#10;month,revenue,customers,churn_rate&#10;Jan,142000,720,3.2&#10;Feb,148000,735,3.1&#10;..."
            className="w-full min-h-[250px] bg-tl-surface border border-tl-border p-6 text-sm font-mono text-[#f8fafc] placeholder:text-[#64748b] focus:ring-2 focus:ring-[#3b82f6] focus:outline-none resize-none"
          />
          <button
            data-testid="parse-paste-btn"
            onClick={handlePaste}
            disabled={!pasteText.trim() || loading}
            className="mt-4 px-6 py-2.5 bg-[#f8fafc] text-[#0a0f1a] font-mono text-sm font-semibold tracking-wide uppercase hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Parsing..." : "Parse Data"}
          </button>
        </TabsContent>

        <TabsContent value="sheets" className="mt-8">
          <div className="border border-tl-border bg-tl-surface p-8">
            <label className="font-mono text-xs text-[#94a3b8] uppercase tracking-[0.1em] block mb-3">
              Google Sheets URL
            </label>
            <input
              data-testid="sheets-url-input"
              type="text"
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full bg-tl-bg border border-tl-border p-3 text-sm text-[#f8fafc] placeholder:text-[#64748b] focus:ring-2 focus:ring-[#3b82f6] focus:outline-none font-mono"
            />
            <p className="mt-3 text-[#64748b] text-xs font-mono">
              Sheet must be set to "Anyone with the link can view"
            </p>
            <button
              data-testid="fetch-sheet-btn"
              onClick={handleGoogleSheet}
              disabled={!sheetsUrl.trim() || sheetsLoading}
              className="mt-4 px-6 py-2.5 bg-[#f8fafc] text-[#0a0f1a] font-mono text-sm font-semibold tracking-wide uppercase hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sheetsLoading ? "Fetching..." : "Fetch Data"}
            </button>
          </div>
        </TabsContent>

        <TabsContent value="database" className="mt-8">
          <div className="border border-tl-border bg-tl-surface p-8">
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[
                { key: "host", label: "Host", placeholder: "localhost" },
                { key: "port", label: "Port", placeholder: "5432" },
                { key: "database", label: "Database", placeholder: "analytics_db" },
                { key: "table", label: "Table", placeholder: "monthly_metrics" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="font-mono text-xs text-[#94a3b8] uppercase tracking-[0.1em] block mb-2">
                    {f.label}
                  </label>
                  <input
                    data-testid={`db-${f.key}-input`}
                    type="text"
                    value={dbForm[f.key]}
                    onChange={(e) => setDbForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-tl-bg border border-tl-border p-3 text-sm text-[#f8fafc] placeholder:text-[#64748b] focus:ring-2 focus:ring-[#3b82f6] focus:outline-none font-mono"
                  />
                </div>
              ))}
            </div>
            <p className="text-[#64748b] text-sm">
              Direct database connection coming soon. Export your data as CSV for now.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {loading && (
        <div className="mt-6 text-[#94a3b8] text-sm font-mono">
          Parsing data...
        </div>
      )}

      {error && (
        <div data-testid="data-error" className="mt-6 text-tl-wrong text-sm border border-tl-wrong/30 bg-tl-wrong/5 p-4">
          {error}
        </div>
      )}

      {csvData && (
        <div className="mt-8 animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Data Preview</h3>
            <span className="font-mono text-xs text-[#94a3b8] tracking-wide">
              {csvData.total_rows} rows / {csvData.columns?.length} columns
            </span>
          </div>
          <div className="overflow-x-auto border border-tl-border">
            <table className="data-table w-full" data-testid="data-preview-table">
              <thead>
                <tr>
                  {csvData.columns?.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.preview_rows?.map((row, i) => (
                  <tr key={i}>
                    {csvData.columns?.map((col) => (
                      <td key={col}>{row[col] !== null && row[col] !== undefined ? String(row[col]) : "-"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            data-testid="continue-to-analysis-btn"
            onClick={() => onDataReady(csvData)}
            className="mt-6 px-8 py-3 bg-[#f8fafc] text-[#0a0f1a] font-mono text-sm font-semibold tracking-wide uppercase hover:bg-white transition-colors"
          >
            Continue to Analysis
          </button>
        </div>
      )}

      <div className="mt-16 pt-8 border-t border-tl-border">
        <button
          data-testid="try-demo-btn"
          onClick={onDemo}
          className="text-[#94a3b8] hover:text-[#f8fafc] font-mono text-sm transition-colors"
        >
          Skip setup — try demo with sample SaaS report
        </button>
      </div>
    </div>
  );
}

function TabButton({ children, value, active, testId }) {
  return (
    <TabsTrigger
      data-testid={testId}
      value={value}
      className={`rounded-none border-b-2 px-4 py-3 text-sm font-medium transition-colors bg-transparent shadow-none ${
        active
          ? "border-[#f8fafc] text-[#f8fafc]"
          : "border-transparent text-[#64748b] hover:text-[#94a3b8]"
      }`}
    >
      <span className="flex items-center">{children}</span>
    </TabsTrigger>
  );
}
