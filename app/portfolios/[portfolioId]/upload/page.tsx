'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { supabase } from '../../../../lib/supabase';

export default function UploadPage() {
  const router = useRouter();
  const params = useParams();
  const portfolioId = params.portfolioId as string;
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'drop' | 'uploading' | 'processing' | 'done'>('drop');
  const [dragOver, setDragOver] = useState(false);
  const [filename, setFilename] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      alert('Please upload a .csv or .xlsx file.');
      return;
    }
    setFilename(f.name);
    setFile(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const startUpload = async () => {
    if (!file) return;
    setStep('uploading');
    setError(null);
    
    try {
      // 1. Get Auth Token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // 2. Parse file locally
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

      if (!rows || rows.length === 0) {
        throw new Error('No data found in file');
      }

      setStep('processing');

      // 3. Upload rows as JSON
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          portfolioId,
          rows,
          filename: file.name
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Backend processes synchronously for now and returns summary
      setJobStatus(data.summary);
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Upload error');
      setStep('drop');
    }
  };

  const STEPS = ['Select File', 'Upload', 'Process', 'Done'];
  const stepIdx = step === 'drop' ? 0 : step === 'uploading' ? 1 : step === 'processing' ? 2 : 3;

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
            Upload an XLSX or CSV file. The system will automatically ingest, map, and process the data.
          </p>
        </div>

        {error && (
          <div style={{ padding: 16, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: 10, marginBottom: 24, textAlign: 'center' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

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
                  <span style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--brand-orange)' : done ? 'var(--success)' : 'var(--text-muted)' }}>
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

        {step === 'drop' && (
          <div className="card fade-in" style={{ padding: 40, textAlign: 'center' }}>
            <div
              className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{ padding: 60, border: '2px dashed var(--border)', borderRadius: 16, cursor: 'pointer', background: dragOver ? 'var(--bg-primary)' : 'transparent' }}
            >
              <div className="upload-icon" style={{ fontSize: 40, marginBottom: 16 }}>📁</div>
              {file ? (
                <>
                  <h3 style={{ fontSize: 20 }}>{file.name}</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>Ready to upload ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
                </>
              ) : (
                <>
                  <h3>Drop your XLSX or CSV here</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>or click to browse · Supports full Excel workbook ingestion</p>
                </>
              )}
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            {file && (
              <div style={{ marginTop: 24 }}>
                <button className="btn btn-primary" style={{ padding: '12px 32px', fontSize: 16 }} onClick={startUpload}>
                  Start Upload
                </button>
              </div>
            )}
          </div>
        )}

        {(step === 'uploading' || step === 'processing') && (
          <div className="card fade-in" style={{ textAlign: 'center', padding: '80px 40px' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 24px', width: 40, height: 40, borderWidth: 4 }} />
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              {step === 'uploading' ? 'Parsing file...' : 'Ingesting data...'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
              {step === 'uploading' 
                ? 'Extracting sheets and normalizing schemas locally.' 
                : `Uploading to the server and applying structural updates.`}
            </p>
          </div>
        )}

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
              <div style={{ background: 'var(--bg-primary)', padding: 16, borderRadius: 12, marginBottom: 32, display: 'inline-block', textAlign: 'left' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Import Summary:</div>
                <ul style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, paddingLeft: 20 }}>
                  <li>{jobStatus.rowsProcessed || 0} rows processed</li>
                  <li>{jobStatus.accountsCreated || 0} new accounts</li>
                  <li>{jobStatus.campaignsCreated || 0} new campaigns</li>
                  <li>{jobStatus.adSetsCreated || 0} new ad sets</li>
                </ul>
              </div>
            )}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => router.push(`/portfolios/${portfolioId}`)}>
                Go to Dashboard
              </button>
              <button className="btn btn-secondary" onClick={() => { setStep('drop'); setFile(null); setJobStatus(null); }}>
                Upload Another
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
