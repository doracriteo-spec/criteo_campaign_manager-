'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../../../lib/supabase';
import { authFetch } from '../../../../../lib/auth-fetch';
import { calculatePacing, getPacingColor } from '../../../../../lib/analytics';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface DailyMetric {
  spend: number;
  budget: number;
  date: string;
  clicks: number;
  impressions: number;
  conversions: number;
  revenue: number;
  visits: number;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  kpi: string;
  total_budget: number;
  start_date: string;
  end_date: string;
  ad_sets: Array<{ id: string; name: string; budget: number; status: string }>;
}

interface AccountData {
  id: string;
  name: string;
  global_account: string;
  market: string;
  owner_as: string;
  currency: string;
  kpi_target: number;
  kpi_metric: string;
  goals: string;
  notes: string;
  campaigns: Campaign[];
  account_notes: Array<{ id: string; content: string; type: string; status: string }>;
  daily_metrics: DailyMetric[];
}

export default function AccountDashboard() {
  const router = useRouter();
  const params = useParams();
  const { portfolioId, accountId } = params as { portfolioId: string; accountId: string };

  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAccount = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/login'); return; }

    const res = await authFetch(`/api/accounts/${accountId}`);
    if (res.ok) {
      setAccount(await res.json());
    } else {
      router.replace(`/portfolios/${portfolioId}`);
    }
    setLoading(false);
  }, [accountId, portfolioId, router]);

  useEffect(() => { fetchAccount(); }, [fetchAccount]);

  if (loading) {
    return <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="loading-spinner" /></main>;
  }
  if (!account) return null;

  const metrics = account.daily_metrics || [];
  const totalSpend = metrics.reduce((s, m) => s + (m.spend || 0), 0);
  const totalBudget = metrics.reduce((s, m) => s + (m.budget || 0), 0);
  const totalClicks = metrics.reduce((s, m) => s + (m.clicks || 0), 0);
  const totalImpressions = metrics.reduce((s, m) => s + (m.impressions || 0), 0);
  const totalConversions = metrics.reduce((s, m) => s + (m.conversions || 0), 0);
  const totalRevenue = metrics.reduce((s, m) => s + (m.revenue || 0), 0);

  const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = sorted[0]?.date || '';
  const endDate = sorted[sorted.length - 1]?.date || '';
  const pacing = calculatePacing(totalBudget, totalSpend, startDate, endDate);
  const colorKey = getPacingColor(pacing.status);

  const ccy = account.currency === 'EUR' ? '€' : '$';
  const fmtCcy = (n: number) => `${ccy}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const roas = totalSpend > 0 ? (totalRevenue / totalSpend) : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpo = totalConversions > 0 ? totalSpend / totalConversions : 0;

  // Spend trend chart
  const last30 = sorted.slice(-30);
  const chartData = {
    labels: last30.map(m => {
      const d = new Date(m.date);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }),
    datasets: [{
      label: 'Daily Spend',
      data: last30.map(m => m.spend),
      borderColor: 'rgba(244,129,32,0.9)',
      backgroundColor: 'rgba(244,129,32,0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: 'rgba(0,0,0,0.04)' } },
    },
  };

  const openActions = (account.account_notes || []).filter(n => n.type === 'action' && n.status !== 'done').length;

  return (
    <main className="main-content fade-in">
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--brand-orange), var(--brand-orange-dark))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 18, fontWeight: 800,
          }}>
            {account.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{account.name}</h1>
            <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              {account.market && <span>📍 {account.market}</span>}
              {account.owner_as && <span>👤 {account.owner_as}</span>}
              {account.global_account && <span>🏢 {account.global_account}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ borderTop: '4px solid var(--brand-orange)' }}>
          <div className="stat-label">Total Spend</div>
          <div className="stat-value">{fmtCcy(totalSpend)}</div>
          <div className="stat-sub">of {fmtCcy(totalBudget)} budget</div>
        </div>
        <div className="stat-card" style={{ borderTop: `4px solid var(--${colorKey})` }}>
          <div className="stat-label">Pacing Status</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{pacing.status}</div>
          <div className="stat-sub">{(pacing.ratio * 100).toFixed(1)}% of expected</div>
        </div>
        <div className="stat-card" style={{ borderTop: '4px solid #60a5fa' }}>
          <div className="stat-label">Daily Budget Required</div>
          <div className="stat-value">{fmtCcy(pacing.dailyBudgetRequired)}</div>
          <div className="stat-sub">{pacing.remainingDays} days remaining</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">ROAS</div>
          <div className="stat-value">{roas.toFixed(2)}x</div>
          <div className="stat-sub">{fmtCcy(totalRevenue)} revenue</div>
        </div>
      </div>

      {/* Second row KPIs */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-label">Conversions</div>
          <div className="stat-value">{totalConversions.toLocaleString()}</div>
          <div className="stat-sub">CPO: {fmtCcy(cpo)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Clicks</div>
          <div className="stat-value">{totalClicks.toLocaleString()}</div>
          <div className="stat-sub">CTR: {ctr.toFixed(2)}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Impressions</div>
          <div className="stat-value">{totalImpressions.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Open Actions</div>
          <div className="stat-value" style={{ color: openActions > 0 ? 'var(--warning)' : 'var(--success)' }}>{openActions}</div>
          <div className="stat-sub">{(account.account_notes || []).length} total notes</div>
        </div>
      </div>

      {/* Budget progress */}
      {totalBudget > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">Budget Utilization</span>
            <span className={`badge badge-${colorKey}`}>{pacing.status}</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
              <span>Spent: <strong>{fmtCcy(totalSpend)}</strong></span>
              <span>Remaining: <strong>{fmtCcy(totalBudget - totalSpend)}</strong></span>
              <span>Budget: <strong>{fmtCcy(totalBudget)}</strong></span>
            </div>
            <div className="pacing-bar-bg" style={{ height: 14 }}>
              <div className="pacing-bar-fill" style={{ width: `${Math.min(100, (totalSpend / totalBudget) * 100)}%`, height: '100%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              <span>Day {pacing.elapsedDays} of {pacing.totalDays}</span>
              <span>Projected: {fmtCcy(pacing.projectedSpend)} ({pacing.projectedVariance >= 0 ? '+' : ''}{fmtCcy(pacing.projectedVariance)})</span>
            </div>
          </div>
        </div>
      )}

      {/* Spend trend chart */}
      {last30.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">Daily Spend Trend (Last 30 days)</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Avg: {fmtCcy(totalSpend / Math.max(1, sorted.length))}/day</span>
          </div>
          <div className="card-body">
            <div style={{ height: 220 }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        </div>
      )}

      {/* Campaigns table */}
      {(account.campaigns || []).length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Campaigns ({account.campaigns.length})</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Campaign</th>
                  <th>Status</th>
                  <th>KPI</th>
                  <th style={{ textAlign: 'right' }}>Budget</th>
                  <th style={{ textAlign: 'center' }}>Ad Sets</th>
                </tr>
              </thead>
              <tbody>
                {account.campaigns.map(c => (
                  <tr key={c.id}>
                    <td style={{ paddingLeft: 24, fontWeight: 600 }}>{c.name}</td>
                    <td><span className={`badge ${c.status === 'Active' ? 'badge-success' : 'badge-info'}`}>{c.status}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.kpi || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{c.total_budget ? fmtCcy(c.total_budget) : '—'}</td>
                    <td style={{ textAlign: 'center' }}>{(c.ad_sets || []).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
