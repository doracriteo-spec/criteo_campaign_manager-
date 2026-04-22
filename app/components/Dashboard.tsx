'use client';

import { useState } from 'react';
import { AnalysisResult, BulkAnalysisResult, CampaignContext } from '../../lib/analyzer';
import SpendChart from './SpendChart';

interface DashboardProps {
  analysis: BulkAnalysisResult;
  config: CampaignContext;
  csvFileName: string;
  onReset: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  pacing: '⚡',
  budget: '💰',
  targeting: '🎯',
  creative: '🎨',
  general: '📋',
};

export default function Dashboard({ analysis, config, csvFileName, onReset }: DashboardProps) {
  const [selectedAccountIndex, setSelectedAccountIndex] = useState(0);
  const isMultiAccount = analysis.results.length > 1;
  const currentAnalysis = analysis.results[selectedAccountIndex];

  const { pacing, kpi_performance, risks, recommendations, pacing_recommendations, daily_data, health_summary, optimizer_type, account_name, row_count, campaign_names } = currentAnalysis;

  const hasBudget = pacing.has_budget;
  const pacingClass = hasBudget ? (pacing.pacing_ratio > 1.1 ? 'overpacing' : pacing.pacing_ratio < 0.9 ? 'underpacing' : '') : '';
  const pacingBadge = !hasBudget
    ? 'badge-info'
    : pacing.pacing_status.includes('Under')
    ? 'badge-warning' : pacing.pacing_status.includes('Over')
    ? 'badge-danger' : 'badge-success';

  const trendIcon = kpi_performance.kpi_trend === 'Improving' ? '↑' : kpi_performance.kpi_trend === 'Declining' ? '↓' : '→';
  const trendBadge = kpi_performance.kpi_trend === 'Improving' ? 'badge-success' : kpi_performance.kpi_trend === 'Declining' ? 'badge-danger' : 'badge-info';

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* Sidebar — Advertiser List (only for multi-account) */}
      {isMultiAccount && (
        <div className="fade-in" style={{ width: 260, flexShrink: 0, position: 'sticky', top: 80 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-header" style={{ padding: '16px 20px' }}>
              <span className="card-title" style={{ fontSize: 13 }}>Advertisers ({analysis.summary.total_accounts})</span>
            </div>
            <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              {analysis.results.map((r, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedAccountIndex(i)}
                  style={{
                    padding: '14px 20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderBottom: '1px solid var(--border-light)',
                    background: i === selectedAccountIndex ? 'var(--bg-card-hover)' : 'transparent',
                    borderLeft: i === selectedAccountIndex ? '3px solid var(--criteo-orange)' : '3px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: `hsl(${(i * 47) % 360}, 65%, 55%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0
                  }}>
                    {r.account_name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{
                      fontWeight: i === selectedAccountIndex ? 700 : 500,
                      fontSize: 13,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: i === selectedAccountIndex ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}>
                      {r.account_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {r.row_count} rows • {config.currency}{r.pacing.actual_spend.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Summary Footer */}
            <div style={{ padding: '14px 20px', borderTop: '2px solid var(--border)', background: 'var(--bg-primary)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Total All Accounts</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{config.currency}{analysis.summary.total_spend.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{analysis.summary.total_rows} total rows</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{account_name}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
              {config.region && `${config.region} • `}{csvFileName} • {optimizer_type} • {row_count} rows
              {campaign_names.length > 0 && ` • ${campaign_names.length} campaign${campaign_names.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button className="btn btn-secondary" onClick={onReset}>← New Analysis</button>
        </div>

        {/* Health Summary */}
        <div className="health-summary fade-in">
          <h2>📊 Campaign Health Summary</h2>
          <p>{health_summary}</p>
        </div>

        {/* Campaign Names (if detected) */}
        {campaign_names.length > 0 && (
          <div className="fade-in" style={{ marginBottom: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {campaign_names.slice(0, 10).map((cn, i) => (
              <span key={i} className="badge badge-info" style={{ fontSize: 11, padding: '4px 10px' }}>{cn}</span>
            ))}
            {campaign_names.length > 10 && (
              <span className="badge" style={{ background: 'var(--border-light)', color: 'var(--text-muted)', fontSize: 11, padding: '4px 10px' }}>
                +{campaign_names.length - 10} more
              </span>
            )}
          </div>
        )}

        {/* Stat Cards */}
        <div className="stats-grid fade-in fade-in-delay-1">
          <div className="stat-card">
            <div className="stat-label">Total Spend</div>
            <div className="stat-value">{config.currency}{pacing.actual_spend.toLocaleString()}</div>
            <div className="stat-sub">
              {hasBudget
                ? `of ${config.currency}${config.total_budget.toLocaleString()} budget`
                : `${config.currency}${(pacing.elapsed_days > 0 ? pacing.actual_spend / pacing.elapsed_days : 0).toFixed(2)}/day avg`
              }
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pacing</div>
            <div className="stat-value">{hasBudget ? `${Math.round(pacing.pacing_ratio * 100)}%` : '—'}</div>
            <div className="stat-sub"><span className={`badge ${pacingBadge}`}>{pacing.pacing_status}</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{kpi_performance.kpi_name}</div>
            <div className="stat-value">{kpi_performance.kpi_value.toLocaleString()}</div>
            <div className="stat-sub"><span className={`badge ${trendBadge}`}>{trendIcon} {kpi_performance.kpi_trend}</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Data Points</div>
            <div className="stat-value">{pacing.total_days > 0 ? `${pacing.elapsed_days}/${pacing.total_days}` : row_count}</div>
            <div className="stat-sub">{pacing.remaining_days > 0 ? `${pacing.remaining_days} days remaining` : `${row_count} rows analyzed`}</div>
          </div>
        </div>

        {/* Pacing Bar (only if budget is set) */}
        {hasBudget && (
          <div className="card fade-in fade-in-delay-2" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title">Budget Pacing</span>
              <span className={`badge ${pacingBadge}`}>{pacing.pacing_status}</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <span>Actual: {config.currency}{pacing.actual_spend.toLocaleString()}</span>
                <span>Expected: {config.currency}{pacing.expected_spend.toLocaleString()}</span>
              </div>
              <div className="pacing-bar-bg">
                <div className={`pacing-bar-fill ${pacingClass}`} style={{ width: `${Math.min(100, pacing.pacing_ratio * 100)}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                <span>Projected Total: {config.currency}{pacing.projected_total_spend.toLocaleString()}</span>
                {pacing.projected_underspend > 0 && <span style={{ color: 'var(--warning)' }}>Projected Underspend: {config.currency}{pacing.projected_underspend.toLocaleString()}</span>}
              </div>
            </div>
          </div>
        )}

        {/* Charts + Secondary Metrics */}
        <div className="dashboard-grid fade-in fade-in-delay-3">
          <div className="card">
            <div className="card-header"><span className="card-title">Daily Spend & KPI Trend</span></div>
            <div className="card-body">
              <div className="chart-container">
                <SpendChart data={daily_data} currency={config.currency} kpiName={kpi_performance.kpi_name} />
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Performance Metrics</span></div>
            <div className="card-body">
              <table className="data-table">
                <thead>
                  <tr><th>Metric</th><th style={{ textAlign: 'right' }}>Value</th></tr>
                </thead>
                <tbody>
                  {Object.entries(kpi_performance.secondary_metrics).map(([key, val]) => (
                    <tr key={key}><td>{key}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{typeof val === 'number' ? val.toLocaleString() : val}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pacing Recommendations (NEW) */}
        {pacing_recommendations.length > 0 && (
          <div className="card fade-in fade-in-delay-3" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title">⚡ Pacing Optimization Recommendations</span>
              <span className="badge badge-info">{pacing_recommendations.length} suggestions</span>
            </div>
            <div className="card-body">
              {pacing_recommendations.map((rec, i) => (
                <div className="rec-item" key={i}>
                  <div className="rec-number" style={{ fontSize: 16 }}>
                    {CATEGORY_ICONS[rec.category || 'general']}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <div className="rec-action">{rec.action}</div>
                    </div>
                    <div className="rec-reason">{rec.reason}</div>
                    <div className="rec-impact" style={{ display: 'flex', gap: 8 }}>
                      <span className={`badge ${rec.impact === 'High' ? 'badge-danger' : rec.impact === 'Medium' ? 'badge-warning' : 'badge-info'}`}>
                        {rec.impact} Impact
                      </span>
                      {rec.category && (
                        <span className="badge" style={{ background: 'var(--border-light)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {rec.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risks + General Recommendations */}
        <div className="dashboard-grid fade-in fade-in-delay-4">
          <div className="card">
            <div className="card-header"><span className="card-title">⚠️ Key Risks</span></div>
            <div className="card-body">
              {risks.map((risk, i) => (
                <div className="risk-item" key={i}>
                  <div className={`risk-dot ${risk.severity}`} />
                  <div>
                    <div className="risk-title">{risk.title}</div>
                    <div className="risk-desc">{risk.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">🎯 Recommended Actions</span></div>
            <div className="card-body">
              {recommendations.map((rec, i) => (
                <div className="rec-item" key={i}>
                  <div className="rec-number">{rec.priority}</div>
                  <div>
                    <div className="rec-action">{rec.action}</div>
                    <div className="rec-reason">{rec.reason}</div>
                    <div className="rec-impact">
                      <span className={`badge ${rec.impact === 'High' ? 'badge-danger' : rec.impact === 'Medium' ? 'badge-warning' : 'badge-info'}`}>
                        {rec.impact} Impact
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
