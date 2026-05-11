'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../../../lib/supabase';
import { authFetch } from '../../../../../lib/auth-fetch';
import { calculatePacing, getPacingColor } from '../../../../../lib/analytics';
import { Line } from 'react-chartjs-2';
import ChangeLogPanel, { createLogEntry, useChangeLog } from '@/app/components/ChangeLogPanel';
import BudgetGoalsPanel, { BudgetGoals, makeDefaultGoals } from '@/app/components/BudgetGoalsPanel';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface DailyMetric {
  spend: number; budget: number; date: string;
  clicks: number; impressions: number; conversions: number; revenue: number; visits: number;
}

interface Campaign {
  id: string; name: string; status: string; kpi: string;
  total_budget: number; start_date: string; end_date: string;
  ad_sets: Array<{ id: string; name: string; budget: number; status: string }>;
}

interface AccountData {
  id: string; name: string; global_account: string; market: string;
  owner_as: string; currency: string; kpi_target: number; kpi_metric: string;
  goals: string; notes: string;
  campaigns: Campaign[];
  account_notes: Array<{ id: string; content: string; type: string; status: string }>;
  daily_metrics: DailyMetric[];
}

const GOALS_KEY = (id: string) => `budget_goals_${id}`;

function loadSavedGoals(accountId: string): BudgetGoals | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GOALS_KEY(accountId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveGoalsToStorage(accountId: string, goals: BudgetGoals) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GOALS_KEY(accountId), JSON.stringify(goals));
}

export default function AccountDashboard() {
  const router = useRouter();
  const params = useParams();
  const { portfolioId, accountId } = params as { portfolioId: string; accountId: string };

  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<BudgetGoals>(makeDefaultGoals());
  const { saveEntry } = useChangeLog(accountId);

  const fetchAccount = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/login'); return; }
    const res = await authFetch(`/api/accounts/${accountId}`);
    if (res.ok) {
      const data = await res.json();
      setAccount(data);
      // Load saved goals or build defaults from account data
      const saved = loadSavedGoals(accountId);
      if (saved) {
        setGoals(saved);
      } else {
        setGoals(prev => ({
          ...prev,
          currency: data.currency || 'USD',
          totalBudget: data.kpi_target || 0,
        }));
      }
    } else {
      router.replace(`/portfolios/${portfolioId}`);
    }
    setLoading(false);
  }, [accountId, portfolioId, router]);

  useEffect(() => { fetchAccount(); }, [fetchAccount]);

  // ── Derived metrics from CSV data ────────────────────────────────────────
  const metrics = account?.daily_metrics || [];
  const totalSpend = metrics.reduce((s, m) => s + (m.spend || 0), 0);
  const totalClicks = metrics.reduce((s, m) => s + (m.clicks || 0), 0);
  const totalImpressions = metrics.reduce((s, m) => s + (m.impressions || 0), 0);
  const totalConversions = metrics.reduce((s, m) => s + (m.conversions || 0), 0);
  const totalRevenue = metrics.reduce((s, m) => s + (m.revenue || 0), 0);

  // ── Pacing: use goals.totalBudget if set, else fall back to CSV budget ──
  const csvBudget = metrics.reduce((s, m) => s + (m.budget || 0), 0);
  const activeBudget = goals.totalBudget > 0 ? goals.totalBudget : csvBudget;

  const sorted = useMemo(() => [...metrics].sort((a, b) => a.date.localeCompare(b.date)), [metrics]);
  const startDate = goals.startDate || sorted[0]?.date || '';
  const endDate = goals.endDate || sorted[sorted.length - 1]?.date || '';
  const pacing = calculatePacing(activeBudget, totalSpend, startDate, endDate);
  const colorKey = getPacingColor(pacing.status);

  const ccy = goals.currency === 'EUR' ? '€' : goals.currency === 'GBP' ? '£' : '$';
  const fmt = (n: number) => `${ccy}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpo = totalConversions > 0 ? totalSpend / totalConversions : 0;

  // ── KPI actuals map for comparison ───────────────────────────────────────
  const actuals: Record<string, { value: number; unit: string }> = {
    'Target CTR':         { value: ctr, unit: '%' },
    'Target CPC':         { value: totalClicks > 0 ? totalSpend / totalClicks : 0, unit: ccy },
    'Target CPA':         { value: cpo, unit: ccy },
    'Target ROAS':        { value: roas, unit: 'x' },
    'Target Conversions': { value: totalConversions, unit: '' },
    'Target Visits':      { value: metrics.reduce((s, m) => s + (m.visits || 0), 0), unit: '' },
  };

  // ── Chart ─────────────────────────────────────────────────────────────────
  const last30 = sorted.slice(-30);
  const chartData = {
    labels: last30.map(m => { const d = new Date(m.date); return `${d.getMonth()+1}/${d.getDate()}`; }),
    datasets: [
      {
        label: 'Daily Spend',
        data: last30.map(m => m.spend),
        borderColor: 'rgba(244,129,32,0.9)',
        backgroundColor: 'rgba(244,129,32,0.08)',
        fill: true, tension: 0.4, pointRadius: 2,
      },
      ...(activeBudget > 0 && pacing.totalDays > 0 ? [{
        label: 'Daily Budget Target',
        data: last30.map(() => activeBudget / pacing.totalDays),
        borderColor: 'rgba(99,102,241,0.6)',
        borderDash: [5, 5],
        backgroundColor: 'transparent',
        fill: false, tension: 0, pointRadius: 0,
      }] : []),
    ],
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'top' as const } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: 'rgba(0,0,0,0.04)' } },
    },
  };

  const handleGoalsSave = (newGoals: BudgetGoals) => {
    setGoals(newGoals);
    saveGoalsToStorage(accountId, newGoals);
    saveEntry(createLogEntry(
      'kpi_update',
      `Budget & Goals updated — ${account?.name || 'Account'}`,
      `Budget set to ${newGoals.currency} ${newGoals.totalBudget.toLocaleString()}. Flight: ${newGoals.startDate || 'N/A'} → ${newGoals.endDate || 'N/A'}.`,
      { Budget: `${newGoals.currency} ${newGoals.totalBudget.toLocaleString()}` }
    ));
  };

  if (loading) return (
    <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="loading-spinner" />
    </main>
  );
  if (!account) return null;

  const activeKpiGoals = goals.kpiGoals.filter(k => k.target > 0);

  return (
    <main className="main-content fade-in">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          <button onClick={() => router.push('/portfolios')} className="breadcrumb-btn">Portfolios</button>
          <span>/</span>
          <button onClick={() => router.push(`/portfolios/${portfolioId}`)} className="breadcrumb-btn">Portfolio</button>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{account.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

      {/* Budget & Goals Editor */}
      <BudgetGoalsPanel initialGoals={goals} onSave={handleGoalsSave} />

      {/* Pacing KPI cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ borderTop: '4px solid var(--brand-orange)' }}>
          <div className="stat-label">Total Spend</div>
          <div className="stat-value">{fmt(totalSpend)}</div>
          <div className="stat-sub">{activeBudget > 0 ? `of ${fmt(activeBudget)} budget` : 'No budget set'}</div>
        </div>
        <div className="stat-card" style={{ borderTop: `4px solid var(--${colorKey})` }}>
          <div className="stat-label">Pacing Status</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{pacing.status}</div>
          <div className="stat-sub">{activeBudget > 0 ? `${(pacing.ratio * 100).toFixed(1)}% of expected` : 'Set a budget above'}</div>
        </div>
        <div className="stat-card" style={{ borderTop: '4px solid #60a5fa' }}>
          <div className="stat-label">Daily Budget Required</div>
          <div className="stat-value">{activeBudget > 0 ? fmt(pacing.dailyBudgetRequired) : '—'}</div>
          <div className="stat-sub">{pacing.remainingDays} days remaining</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Projected Spend</div>
          <div className="stat-value">{pacing.totalDays > 0 ? fmt(pacing.projectedSpend) : '—'}</div>
          <div className="stat-sub" style={{ color: pacing.projectedVariance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {activeBudget > 0 ? `${pacing.projectedVariance >= 0 ? '+' : ''}${fmt(pacing.projectedVariance)} vs budget` : 'Set dates & budget'}
          </div>
        </div>
      </div>

      {/* Budget utilization bar */}
      {activeBudget > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">Budget Utilization</span>
            <span className={`badge badge-${colorKey}`}>{pacing.status}</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
              <span>Spent: <strong>{fmt(totalSpend)}</strong></span>
              <span>Remaining: <strong>{fmt(activeBudget - totalSpend)}</strong></span>
              <span>Budget: <strong>{fmt(activeBudget)}</strong></span>
            </div>
            <div className="pacing-bar-bg" style={{ height: 14 }}>
              <div
                className={`pacing-bar-fill ${pacing.status.toLowerCase().includes('over') ? 'overpacing' : pacing.status.toLowerCase().includes('under') ? 'underpacing' : ''}`}
                style={{ width: `${Math.min(100, (totalSpend / activeBudget) * 100)}%`, height: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              <span>Day {pacing.elapsedDays} of {pacing.totalDays}</span>
              <span>{((totalSpend / activeBudget) * 100).toFixed(1)}% utilized</span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Goals vs Actuals */}
      {activeKpiGoals.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">🎯 KPI Goals vs Actuals</span>
            <span className="badge badge-info">{activeKpiGoals.length} targets set</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Metric</th>
                  <th style={{ textAlign: 'right' }}>Target</th>
                  <th style={{ textAlign: 'right' }}>Actual</th>
                  <th style={{ textAlign: 'right', paddingRight: 24 }}>vs Goal</th>
                </tr>
              </thead>
              <tbody>
                {activeKpiGoals.map(kpi => {
                  const actual = actuals[kpi.metric];
                  if (!actual) return null;
                  const diff = actual.value - kpi.target;
                  const diffPct = kpi.target > 0 ? (diff / kpi.target) * 100 : 0;
                  // For cost metrics (CPC, CPA), lower is better
                  const lowerIsBetter = kpi.metric.includes('CPC') || kpi.metric.includes('CPA');
                  const isGood = lowerIsBetter ? diff <= 0 : diff >= 0;
                  return (
                    <tr key={kpi.metric}>
                      <td style={{ paddingLeft: 24, fontWeight: 600 }}>{kpi.metric}</td>
                      <td style={{ textAlign: 'right' }}>{kpi.unit}{kpi.target.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{kpi.unit}{actual.value.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', paddingRight: 24 }}>
                        <span className={`badge ${isGood ? 'badge-success' : 'badge-danger'}`}>
                          {diff >= 0 ? '+' : ''}{diffPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Secondary metrics */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">ROAS</div>
          <div className="stat-value">{roas.toFixed(2)}x</div>
          <div className="stat-sub">{fmt(totalRevenue)} revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Conversions</div>
          <div className="stat-value">{totalConversions.toLocaleString()}</div>
          <div className="stat-sub">CPA: {fmt(cpo)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Clicks</div>
          <div className="stat-value">{totalClicks.toLocaleString()}</div>
          <div className="stat-sub">CTR: {ctr.toFixed(2)}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Impressions</div>
          <div className="stat-value">{totalImpressions.toLocaleString()}</div>
          <div className="stat-sub">CPC: {totalClicks > 0 ? fmt(totalSpend / totalClicks) : '—'}</div>
        </div>
      </div>

      {/* Spend trend chart */}
      {last30.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">Daily Spend Trend</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Avg: {fmt(totalSpend / Math.max(1, sorted.length))}/day
              {activeBudget > 0 && pacing.totalDays > 0 && ` · Target: ${fmt(activeBudget / pacing.totalDays)}/day`}
            </span>
          </div>
          <div className="card-body">
            <div style={{ height: 240 }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        </div>
      )}

      {/* Campaigns table */}
      {(account.campaigns || []).length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header"><span className="card-title">Campaigns ({account.campaigns.length})</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Campaign</th>
                  <th>Status</th><th>KPI</th>
                  <th style={{ textAlign: 'right' }}>Budget</th>
                  <th style={{ textAlign: 'center' }}>Ad Sets</th>
                </tr>
              </thead>
              <tbody>
                {account.campaigns.map(c => (
                  <tr key={c.id}>
                    <td style={{ paddingLeft: 24, fontWeight: 600 }}>{c.name}</td>
                    <td><span className={`badge ${c.status === 'Active' ? 'badge-success' : 'badge-info'}`}>{c.status || '—'}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.kpi || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{c.total_budget ? fmt(c.total_budget) : '—'}</td>
                    <td style={{ textAlign: 'center' }}>{(c.ad_sets || []).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Change Log */}
      <ChangeLogPanel accountId={accountId} entityName={account.name} />
    </main>
  );
}
