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

export default function Dashboard({ analysis, config, csvFileName, onReset }: DashboardProps) {
  const [selectedAccountIndex, setSelectedAccountIndex] = useState(0);
  const currentAnalysis = analysis.results[selectedAccountIndex];
  
  const { pacing, kpi_performance, risks, recommendations, daily_data, health_summary, optimizer_type, account_name } = currentAnalysis;

  const pacingClass = pacing.pacing_ratio > 1.1 ? 'overpacing' : pacing.pacing_ratio < 0.9 ? 'underpacing' : '';
  const pacingBadge = pacing.pacing_status.includes('Under')
    ? 'badge-warning' : pacing.pacing_status.includes('Over')
    ? 'badge-danger' : 'badge-success';

  const trendIcon = kpi_performance.kpi_trend === 'Improving' ? '↑' : kpi_performance.kpi_trend === 'Declining' ? '↓' : '→';
  const trendBadge = kpi_performance.kpi_trend === 'Improving' ? 'badge-success' : kpi_performance.kpi_trend === 'Declining' ? 'badge-danger' : 'badge-info';

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>
            {analysis.results.length > 1 ? (
              <select 
                className="form-select" 
                style={{ fontSize: 24, fontWeight: 800, border: 'none', padding: 0, background: 'transparent', width: 'auto', cursor: 'pointer' }}
                value={selectedAccountIndex}
                onChange={(e) => setSelectedAccountIndex(parseInt(e.target.value))}
              >
                {analysis.results.map((r, i) => (
                  <option key={i} value={i}>{r.account_name}</option>
                ))}
              </select>
            ) : account_name}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
            {config.region} • {csvFileName} • {optimizer_type} 
            {analysis.results.length > 1 && ` • Account ${selectedAccountIndex + 1} of ${analysis.results.length}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {analysis.results.length > 1 && (
            <div className="badge badge-info" style={{ alignSelf: 'center', padding: '8px 12px' }}>
              Bulk Mode: {analysis.summary.total_accounts} Accounts
            </div>
          )}
          <button className="btn btn-secondary" onClick={onReset}>← New Analysis</button>
        </div>
      </div>

      {/* Health Summary */}
      <div className="health-summary fade-in">
        <h2>📊 Campaign Health Summary</h2>
        <p>{health_summary}</p>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid fade-in fade-in-delay-1">
        <div className="stat-card">
          <div className="stat-label">Total Spend</div>
          <div className="stat-value">{config.currency}{pacing.actual_spend.toLocaleString()}</div>
          <div className="stat-sub">of {config.currency}{config.total_budget.toLocaleString()} budget</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pacing</div>
          <div className="stat-value">{Math.round(pacing.pacing_ratio * 100)}%</div>
          <div className="stat-sub"><span className={`badge ${pacingBadge}`}>{pacing.pacing_status}</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{kpi_performance.kpi_name}</div>
          <div className="stat-value">{kpi_performance.kpi_value.toLocaleString()}</div>
          <div className="stat-sub"><span className={`badge ${trendBadge}`}>{trendIcon} {kpi_performance.kpi_trend}</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Flight Progress</div>
          <div className="stat-value">{pacing.elapsed_days}/{pacing.total_days}</div>
          <div className="stat-sub">{pacing.remaining_days} days remaining</div>
        </div>
      </div>

      {/* Pacing Bar */}
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
          <div className="card-header"><span className="card-title">Secondary Metrics</span></div>
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

      {/* Risks + Recommendations */}
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
  );
}
