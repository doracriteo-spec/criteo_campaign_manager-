'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Papa from 'papaparse';
import { autoDetectColumns, COLUMN_PATTERNS } from '../../../../lib/analytics';
import { authFetch } from '../../../../lib/auth-fetch';

const REQUIRED_FIELDS = ['date', 'spend'];
const IMPORTANT_FIELDS = ['advertiser', 'campaign', 'ad_set'];
const ALL_FIELDS = Object.keys(COLUMN_PATTERNS);

interface ColMap { [field: string]: string | null }
interface AdSetBudget { name: string; campaign: string; detectedBudget: number | null; manualBudget: string; }
interface ImportSummary {
  accountsCreated: number;
  accountsUpdated: number;
  campaignsCreated: number;
  adSetsCreated: number;
  rowsProcessed: number;
  rowsSkipped: number;
  errors: string[];
}

export default function UploadPage() {
  const router = useRouter();
  const params = useParams();
  const portfolioId = params.portfolioId as string;
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'drop' | 'mapping' | 'budgets' | 'uploading' | 'done'>('drop');
  const [dragOver, setDragOver] = useState(false);
  const [filename, setFilename] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [colMap, setColMap] = useState<ColMap>({});
  const [adSetBudgets, setAdSetBudgets] = useState<AdSetBudget[]>([]);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) { alert('Please upload a .csv file.'); return; }
    setFilename(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        const data = results.data as Record<string, unknown>[];
        setRows(data);
        const hdrs = Object.keys(data[0] || {});
        setHeaders(hdrs);
        const detected = autoDetectColumns(hdrs);
        setColMap(detected as ColMap);
        setStep('mapping');
      },
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // After column mapping, extract unique ad sets for the budget review step
  const proceedToBudgets = () => {
    const adSetCol = colMap['ad_set'];
    const campaignCol = colMap['campaign'];
    const budgetCol = colMap['budget'];

    // Aggregate unique ad sets with their detected budgets
    const seen = new Map<string, AdSetBudget>();
    for (const row of rows) {
      const adSetName = adSetCol ? String(row[adSetCol] || '').trim() : '';
      const campaignName = campaignCol ? String(row[campaignCol] || '').trim() : 'Unknown Campaign';
      if (!adSetName) continue;
      const key = `${campaignName}||${adSetName}`;
      if (!seen.has(key)) {
        const detectedBudget = budgetCol ? (Number(row[budgetCol]) || null) : null;
        seen.set(key, { name: adSetName, campaign: campaignName, detectedBudget, manualBudget: detectedBudget ? String(detectedBudget) : '' });
      }
    }

    const uniqueAdSets = Array.from(seen.values());
    if (uniqueAdSets.length === 0) {
      // No ad sets detected — skip budget step
      handleConfirmUpload(undefined, []);
      return;
    }
    setAdSetBudgets(uniqueAdSets);
    setStep('budgets');
  };

  const handleConfirmUpload = async (e?: React.FormEvent, budgetOverrides?: AdSetBudget[]) => {
    if (e) e.preventDefault();
    setUploading(true);
    setStep('uploading');

    const overrideMap: Record<string, number> = {};
    (budgetOverrides ?? adSetBudgets).forEach(ab => {
      if (ab.manualBudget && Number(ab.manualBudget) > 0) {
        overrideMap[`${ab.campaign}||${ab.name}`] = Number(ab.manualBudget);
      }
    });

    try {
      const res = await authFetch('/api/upload', {
        method: 'POST',
        body: JSON.stringify({ portfolioId, rows, columnMap: colMap, filename, budgetOverrides: overrideMap }),
      });
      const data = await res.json();
      if (res.ok) {
        setSummary(data.summary);
        setStep('done');
      } else {
        alert(data.error || 'Upload failed');
        setStep('budgets');
      }
    } catch {
      alert('Network error during upload');
      setStep('budgets');
    }
    setUploading(false);
  };

  const unmappedRequired = REQUIRED_FIELDS.filter(f => !colMap[f]);
  const missingBudgets = adSetBudgets.filter(ab => !ab.manualBudget || Number(ab.manualBudget) <= 0);

  const STEPS = ['Drop File', 'Map Columns', 'Budget Review', 'Import'];
  const stepKeys = ['drop', 'mapping', 'budgets', 'done'];
  const stepIdx = step === 'uploading' ? 3 : stepKeys.indexOf(step);

  return (
    <main className="main-content fade-in">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-muted)' }}>
        <button onClick={() => router.push('/portfolios')} className="breadcrumb-btn">Portfolios</button>
        <span>/</span>
        <button onClick={() => router.push(`/portfolios/${portfolioId}`)} className="breadcrumb-btn">Portfolio</button>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Upload CSV</span>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>Upload Campaign Data</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Upload any campaign export CSV. Review and override budgets before importing.
          </p>
        </div>

        {/* Progress steps */}
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
                  <span style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--brand-orange)' : done ? 'var(--success)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ width: 64, height: 2, background: done ? 'var(--success)' : 'var(--border)', margin: '0 6px', marginBottom: 22 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* STEP 1: Drop */}
        {step === 'drop' && (
          <div
            className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="upload-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <h3>Drop your CSV here</h3>
            <p>or click to browse · Supports Criteo, Google Ads, Meta, and generic campaign exports</p>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        )}

        {/* STEP 2: Column Mapping */}
        {step === 'mapping' && (
          <div className="card fade-in">
            <div className="card-header">
              <div>
                <span className="card-title">Map CSV Columns</span>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {filename} · {rows.length} rows · {headers.length} columns detected
                </div>
              </div>
              <span className="badge badge-success">✓ File loaded</span>
            </div>
            <div className="card-body">
              <div style={{ marginBottom: 20, padding: 14, background: 'var(--bg-primary)', borderRadius: 10, fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11 }}>
                  Detected columns
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {headers.slice(0, 14).map(h => (
                    <span key={h} style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      color: Object.values(colMap).includes(h) ? 'var(--brand-orange)' : 'var(--text-secondary)',
                    }}>{h}</span>
                  ))}
                  {headers.length > 14 && <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 6px' }}>+{headers.length - 14} more</span>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
                {ALL_FIELDS.map(field => {
                  const isReq = REQUIRED_FIELDS.includes(field);
                  const isImp = IMPORTANT_FIELDS.includes(field);
                  return (
                    <div key={field} className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {field.replace(/_/g, ' ')}
                        {isReq && <span style={{ color: 'var(--danger)', fontSize: 10, fontWeight: 700 }}>REQUIRED</span>}
                        {isImp && !isReq && <span style={{ color: 'var(--warning)', fontSize: 10, fontWeight: 700 }}>KEY</span>}
                      </label>
                      <select
                        className="form-select"
                        value={colMap[field] || ''}
                        onChange={e => setColMap(prev => ({ ...prev, [field]: e.target.value || null }))}
                      >
                        <option value="">— not mapped —</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>

              {unmappedRequired.length > 0 && (
                <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, marginBottom: 20, color: 'var(--danger)', fontSize: 13 }}>
                  ⚠️ Required fields not mapped: <strong>{unmappedRequired.join(', ')}</strong>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn btn-primary"
                  style={{ justifyContent: 'center', minWidth: 180 }}
                  disabled={unmappedRequired.length > 0}
                  onClick={proceedToBudgets}
                  id="next-to-budgets-btn"
                >
                  Next: Review Budgets →
                </button>
                <button className="btn btn-secondary" onClick={() => setStep('drop')}>← Different file</button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Budget Review & Edit */}
        {step === 'budgets' && (
          <div className="card fade-in">
            <div className="card-header">
              <div>
                <span className="card-title">Review & Override Budgets</span>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {adSetBudgets.length} ad sets detected · Manual inputs override CSV data
                </div>
              </div>
              {missingBudgets.length > 0 && (
                <span className="badge badge-warning">⚠ {missingBudgets.length} missing budget</span>
              )}
            </div>
            <div className="card-body">
              <div style={{
                padding: '12px 16px', borderRadius: 10, marginBottom: 20,
                background: 'rgba(59,130,246,0.06)',
                border: '1px solid rgba(59,130,246,0.15)',
                fontSize: 13, color: 'var(--info)',
              }}>
                💡 Enter monthly budget amounts for each ad set. This overrides any budget values detected in the CSV, ensuring accurate pacing calculations for shifting monthly targets.
              </div>

              <div style={{ overflowX: 'auto', marginBottom: 24 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 16 }}>Campaign</th>
                      <th>Ad Set</th>
                      <th style={{ textAlign: 'right' }}>CSV Budget</th>
                      <th style={{ textAlign: 'right', width: 180 }}>
                        Monthly Budget Override *
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {adSetBudgets.map((ab, idx) => {
                      const isMissing = !ab.manualBudget || Number(ab.manualBudget) <= 0;
                      return (
                        <tr key={idx} style={{ background: isMissing ? 'rgba(245,158,11,0.04)' : undefined }}>
                          <td style={{ paddingLeft: 16, fontSize: 13, color: 'var(--text-secondary)' }}>{ab.campaign}</td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{ab.name}</div>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>
                            {ab.detectedBudget ? `$${ab.detectedBudget.toLocaleString()}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', paddingRight: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                              {isMissing && (
                                <span title="Budget required for pacing" style={{ color: 'var(--warning)', fontSize: 14 }}>⚠</span>
                              )}
                              <div style={{ position: 'relative' }}>
                                <span style={{
                                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                                  fontSize: 12, color: 'var(--text-muted)', pointerEvents: 'none',
                                }}>$</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={100}
                                  placeholder="0"
                                  value={ab.manualBudget}
                                  onChange={e => {
                                    const updated = [...adSetBudgets];
                                    updated[idx] = { ...updated[idx], manualBudget: e.target.value };
                                    setAdSetBudgets(updated);
                                  }}
                                  style={{
                                    width: 130,
                                    padding: '7px 10px 7px 20px',
                                    borderRadius: 8,
                                    border: `1.5px solid ${isMissing ? 'var(--warning)' : 'var(--border)'}`,
                                    fontSize: 13,
                                    fontFamily: 'inherit',
                                    textAlign: 'right',
                                    background: isMissing ? 'rgba(245,158,11,0.04)' : 'var(--bg-primary)',
                                    outline: 'none',
                                  }}
                                  onFocus={e => (e.target.style.borderColor = 'var(--brand-orange)')}
                                  onBlur={e => (e.target.style.borderColor = isMissing ? 'var(--warning)' : 'var(--border)')}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {missingBudgets.length > 0 && (
                <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.08)', borderRadius: 8, marginBottom: 20, color: 'var(--warning)', fontSize: 13 }}>
                  ⚠ <strong>{missingBudgets.length} ad set{missingBudgets.length > 1 ? 's are' : ' is'} missing a budget.</strong> Ad sets without budgets will show as "No Budget" in the pacing dashboard. You can still import and add budgets later.
                </div>
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn btn-primary"
                  style={{ justifyContent: 'center', minWidth: 180 }}
                  onClick={e => handleConfirmUpload(e)}
                  disabled={uploading}
                  id="confirm-import-btn"
                >
                  Import {rows.length.toLocaleString()} Rows →
                </button>
                <button className="btn btn-secondary" onClick={() => setStep('mapping')}>← Back to Mapping</button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3.5: Uploading */}
        {step === 'uploading' && (
          <div className="card fade-in" style={{ textAlign: 'center', padding: '60px 40px' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 24px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Importing data…</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Creating accounts, campaigns, and ad sets with your budget overrides applied.
            </p>
          </div>
        )}

        {/* STEP 4: Done */}
        {step === 'done' && summary && (
          <div className="card fade-in">
            <div className="card-header">
              <span className="card-title">✅ Import Complete</span>
              <span className="badge badge-success">{summary.rowsProcessed} rows saved</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'Accounts Created', val: summary.accountsCreated, color: 'var(--success)' },
                  { label: 'Accounts Updated', val: summary.accountsUpdated, color: 'var(--info)' },
                  { label: 'Campaigns Created', val: summary.campaignsCreated, color: 'var(--brand-orange)' },
                  { label: 'Ad Sets Created', val: summary.adSetsCreated, color: 'var(--brand-orange)' },
                  { label: 'Rows Processed', val: summary.rowsProcessed, color: 'var(--success)' },
                  { label: 'Rows Skipped', val: summary.rowsSkipped, color: summary.rowsSkipped > 0 ? 'var(--warning)' : 'var(--text-muted)' },
                ].map(item => (
                  <div key={item.label} style={{ padding: 16, background: 'var(--bg-primary)', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: item.color }}>{item.val}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{item.label}</div>
                  </div>
                ))}
              </div>

              {summary.errors.length > 0 && (
                <div style={{ padding: 16, background: 'rgba(239,68,68,0.06)', borderRadius: 10, marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: 8, fontSize: 13 }}>⚠️ {summary.errors.length} errors</div>
                  {summary.errors.slice(0, 5).map((e, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{e}</div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => router.push(`/portfolios/${portfolioId}`)}>
                  View Portfolio Dashboard →
                </button>
                <button className="btn btn-secondary" onClick={() => { setStep('drop'); setRows([]); setHeaders([]); setSummary(null); setAdSetBudgets([]); }}>
                  Upload another file
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
