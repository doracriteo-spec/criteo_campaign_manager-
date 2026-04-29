'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { calculatePacing, getPacingColor, PacingResult } from '../../../lib/analytics';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

interface Account {
  id: string;
  name: string;
  global_account: string;
  market: string;
  owner_as: string;
  currency: string;
  kpi_target: number;
  kpi_metric: string;
  goals: string;
  daily_metrics: Array<{ spend: number; budget: number; date: string }>;
}

interface Portfolio {
  id: string;
  name: string;
  description: string;
  accounts: Account[];
}

function deriveAccountStats(acct: Account) {
  const metrics = acct.daily_metrics || [];
  const totalSpend = metrics.reduce((s, m) => s + (m.spend || 0), 0);
  const totalBudget = metrics.reduce((s, m) => s + (m.budget || 0), 0);
  const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = sorted[0]?.date || '';
  const endDate = sorted[sorted.length - 1]?.date || '';
  const pacing = calculatePacing(totalBudget, totalSpend, startDate, endDate);
  return { totalSpend, totalBudget, pacing, sorted };
}

export default function PortfolioDashboard() {
  const router = useRouter();
  const params = useParams();
  const portfolioId = params.portfolioId as string;

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchPortfolio = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/login'); return; }

    const res = await fetch(`/api/portfolios/${portfolioId}`);
    if (res.ok) {
      setPortfolio(await res.json());
    } else {
      router.replace('/portfolios');
    }
    setLoading(false);
  }, [portfolioId, router]);

  useEffect(() => { fetchPortfolio(); }, [fetchPortfolio]);

  if (loading) {
    return (
      <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="loading-spinner" />
      </main>
    );
  }

  if (!portfolio) return null;

  const accounts = portfolio.accounts || [];
  const accountStats = accounts.map(a => ({ account: a, ...deriveAccountStats(a) }));

  // Portfolio totals
  const totalSpend = accountStats.reduce((s, a) => s + a.totalSpend, 0);
  const totalBudget = accountStats.reduce((s, a) => s + a.totalBudget, 0);
  const remaining = totalBudget - totalSpend;
  const spendPct = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;

  const underpacing = accountStats.filter(a => a.pacing.status.includes('Underpacing')).length;
  const overpacing  = accountStats.filter(a => a.pacing.status.includes('Overpacing')).length;
  const onTrack     = accountStats.filter(a => a.pacing.status === 'On Track').length;
  const noBudget    = accountStats.filter(a => !a.pacing.hasBudget).length;

  // Filtered accounts
  const filtered = accountStats.filter(a => {
    const matchName = a.account.name.toLowerCase().includes(filter.toLowerCase());
    if (!matchName) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'underpacing') return a.pacing.status.includes('Underpacing');
    if (statusFilter === 'overpacing') return a.pacing.status.includes('Overpacing');
    if (statusFilter === 'ontrack') return a.pacing.status === 'On Track';
    if (statusFilter === 'nobudget') return !a.pacing.hasBudget;
    return true;
  });

  // Spend vs Budget bar chart
  const chartAccounts = accountStats.slice(0, 10);
  const barChartData = {
    labels: chartAccounts.map(a => a.account.name.length > 14 ? a.account.name.slice(0, 14) + '…' : a.account.name),
    datasets: [
      {
        label: 'Budget',
        data: chartAccounts.map(a => a.totalBudget),
        backgroundColor: 'rgba(229,231,235,0.8)',
        borderRadius: 6,
      },
      {
        label: 'Spend',
        data: chartAccounts.map(a => a.totalSpend),
        backgroundColor: 'rgba(244,129,32,0.85)',
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' as const }, tooltip: { mode: 'index' as const } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: 'rgba(0,0,0,0.05)' } },
    },
  };

  const fmtCcy = (n: number, ccy = '$') => `${ccy}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <main className="main-content fade-in">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-muted)' }}>
        <button onClick={() => router.push('/portfolios')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-orange)', fontWeight: 600, fontSize: 13, padding: 0 }}>
          Portfolios
        </button>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{portfolio.name}</span>
      </div>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>{portfolio.name}</h1>
          {portfolio.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{portfolio.description}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={() => router.push(`/portfolios/${portfolioId}/upload`)} id="upload-csv-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload CSV
          </button>
          <button className="btn btn-primary" onClick={() => router.push(`/portfolios/${portfolioId}/accounts/new`)} id="add-account-btn">
            + Add Account
          </button>
        </div>
      </div>

      {/* Summary KPI cards */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card" style={{ borderTop: '4px solid var(--brand-orange)' }}>
          <div className="stat-label">Total Spend</div>
          <div className="stat-value">{fmtCcy(totalSpend)}</div>
          <div className="stat-sub">{spendPct.toFixed(1)}% of budget used</div>
        </div>
        <div className="stat-card" style={{ borderTop: '4px solid #60a5fa' }}>
          <div className="stat-label">Total Budget</div>
          <div className="stat-value">{fmtCcy(totalBudget)}</div>
          <div className="stat-sub">{accounts.length} accounts tracked</div>
        </div>
        <div className="stat-card" style={{ borderTop: '4px solid var(--success)' }}>
          <div className="stat-label">Remaining Budget</div>
          <div className="stat-value">{fmtCcy(remaining)}</div>
          <div className="stat-sub">across all accounts</div>
        </div>
      </div>

      {/* Pacing status chips */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          { label: 'Underpacing', count: underpacing, color: 'badge-warning', filter: 'underpacing' },
          { label: 'Overpacing', count: overpacing, color: 'badge-danger', filter: 'overpacing' },
          { label: 'On Track', count: onTrack, color: 'badge-success', filter: 'ontrack' },
          { label: 'No Budget', count: noBudget, color: 'badge-info', filter: 'nobudget' },
        ].map(chip => (
          <button
            key={chip.filter}
            onClick={() => setStatusFilter(statusFilter === chip.filter ? 'all' : chip.filter)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 24,
              border: statusFilter === chip.filter ? '2px solid var(--brand-orange)' : '1px solid var(--border)',
              background: statusFilter === chip.filter ? 'var(--bg-card-hover)' : 'var(--bg-card)',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}
          >
            <span className={`badge ${chip.color}`} style={{ minWidth: 24, justifyContent: 'center' }}>{chip.count}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{chip.label}</span>
          </button>
        ))}
      </div>

      {/* Budget utilization bar */}
      {totalBudget > 0 && (
        <div className="card" style={{ marginBottom: 28 }}>
          <div className="card-header">
            <span className="card-title">Portfolio Budget Utilization</span>
            <span className="badge badge-info">{spendPct.toFixed(1)}% utilized</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
              <span>Spend: <strong>{fmtCcy(totalSpend)}</strong></span>
              <span>Budget: <strong>{fmtCcy(totalBudget)}</strong></span>
            </div>
            <div className="pacing-bar-bg" style={{ height: 14 }}>
              <div className="pacing-bar-fill" style={{ width: `${Math.min(100, spendPct)}%`, height: '100%' }} />
            </div>
          </div>
        </div>
      )}

      {/* Spend vs Budget chart */}
      {accountStats.length > 0 && (
        <div className="card" style={{ marginBottom: 28 }}>
          <div className="card-header">
            <span className="card-title">Spend vs Budget by Account</span>
          </div>
          <div className="card-body">
            <div style={{ height: 260 }}>
              <Bar data={barChartData} options={chartOptions} />
            </div>
          </div>
        </div>
      )}

      {/* Account table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Accounts ({filtered.length})</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              className="form-input"
              placeholder="Search accounts…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ width: 200, padding: '6px 12px', fontSize: 13 }}
            />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
            {accounts.length === 0 ? (
              <>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>No accounts yet</div>
                <p style={{ fontSize: 13, marginBottom: 20 }}>Upload a CSV or add an account manually to get started.</p>
                <button className="btn btn-primary" onClick={() => router.push(`/portfolios/${portfolioId}/upload`)}>
                  Upload CSV
                </button>
              </>
            ) : (
              <div style={{ fontSize: 13 }}>No accounts match your filter.</div>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Account</th>
                  <th>Market</th>
                  <th>Owner</th>
                  <th style={{ textAlign: 'right' }}>Budget</th>
                  <th style={{ textAlign: 'right' }}>Spend</th>
                  <th style={{ textAlign: 'right' }}>Remaining</th>
                  <th style={{ textAlign: 'center' }}>Pacing</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ account, totalSpend, totalBudget, pacing }) => {
                  const remaining = totalBudget - totalSpend;
                  const colorKey = getPacingColor(pacing.status);
                  const badgeCls = colorKey === 'success' ? 'badge-success' : colorKey === 'danger' ? 'badge-danger' : colorKey === 'warning' ? 'badge-warning' : 'badge-info';
                  return (
                    <tr
                      key={account.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/portfolios/${portfolioId}/accounts/${account.id}`)}
                    >
                      <td style={{ paddingLeft: 24 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{account.name}</div>
                        {account.global_account && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{account.global_account}</div>}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{account.market || '—'}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{account.owner_as || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCcy(totalBudget, account.currency === 'EUR' ? '€' : '$')}</td>
                      <td style={{ textAlign: 'right' }}>{fmtCcy(totalSpend, account.currency === 'EUR' ? '€' : '$')}</td>
                      <td style={{ textAlign: 'right', color: remaining < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                        {fmtCcy(remaining, account.currency === 'EUR' ? '€' : '$')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {pacing.hasBudget ? `${(pacing.ratio * 100).toFixed(0)}%` : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${badgeCls}`}>{pacing.status}</span>
                      </td>
                      <td style={{ paddingRight: 16 }}>
                        <span style={{ color: 'var(--brand-orange)', fontSize: 13 }}>→</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
