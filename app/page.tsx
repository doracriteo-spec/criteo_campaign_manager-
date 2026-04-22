'use client';

import { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { bulkAnalyzeCampaigns, detectAdvertisers, BulkAnalysisResult, CampaignContext } from '../lib/analyzer';
import Dashboard from './components/Dashboard';

const KPI_OPTIONS = [
  'ROAS / Revenue',
  'Sales / Conversions',
  'Visits',
  'Clicks',
  'App Installs',
];

export default function Home() {
  const [step, setStep] = useState<'upload' | 'preview' | 'config' | 'analysis'>('upload');
  const [csvData, setCsvData] = useState<Record<string, unknown>[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<BulkAnalysisResult | null>(null);
  const [detectedAdvertisers, setDetectedAdvertisers] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<CampaignContext>({
    account_name: '',
    region: '',
    currency: '$',
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
        const data = results.data as Record<string, unknown>[];
        setCsvData(data);

        // Auto-detect advertisers
        const advertisers = detectAdvertisers(data);
        setDetectedAdvertisers(advertisers);

        // Go straight to preview if advertisers detected, else to config
        if (advertisers.length > 0) {
          setStep('preview');
        } else {
          setStep('config');
        }
      },
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const result = bulkAnalyzeCampaigns(config, csvData);
      setAnalysis(result);
      setStep('analysis');
    } catch (error) {
      console.error('Error during analysis', error);
      alert('There was an error running the analysis. Check the console.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setAnalysis(null);
    setCsvData([]);
    setDetectedAdvertisers([]);
    setCsvFileName('');
    setConfig({
      account_name: '',
      region: '',
      currency: '$',
      kpi: KPI_OPTIONS[0],
      total_budget: 0,
      start_date: '',
      end_date: '',
    });
  };

  if (step === 'analysis' && analysis) {
    return (
      <main className="main-content">
        <Dashboard analysis={analysis} config={config} csvFileName={csvFileName} onReset={handleReset} />
      </main>
    );
  }

  return (
    <main className="main-content">
      {/* STEP 1: Upload */}
      {step === 'upload' && (
        <div className="fade-in" style={{ maxWidth: 700, margin: '60px auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>Campaign Performance Analyzer</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>Upload your campaign CSV to get AI-powered optimization insights</p>
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
            <p>or click to browse • Supports single & multi-account campaign exports</p>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        </div>
      )}

      {/* STEP 2: Advertiser Preview (when multi-account detected) */}
      {step === 'preview' && (
        <div className="fade-in" style={{ maxWidth: 900, margin: '40px auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>Advertisers Detected</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              <span className="badge badge-success">✓ {csvFileName}</span> — {csvData.length} rows • {detectedAdvertisers.length} advertiser{detectedAdvertisers.length !== 1 ? 's' : ''} found
            </p>
          </div>

          {/* Advertiser Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 32 }}>
            {detectedAdvertisers.map((name, i) => {
              const rowCount = csvData.filter(r => {
                const cols = Object.keys(r);
                const advCol = cols.find(c => ['advertiser', 'account', 'client', 'customer'].some(p => c.toLowerCase().includes(p)));
                return advCol && String(r[advCol]).trim() === name;
              }).length;

              return (
                <div key={i} className="stat-card" style={{ cursor: 'default' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: `hsl(${(i * 47) % 360}, 65%, 55%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: 16
                    }}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rowCount} rows</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Optional Configuration */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title">Campaign Configuration</span>
              <span className="badge badge-info">All fields optional</span>
            </div>
            <div className="card-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Region</label>
                  <input className="form-input" placeholder="e.g. US, EMEA, APAC (optional)" value={config.region} onChange={(e) => setConfig({ ...config, region: e.target.value })} />
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
                  <label className="form-label">Total Budget per Account</label>
                  <input className="form-input" type="number" placeholder="Optional — leave blank if unknown" value={config.total_budget || ''} onChange={(e) => setConfig({ ...config, total_budget: parseFloat(e.target.value) || 0 })} />
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
                <button className="btn btn-secondary" onClick={() => setStep('upload')}>← Back</button>
                <button className="btn btn-primary" disabled={analyzing} onClick={runAnalysis}>
                  {analyzing ? (<><span className="loading-spinner" style={{ width: 18, height: 18, margin: 0, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> Analyzing...</>) : `🚀 Analyze ${detectedAdvertisers.length} Advertiser${detectedAdvertisers.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2b: Config (single account - no advertiser column found) */}
      {step === 'config' && (
        <div className="fade-in" style={{ maxWidth: 800, margin: '40px auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>Campaign Configuration</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              <span className="badge badge-success">✓ {csvFileName}</span> — {csvData.length} rows loaded
            </p>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Account & KPI Settings</span>
              <span className="badge badge-info">All fields optional</span>
            </div>
            <div className="card-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Account Name</label>
                  <input className="form-input" placeholder="e.g. Acme Corp (optional)" value={config.account_name} onChange={(e) => setConfig({ ...config, account_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Region</label>
                  <input className="form-input" placeholder="e.g. US, EMEA, APAC (optional)" value={config.region} onChange={(e) => setConfig({ ...config, region: e.target.value })} />
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
                  <input className="form-input" type="number" placeholder="Optional — leave blank if unknown" value={config.total_budget || ''} onChange={(e) => setConfig({ ...config, total_budget: parseFloat(e.target.value) || 0 })} />
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
                <button className="btn btn-primary" disabled={analyzing} onClick={runAnalysis}>
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
