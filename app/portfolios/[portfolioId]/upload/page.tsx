'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { supabase } from '../../../../lib/supabase';
import { buildGleanContext, saveGleanContext } from '../../../../lib/glean-context';
import { autoDetectColumns } from '../../../../lib/analytics';

interface KpiGoal {
  metric: string;
  target: string;
  unit: string;
}

const KPI_PRESETS: KpiGoal[] = [
  { metric: 'Target CTR', target: '', unit: '%' },
  { metric: 'Target CPC', target: '', unit: '$' },
  { metric: 'Target CPA', target: '', unit: '$' },
  { metric: 'Target ROAS', target: '', unit: 'x' },
  { metric: 'Target Visits', target: '', unit: '' },
  { metric: 'Target Conversions', target: '', unit: '' },
];

export default function UploadPage() {
  const router = useRouter();
  const params = useParams();
  const portfolioId = params.portfolioId as string;
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'drop' | 'goals' | 'uploading' | 'processing' | 'done'>('drop');
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Budget & KPI Goals state
  const [totalBudget, setTotalBudget] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [kpiGoals, setKpiGoals] = useState<KpiGoal[]>(KPI_PRESETS.map(k => ({ ...k })));
  const [customKpiLabel, setCustomKpiLabel] = useState('');
  const [customKpiTarget, setCustomKpiTarget] = useState('');
  const [customKpiUnit, setCustomKpiUnit] = useState('');

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      alert('Please upload a .csv or .xlsx file.');
      return;
    }
    setFile(f);
    setStep('goals');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const updateKpiGoal = (index: number, value: string) => {
    setKpiGoals(prev => prev.map((k, i) => i === index ? { ...k, target: value } : k));
  };

  const addCustomKpi = () => {
    if (!customKpiLabel.trim()) return;
    setKpiGoals(prev => [...prev, { metric: customKpiLabel.trim(), target: customKpiTarget, unit: customKpiUnit }]);
    setCustomKpiLabel('');
    setCustomKpiTarget('');
    setCustomKpiUnit('');
  };

  const startUpload = async () => {
    if (!file) return;
    setStep('uploading');
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let rows: any[] = [];
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'csv') {
        rows = await new Promise((resolve, reject) => {
          Papa.parse(file, {
            header: true, skipEmptyLines: true, dynamicTyping: true,
            complete: (results) => resolve(results.data),
            error: (err) => reject(err)
          });
        });
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      }

      if (!rows || rows.length === 0) throw new Error('No data found in file');

      // ── Build & save Glean context from parsed rows ──────────────────────
      const headers = Object.keys(rows[0] || {});
      const colMap = autoDetectColumns(headers);
      const gleanCtx = buildGleanContext(
        rows as Record<string, unknown>[],
        file.name,
        colMap
      );
      saveGleanContext(gleanCtx);
      // ─────────────────────────────────────────────────────────────────────

      setStep('processing');

      // Build active KPI goals (only ones with targets filled in)
      const activeGoals = [
        ...kpiGoals.filter(k => k.target.trim() !== ''),
      ];

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          portfolioId,
          rows,
          filename: file.name,
          // Pass budget and KPI goals as metadata
          budgetConfig: {
            totalBudget: totalBudget ? parseFloat(totalBudget) : undefined,
            currency,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          },
          kpiGoals: activeGoals,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setJobStatus({ ...data.summary, kpiGoals: activeGoals, budgetConfig: { totalBudget, currency, startDate, endDate } });
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Upload error');
      setStep('drop');
    }
  };

  const STEPS = ['Select File', 'Set Goals', 'Upload', 'Process', 'Done'];
  const stepIdx = step === 'drop' ? 0 : step === 'goals' ? 1 : step === 'uploading' ? 2 : step === 'processing' ? 3 : 4;

  return (
    <main className="main-content fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-muted)' }}>
        <button onClick={() => router.push('/portfolios')} className="breadcrumb-btn">Portfolios</button>
        <span>/</span>
        <button onClick={() => router.push(`/portfolios/${portfolioId}`)} className="breadcrumb-btn">Portfolio</button>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Upload Workbook</span>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>Upload Campaign Data</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Upload an XLSX or CSV file, then set your budget and KPI goals to enable pacing analysis.
          </p>
        </div>

        {error && (
          <div style={{ padding: 16, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: 10, marginBottom: 24, textAlign: 'center' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Progress Steps */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 40 }}>
          {STEPS.map((label, i) => {
            const active = i === stepIdx;
            const done = i < stepIdx || step === 'done';
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? 'var(--success)' : active ? 'var(--brand-orange)' : 'var(--border)',
                    color: done || active ? '#fff' : 'var(--text-muted)',
                    fontWeight: 700, fontSize: 14, transition: 'all 0.3s',
                  }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: active ? 'var(--brand-orange)' : done ? 'var(--success)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ width: 48, height: 2, background: done ? 'var(--success)' : 'var(--border)', margin: '0 4px', marginBottom: 22 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Step 1: File Drop ── */}
        {step === 'drop' && (
          <div className="card fade-in" style={{ padding: 40, textAlign: 'center' }}>
            <div
              className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{ padding: 60, border: '2px dashed var(--border)', borderRadius: 16, cursor: 'pointer' }}
            >
              <div className="upload-icon" style={{ fontSize: 40, marginBottom: 16 }}>📁</div>
              <h3>Drop your XLSX or CSV here</h3>
              <p style={{ color: 'var(--text-secondary)' }}>or click to browse · Supports full Excel workbook ingestion</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          </div>
        )}

        {/* ── Step 2: Budget & KPI Goals ── */}
        {step === 'goals' && (
          <div className="card fade-in" style={{ overflow: 'hidden' }}>
            {/* File selected banner */}
            <div style={{ padding: '14px 24px', background: 'linear-gradient(135deg, var(--brand-dark), var(--brand-navy))', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24 }}>📄</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{file?.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{((file?.size || 0) / 1024).toFixed(1)} KB — ready to process</div>
              </div>
              <button
                onClick={() => { setFile(null); setStep('drop'); }}
                style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
              >
                Change File
              </button>
            </div>

            <div className="card-body">
              {/* Section: Campaign Budget */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, var(--brand-orange), var(--brand-orange-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>💰</div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>Campaign Budget</h2>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>optional — enables pacing calculations</span>
                </div>

                <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Total Budget</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        value={currency}
                        onChange={e => setCurrency(e.target.value)}
                        className="form-select"
                        style={{ width: 80, flexShrink: 0 }}
                      >
                        <option value="USD">$ USD</option>
                        <option value="EUR">€ EUR</option>
                        <option value="GBP">£ GBP</option>
                        <option value="SGD">S$ SGD</option>
                        <option value="IDR">Rp IDR</option>
                      </select>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="e.g. 50000"
                        value={totalBudget}
                        onChange={e => setTotalBudget(e.target.value)}
                        min="0"
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Flight Start Date</label>
                    <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Flight End Date</label>
                    <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Section: KPI Goals */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🎯</div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>KPI Goals</h2>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>set targets to compare against actual performance</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                  {kpiGoals.map((goal, idx) => (
                    <div key={goal.metric} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: goal.target ? 'rgba(99,102,241,0.03)' : 'var(--bg-card)', transition: 'all 0.2s' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{goal.metric}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {goal.unit && <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>{goal.unit}</span>}
                          <input
                            type="number"
                            className="form-input"
                            placeholder="Target value"
                            value={goal.target}
                            onChange={e => updateKpiGoal(idx, e.target.value)}
                            style={{ padding: '6px 10px', fontSize: 13, flex: 1 }}
                            min="0"
                          />
                        </div>
                      </div>
                      {goal.target && (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} title="Target set" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Custom KPI */}
                <div style={{ marginTop: 16, padding: 16, borderRadius: 10, border: '1px dashed var(--border)', background: 'var(--bg-primary)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>+ ADD CUSTOM KPI GOAL</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input
                      className="form-input"
                      placeholder="Metric name (e.g. Target Reach)"
                      value={customKpiLabel}
                      onChange={e => setCustomKpiLabel(e.target.value)}
                      style={{ flex: 2, minWidth: 160, fontSize: 13, padding: '7px 12px' }}
                    />
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Target value"
                      value={customKpiTarget}
                      onChange={e => setCustomKpiTarget(e.target.value)}
                      style={{ flex: 1, minWidth: 110, fontSize: 13, padding: '7px 12px' }}
                    />
                    <input
                      className="form-input"
                      placeholder="Unit (%, $, x…)"
                      value={customKpiUnit}
                      onChange={e => setCustomKpiUnit(e.target.value)}
                      style={{ width: 90, fontSize: 13, padding: '7px 12px' }}
                    />
                    <button
                      onClick={addCustomKpi}
                      disabled={!customKpiLabel.trim()}
                      className="btn btn-secondary"
                      style={{ padding: '7px 16px', fontSize: 13 }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-light)' }}>
                <button className="btn btn-primary" style={{ padding: '12px 32px', fontSize: 15 }} onClick={startUpload}>
                  🚀 Process & Upload
                </button>
                <button className="btn btn-secondary" onClick={() => { setStep('drop'); setFile(null); }}>
                  ← Back
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
                  Goals without values will be skipped
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Steps 3 & 4: Uploading / Processing ── */}
        {(step === 'uploading' || step === 'processing') && (
          <div className="card fade-in" style={{ textAlign: 'center', padding: '80px 40px' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 24px', width: 40, height: 40, borderWidth: 4 }} />
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              {step === 'uploading' ? 'Parsing file...' : 'Ingesting data...'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
              {step === 'uploading'
                ? 'Extracting sheets and normalizing schemas locally.'
                : 'Uploading to the server and applying structural updates.'}
            </p>
          </div>
        )}

        {/* ── Step 5: Done ── */}
        {step === 'done' && (
          <div className="card fade-in" style={{ textAlign: 'center', padding: '60px 40px' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--success)', color: '#fff', fontSize: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              ✓
            </div>
            <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Ingestion Complete</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 32 }}>
              Your campaign tracker has been successfully imported and processed.
            </p>

            {jobStatus && (
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
                {/* Import summary */}
                <div style={{ background: 'var(--bg-primary)', padding: '16px 24px', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'left', minWidth: 200 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13 }}>📊 Import Summary</div>
                  <ul style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
                    <li>{jobStatus.rowsProcessed || 0} rows processed</li>
                    <li>{jobStatus.accountsCreated || 0} new accounts</li>
                    <li>{jobStatus.campaignsCreated || 0} campaigns</li>
                    <li>{jobStatus.adSetsCreated || 0} ad sets</li>
                  </ul>
                </div>

                {/* Budget config */}
                {jobStatus.budgetConfig?.totalBudget && (
                  <div style={{ background: 'rgba(244,129,32,0.05)', padding: '16px 24px', borderRadius: 12, border: '1px solid rgba(244,129,32,0.2)', textAlign: 'left', minWidth: 200 }}>
                    <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13, color: 'var(--brand-orange)' }}>💰 Budget Configured</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
                      <div>Total: <strong>{jobStatus.budgetConfig.currency} {parseFloat(jobStatus.budgetConfig.totalBudget).toLocaleString()}</strong></div>
                      {jobStatus.budgetConfig.startDate && <div>Start: {jobStatus.budgetConfig.startDate}</div>}
                      {jobStatus.budgetConfig.endDate && <div>End: {jobStatus.budgetConfig.endDate}</div>}
                    </div>
                  </div>
                )}

                {/* KPI Goals */}
                {jobStatus.kpiGoals?.length > 0 && (
                  <div style={{ background: 'rgba(99,102,241,0.05)', padding: '16px 24px', borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)', textAlign: 'left', minWidth: 200 }}>
                    <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13, color: '#6366f1' }}>🎯 KPI Goals Set</div>
                    <ul style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
                      {jobStatus.kpiGoals.map((g: any, i: number) => (
                        <li key={i}>{g.metric}: <strong>{g.unit}{g.target}</strong></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => router.push(`/portfolios/${portfolioId}`)}>
                Go to Dashboard
              </button>
              <button className="btn btn-secondary" onClick={() => { setStep('drop'); setFile(null); setJobStatus(null); setTotalBudget(''); setStartDate(''); setEndDate(''); setKpiGoals(KPI_PRESETS.map(k => ({ ...k }))); }}>
                Upload Another
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
