'use client';

import { useState, useMemo } from 'react';
import { AnalysisNode, BulkAnalysisResult, CampaignContext } from '../../lib/analyzer';
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
  // Flat list of all nodes for easy selection
  const allNodes = useMemo(() => {
    const list: AnalysisNode[] = [];
    const traverse = (nodes: AnalysisNode[]) => {
      nodes.forEach(node => {
        list.push(node);
        if (node.children) traverse(node.children);
      });
    };
    traverse(analysis.nodes);
    return list;
  }, [analysis.nodes]);

  const [selectedNodeId, setSelectedNodeId] = useState<string>(allNodes[0]?.id || '');
  
  const currentNode = useMemo(() => {
    return allNodes.find(n => n.id === selectedNodeId) || allNodes[0];
  }, [allNodes, selectedNodeId]);

  if (!currentNode) return null;

  const { pacing, kpi_performance, risks, recommendations, pacing_recommendations, daily_data, health_summary, optimizer_type, name, level, row_count } = currentNode;

  const hasBudget = pacing.has_budget;
  const pacingClass = hasBudget ? (pacing.pacing_ratio > 1.1 ? 'overpacing' : pacing.pacing_ratio < 0.9 ? 'underpacing' : '') : '';
  const pacingBadge = !hasBudget
    ? 'badge-info'
    : pacing.pacing_status.includes('Under')
    ? 'badge-warning' : pacing.pacing_status.includes('Over')
    ? 'badge-danger' : 'badge-success';

  const trendIcon = kpi_performance.kpi_trend === 'Improving' ? '↑' : kpi_performance.kpi_trend === 'Declining' ? '↓' : '→';
  const trendBadge = kpi_performance.kpi_trend === 'Improving' ? 'badge-success' : kpi_performance.kpi_trend === 'Declining' ? 'badge-danger' : 'badge-info';

  const renderSidebarNode = (node: AnalysisNode, depth: number = 0) => {
    const isSelected = node.id === selectedNodeId;
    return (
      <div key={node.id}>
        <div
          onClick={() => setSelectedNodeId(node.id)}
          style={{
            padding: `12px 16px 12px ${16 + depth * 16}px`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--border-light)',
            background: isSelected ? 'var(--bg-card-hover)' : 'transparent',
            borderLeft: isSelected ? '3px solid var(--criteo-orange)' : '3px solid transparent',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ fontSize: 14, flexShrink: 0 }}>
            {node.level === 'advertiser' ? '🏢' : node.level === 'campaign' ? '📦' : '🎯'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontWeight: isSelected ? 700 : 500,
              fontSize: 12,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}>
              {node.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {config.currency}{node.pacing.actual_spend.toLocaleString()}
            </div>
          </div>
        </div>
        {node.children && node.children.map(child => renderSidebarNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* Sidebar — Hierarchy View */}
      <div className="fade-in" style={{ width: 280, flexShrink: 0, position: 'sticky', top: 80 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '16px 20px' }}>
            <span className="card-title" style={{ fontSize: 13 }}>Hierarchy View</span>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
            {analysis.nodes.map(node => renderSidebarNode(node))}
          </div>
          <div style={{ padding: '14px 20px', borderTop: '2px solid var(--border)', background: 'var(--bg-primary)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Portfolio Total</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{config.currency}{analysis.summary.total_spend.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{analysis.summary.total_rows} total rows</div>
          </div>
        </div>
        <button className="btn btn-secondary" style={{ width: '100%', marginTop: 16, justifyContent: 'center' }} onClick={onReset}>
          ← New Analysis
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, gap: 16 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: 10 }}>{level}</span>
                {currentNode.parent_name && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>under {currentNode.parent_name}</span>}
             </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{name}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
              {csvFileName} • {optimizer_type} • {row_count} rows
            </p>
          </div>
        </div>

        {/* Health Summary */}
        <div className="health-summary fade-in">
          <h2>📊 {level.charAt(0).toUpperCase() + level.slice(1)} Health Summary</h2>
          <p>{health_summary}</p>
        </div>

        {/* Stat Cards */}
        <div className="stats-grid fade-in fade-in-delay-1">
          <div className="stat-card">
            <div className="stat-label">Total Spend</div>
            <div className="stat-value">{config.currency}{pacing.actual_spend.toLocaleString()}</div>
            <div className="stat-sub">
              {hasBudget
                ? `of ${config.currency}${pacing.expected_spend.toLocaleString()} expected`
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
            <div className="stat-label">Timeline</div>
            <div className="stat-value">{pacing.total_days > 0 ? `${pacing.elapsed_days}/${pacing.total_days}` : '—'}</div>
            <div className="stat-sub">{pacing.remaining_days > 0 ? `${pacing.remaining_days} days left` : 'Flight period ended'}</div>
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

        {/* Optimization Recommendations */}
        {pacing_recommendations.length > 0 && (
          <div className="card fade-in fade-in-delay-3" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title">⚡ {level.charAt(0).toUpperCase() + level.slice(1)} Optimization Recommendations</span>
              <span className="badge badge-info">{pacing_recommendations.length} suggestions</span>
            </div>
            <div className="card-body">
              {pacing_recommendations.map((rec, i) => (
                <div className="rec-item" key={i}>
                  <div className="rec-number" style={{ fontSize: 16 }}>
                    {CATEGORY_ICONS[rec.category || 'general']}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="rec-action">{rec.action}</div>
                    <div className="rec-reason">{rec.reason}</div>
                    <div className="rec-impact" style={{ display: 'flex', gap: 8, marginTop: 6 }}>
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

        {/* Risks */}
        {risks.length > 0 && (
          <div className="card fade-in fade-in-delay-4">
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
        )}
      </div>
    </div>
  );
}
