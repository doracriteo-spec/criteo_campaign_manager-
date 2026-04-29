'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

interface Portfolio {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export default function PortfoliosPage() {
  const router = useRouter();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPortfolios = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/login'); return; }

    const res = await fetch('/api/portfolios');
    if (res.ok) {
      const data = await res.json();
      setPortfolios(data);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchPortfolios(); }, [fetchPortfolios]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');

    const res = await fetch('/api/portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
    });

    if (res.ok) {
      const created = await res.json();
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      router.push(`/portfolios/${created.id}`);
    } else {
      const { error: msg } = await res.json();
      setError(msg || 'Failed to create portfolio');
    }
    setCreating(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete portfolio "${name}"? This will remove all accounts and data inside it.`)) return;
    setDeletingId(id);
    await fetch(`/api/portfolios/${id}`, { method: 'DELETE' });
    setPortfolios(prev => prev.filter(p => p.id !== id));
    setDeletingId(null);
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (loading) {
    return (
      <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="loading-spinner" />
      </main>
    );
  }

  return (
    <main className="main-content fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>My Portfolios</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {portfolios.length} portfolio{portfolios.length !== 1 ? 's' : ''} — each portfolio tracks multiple advertiser accounts
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-portfolio-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Portfolio
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: 460, padding: 0 }}>
            <div className="card-header">
              <span className="card-title">Create Portfolio</span>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <div className="card-body">
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Portfolio Name *</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Q2 2025 — APAC Accounts"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    required
                    autoFocus
                    id="portfolio-name-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description (optional)</label>
                  <input
                    className="form-input"
                    placeholder="What accounts or campaigns does this cover?"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                  />
                </div>
                {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="submit" className="btn btn-primary" disabled={creating} style={{ flex: 1, justifyContent: 'center' }}>
                    {creating ? 'Creating…' : 'Create Portfolio'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio grid */}
      {portfolios.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '80px 24px',
          border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-card)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No portfolios yet</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
            Create your first portfolio to start tracking campaign pacing across advertiser accounts.
          </p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            Create your first portfolio
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {portfolios.map(p => (
            <div
              key={p.id}
              className="card"
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => router.push(`/portfolios/${p.id}`)}
            >
              <div style={{ padding: '24px 24px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'linear-gradient(135deg, var(--brand-orange), var(--brand-orange-dark))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 18, fontWeight: 800, flexShrink: 0,
                  }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(p.id, p.name); }}
                    disabled={deletingId === p.id}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', padding: 4, borderRadius: 6,
                      opacity: 0.6, fontSize: 16,
                    }}
                    title="Delete portfolio"
                  >
                    🗑
                  </button>
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>{p.name}</h2>
                {p.description && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>{p.description}</p>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
                  <span>Created {fmt(p.created_at)}</span>
                </div>
              </div>
              <div style={{
                padding: '12px 24px', borderTop: '1px solid var(--border-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-primary)',
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Open portfolio →</span>
                <span className="badge badge-info">Active</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
