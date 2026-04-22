'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import { bulkAnalyzeCampaigns, detectHierarchy, BulkAnalysisResult, CampaignContext, DetectedHierarchy } from '../lib/analyzer';
import Dashboard from './components/Dashboard';

const KPI_OPTIONS = [
  'ROAS / Revenue',
  'Sales / Conversions',
  'Visits',
  'Clicks',
  'App Installs',
];

export default function Home() {
  const [step, setStep] = useState<'upload' | 'preview' | 'analysis'>('upload');
  const [csvData, setCsvData] = useState<Record<string, unknown>[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<BulkAnalysisResult | null>(null);
  const [detectedHierarchy, setDetectedHierarchy] = useState<DetectedHierarchy[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<CampaignContext>({
    account_name: '',
    region: '',
    currency: '$',
    kpi: KPI_OPTIONS[0],
    total_budget: 0,
    start_date: '',
    end_date: '',
    ad_set_budgets: {},
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

        // Auto-detect hierarchy
        const hierarchy = detectHierarchy(data);
        setDetectedHierarchy(hierarchy);
        setStep('preview');
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
    setDetectedHierarchy([]);
    setCsvFileName('');
    setConfig({
      account_name: '',
      region: '',
      currency: '$',
      kpi: KPI_OPTIONS[0],
      total_budget: 0,
      start_date: '',
      end_date: '',
      ad_set_budgets: {},
    });
  };

  const updateAdSetBudget = (id: string, budget: number) => {
    setConfig(prev => ({
      ...prev,
      ad_set_budgets: {
        ...prev.ad_set_budgets,
        [id]: budget
      }
    }));
  };

  // Group hierarchy for display
  const groupedHierarchy = useMemo(() => {
    const advertisers: Record<string, Record<string, string[]>> = {};
    detectedHierarchy.forEach(h => {
      if (!advertisers[h.advertiser]) advertisers[h.advertiser] = {};
      if (!advertisers[h.advertiser][h.campaign]) advertisers[h.advertiser][h.campaign] = [];
      if (!advertisers[h.advertiser][h.campaign].includes(h.ad_set)) {
        advertisers[h.advertiser][h.campaign].push(h.ad_set);
      }
    });
    return advertisers;
  }, [detectedHierarchy]);

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

      {/* STEP 2: Preview & Configuration */}
      {step === 'preview' && (
        <div className="fade-in" style={{ maxWidth: 1000, margin: '40px auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>Setup Analysis</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              <span className="badge badge-success">✓ {csvFileName}</span> — {csvData.length} rows • {Object.keys(groupedHierarchy).length} advertisers detected
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24, alignItems: 'start' }}>
            {/* Hierarchy & Ad Set Budgets */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Advertiser & Ad Set Structure</span>
                <span className="badge badge-info">Optional: Set budgets for specific ad sets</span>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {Object.entries(groupedHierarchy).map(([advName, campaigns], advIdx) => (
                    <div key={advName} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <div style={{ padding: '16px 20px', background: 'var(--bg-primary)', fontWeight: 700, fontSize: 14 }}>
                        {advName}
                      </div>
                      {Object.entries(campaigns).map(([campName, adSets]) => (
                        <div key={campName} style={{ paddingLeft: 20 }}>
                          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                             📦 {campName}
                          </div>
                          {adSets.map(adSet => {
                            const id = `${advName}|${campName}|${adSet}`;
                            return (
                              <div key={adSet} style={{ padding: '10px 20px 10px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)' }}>
                                <div style={{ fontSize: 13 }}>{adSet}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Budget:</span>
                                  <input 
                                    className="form-input" 
                                    style={{ width: 100, padding: '4px 8px', fontSize: 12 }} 
                                    type="number" 
                                    placeholder="Optional"
                                    value={config.ad_set_budgets[id] || ''}
                                    onChange={(e) => updateAdSetBudget(id, parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Global Settings */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Global Settings</span>
              </div>
              <div className="card-body">
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Primary KPI</label>
                  <select className="form-select" value={config.kpi} onChange={(e) => setConfig({ ...config, kpi: e.target.value })}>
                    {KPI_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Currency</label>
                  <select className="form-select" value={config.currency} onChange={(e) => setConfig({ ...config, currency: e.target.value })}>
                    <option value="$">USD ($)</option>
                    <option value="€">EUR (€)</option>
                    <option value="£">GBP (£)</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Start Date</label>
                  <input className="form-input" type="date" value={config.start_date} onChange={(e) => setConfig({ ...config, start_date: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">End Date</label>
                  <input className="form-input" type="date" value={config.end_date} onChange={(e) => setConfig({ ...config, end_date: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label className="form-label">Account Total Budget</label>
                  <input className="form-input" type="number" placeholder="Fallback budget" value={config.total_budget || ''} onChange={(e) => setConfig({ ...config, total_budget: parseFloat(e.target.value) || 0 })} />
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Used if no ad set budgets are set.</p>
                </div>
                
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={analyzing} onClick={runAnalysis}>
                  {analyzing ? 'Analyzing...' : '🚀 Run Full Analysis'}
                </button>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => setStep('upload')}>
                  Back to Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
