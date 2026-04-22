'use client';

import { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { analyzeCampaign, AnalysisResult, CampaignContext } from '../lib/analyzer';
import Dashboard from './components/Dashboard';

const KPI_OPTIONS = [
  'ROAS / Revenue',
  'Sales / Conversions',
  'Visits',
  'Clicks',
  'App Installs',
];

export default function Home() {
  const [step, setStep] = useState<'upload' | 'config' | 'analysis'>('upload');
  const [csvData, setCsvData] = useState<Record<string, unknown>[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<CampaignContext>({
    account_name: '',
    region: '',
    currency: 'USD',
    kpi: KPI_OPTIONS[0],
    total_budget: 0,
    start_date: '',
    end_date: '',
  });

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) return;
    setCsvFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        setCsvData(results.data as Record<string, unknown>[]);
        setStep('config');
      },
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const runAnalysis = () => {
    setAnalyzing(true);
    setTimeout(() => {
      const result = analyzeCampaign(config, csvData);
      setAnalysis(result);
      setStep('analysis');
      setAnalyzing(false);
    }, 1500);
  };

  if (step === 'analysis' && analysis) {
    return (
      <main className="main-content">
        <Dashboard analysis={analysis} config={config} csvFileName={csvFileName} onReset={() => { setStep('upload'); setAnalysis(null); setCsvData([]); }} />
      </main>
    );
  }

  return (
    <main className="main-content">
      {step === 'upload' && (
        <div className="fade-in" style={{ maxWidth: 700, margin: '60px auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>Campaign Performance Analyzer</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>Upload your Criteo campaign CSV to get AI-powered optimization insights</p>
          </div>
          <div
            className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="upload-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h3>Drop your CSV file here</h3>
            <p>or click to browse • Supports Criteo campaign exports</p>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        </div>
      )}

      {step === 'config' && (
        <div className="fade-in" style={{ maxWidth: 800, margin: '40px auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>Campaign Configuration</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              <span className="badge badge-success">✓ {csvFileName}</span> — {csvData.length} rows loaded
            </p>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Account & KPI Settings</span></div>
            <div className="card-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Account Name</label>
                  <input className="form-input" placeholder="e.g. Acme Corp" value={config.account_name} onChange={(e) => setConfig({ ...config, account_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Region</label>
                  <input className="form-input" placeholder="e.g. US, EMEA, APAC" value={config.region} onChange={(e) => setConfig({ ...config, region: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select className="form-select" value={config.currency} onChange={(e) => setConfig({ ...config, currency: e.target.value })}>
                    <option value="$">USD ($)</option>
                    <option value="€">EUR (€)</option>
                    <option value="£">GBP (£)</option>
                    <option value="¥">JPY (¥)</option>
                    <option value="₹">INR (₹)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Primary KPI</label>
                  <select className="form-select" value={config.kpi} onChange={(e) => setConfig({ ...config, kpi: e.target.value })}>
                    {KPI_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Total Budget</label>
                  <input className="form-input" type="number" placeholder="e.g. 50000" value={config.total_budget || ''} onChange={(e) => setConfig({ ...config, total_budget: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input className="form-input" type="date" value={config.start_date} onChange={(e) => setConfig({ ...config, start_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input className="form-input" type="date" value={config.end_date} onChange={(e) => setConfig({ ...config, end_date: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-secondary" onClick={() => setStep('upload')}>Back</button>
                <button className="btn btn-primary" disabled={analyzing || !config.account_name || !config.total_budget || !config.start_date || !config.end_date} onClick={runAnalysis}>
                  {analyzing ? (<><span className="loading-spinner" style={{ width: 18, height: 18, margin: 0, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> Analyzing...</>) : '🚀 Run Analysis'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
