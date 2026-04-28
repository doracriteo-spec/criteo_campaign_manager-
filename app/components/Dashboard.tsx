'use client';

import { useState, useMemo } from 'react';
import { AnalysisNode, BulkAnalysisResult, CampaignContext } from '../../lib/analyzer';
import SpendChart from './SpendChart';
import ChatAssistant from './ChatAssistant';

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
  const [selectedNodeId, setSelectedNodeId] = useState<string>('executive_summary');
  
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

  const currentNode = useMemo(() => {
    if (selectedNodeId === 'executive_summary') return null;
    return allNodes.find(n => n.id === selectedNodeId) || allNodes[0];
  }, [allNodes, selectedNodeId]);

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
            borderLeft: isSelected ? '3px solid var(--brand-orange)' : '3px solid transparent',
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

  const renderExecutiveSummary = () => {
    const { total_accounts, total_spend, total_budget, total_impressions, total_conversions, total_rows } = analysis.summary;
    const overallPacing = total_budget > 0 ? (total_spend / total_budget) * 100 : 0;
    
    return (
      <div className="fade-in">
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 8 }}>Executive Summary</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
            Aggregated performance across {total_accounts} accounts • {total_rows.toLocaleString()} data points
          </p>
        </div>

        <div className="stats-grid" style={{ marginBottom: 32 }}>
          <div className="stat-card" style={{ borderTop: '4px solid var(--brand-orange)' }}>
            <div className="stat-label">Total Portfolio Spend</div>
            <div className="stat-value" style={{ fontSize: 36 }}>{config.currency}{total_spend.toLocaleString()}</div>
            <div className="stat-sub">Across all active accounts</div>
          </div>
          <div className="stat-card" style={{ borderTop: '4px solid #4ade80' }}>
            <div className="stat-label">Total Impressions</div>
            <div className="stat-value" style={{ fontSize: 36 }}>{total_impressions.toLocaleString()}</div>
            <div className="stat-sub">Aggregated visibility</div>
          </div>
          <div className="stat-card" style={{ borderTop: '4px solid #60a5fa' }}>
            <div className="stat-label">Total Conversions</div>
            <div className="stat-value" style={{ fontSize: 36 }}>{total_conversions.toLocaleString()}</div>
            <div className="stat-sub">Portfolio-wide success</div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 32 }}>
          <div className="card-header">
            <span className="card-title">Portfolio Budget Utilization</span>
            {total_budget > 0 && <span className="badge badge-info">{Math.round(overallPacing)}% Utilized</span>}
          </div>
          <div className="card-body">
            {total_budget > 0 ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 14 }}>Spend: {config.currency}{total_spend.toLocaleString()}</span>
                  <span style={{ fontSize: 14 }}>Budget: {config.currency}{total_budget.toLocaleString()}</span>
                </div>
                <div className="pacing-bar-bg" style={{ height: 16 }}>
                  <div className="pacing-bar-fill" style={{ width: `${Math.min(100, overallPacing)}%`, height: '100%' }} />
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                Set account or ad set budgets to visualize portfolio-wide utilization.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Account Breakdown</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Account Name</th>
                  <th style={{ textAlign: 'right' }}>Spend</th>
                  <th style={{ textAlign: 'right' }}>KPI Value</th>
                  <th style={{ textAlign: 'right', paddingRight: 24 }}>Pacing</th>
                </tr>
              </thead>
              <tbody>
                {analysis.nodes.map(node => (
                  <tr key={node.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedNodeId(node.id)}>
                    <td style={{ paddingLeft: 24, fontWeight: 600 }}>{node.name}</td>
                    <td style={{ textAlign: 'right' }}>{config.currency}{node.pacing.actual_spend.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{node.kpi_performance.kpi_value.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', paddingRight: 24 }}>
                      <span className={`badge ${node.pacing.has_budget ? (node.pacing.pacing_status.includes('Track') ? 'badge-success' : 'badge-warning') : 'badge-info'}`}>
                        {node.pacing.has_budget ? `${Math.round(node.pacing.pacing_ratio * 100)}%` : 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAccountDetail = () => {
    if (!currentNode) return null;
    const { pacing, kpi_performance, risks, pacing_recommendations, daily_data, health_summary, optimizer_type, name, level, row_count } = currentNode;
    const hasBudget = pacing.has_budget;
    const pacingClass = hasBudget ? (pacing.pacing_ratio > 1.1 ? 'overpacing' : pacing.pacing_ratio < 0.9 ? 'underpacing' : '') : '';
    const pacingBadge = !hasBudget
      ? 'badge-info'
      : pacing.pacing_status.includes('Under')
      ? 'badge-warning' : pacing.pacing_status.includes('Over')
      ? 'badge-danger' : 'badge-success';

    const trendIcon = kpi_performance.kpi_trend === 'Improving' ? '↑' : kpi_performance.kpi_trend === 'Declining' ? '↓' : '→';
    const trendBadge = kpi_performance.kpi_trend === 'Improving' ? 'badge-success' : kpi_performance.kpi_trend === 'Declining' ? 'badge-danger' : 'badge-info';

    // Calculate time elapsed vs spend percentage for the new Pacing Module
    const timeElapsedPct = pacing.total_days > 0 ? (pacing.elapsed_days / pacing.total_days) * 100 : 0;
    const spendPct = pacing.has_budget && pacing.expected_spend > 0 ? (pacing.actual_spend / (pacing.expected_spend / (pacing.elapsed_days / pacing.total_days))) * 100 : 0;

    return (
      <div className="fade-in">
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

        <div className="health-summary">
          <h2>📊 {level.charAt(0).toUpperCase() + level.slice(1)} Health Summary</h2>
          <p>{health_summary}</p>
        </div>

        <div className="stats-grid" style={{ marginBottom: 24 }}>
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

        {/* New Pacing Module */}
        <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(to right, var(--bg-card), var(--bg-primary))' }}>
          <div className="card-header">
            <span className="card-title">⚡ Intelligent Pacing Analysis</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Time vs. Budget Consumption</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                      <span>TIME ELAPSED</span>
                      <span>{Math.round(timeElapsedPct)}%</span>
                    </div>
                    <div className="pacing-bar-bg" style={{ height: 6 }}>
                      <div className="pacing-bar-fill" style={{ width: `${timeElapsedPct}%`, background: '#60a5fa', height: '100%' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                      <span>BUDGET SPENT</span>
                      <span>{Math.round(spendPct)}%</span>
                    </div>
                    <div className="pacing-bar-bg" style={{ height: 6 }}>
                      <div className={`pacing-bar-fill ${pacingClass}`} style={{ width: `${Math.min(100, spendPct)}%`, height: '100%' }} />
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 32 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Projection</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{config.currency}{pacing.projected_total_spend.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Estimated total spend by end of flight</div>
                {pacing.projected_underspend > 0 ? (
                  <div style={{ marginTop: 12, color: 'var(--warning)', fontSize: 13, fontWeight: 600 }}>
                    ⚠️ Potential underspend: {config.currency}{pacing.projected_underspend.toLocaleString()}
                  </div>
                ) : pacing.pacing_ratio > 1.1 ? (
                  <div style={{ marginTop: 12, color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>
                    ⚠️ Projected to exceed budget by {config.currency}{(pacing.projected_total_spend - (pacing.expected_spend / (pacing.elapsed_days / pacing.total_days))).toLocaleString()}
                  </div>
                ) : (
                  <div style={{ marginTop: 12, color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
                    ✓ Spend is aligned with current flight timeline.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="card">
            <div className="card-header"><span className="card-title">Daily Trend</span></div>
            <div className="card-body">
              <div className="chart-container">
                <SpendChart data={daily_data} currency={config.currency} kpiName={kpi_performance.kpi_name} />
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Metric Breakdown</span></div>
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

        {pacing_recommendations.length > 0 && (
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <span className="card-title">⚡ Strategy Recommendations</span>
              <span className="badge badge-info">{pacing_recommendations.length} total</span>
            </div>
            <div className="card-body">
              {pacing_recommendations.map((rec, i) => (
                <div className="rec-item" key={i}>
                  <div className="rec-number">{CATEGORY_ICONS[rec.category || 'general']}</div>
                  <div style={{ flex: 1 }}>
                    <div className="rec-action">{rec.action}</div>
                    <div className="rec-reason">{rec.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {risks.length > 0 && (
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header"><span className="card-title">⚠️ Identified Risks</span></div>
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
    );
  };

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <div className="fade-in" style={{ width: 280, flexShrink: 0, position: 'sticky', top: 80 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '16px 20px' }}>
            <span className="card-title" style={{ fontSize: 13 }}>Analytics Scope</span>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
            <div
              onClick={() => setSelectedNodeId('executive_summary')}
              style={{
                padding: '16px 20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderBottom: '2px solid var(--border)',
                background: selectedNodeId === 'executive_summary' ? 'var(--bg-card-hover)' : 'transparent',
                borderLeft: selectedNodeId === 'executive_summary' ? '4px solid var(--brand-orange)' : '4px solid transparent',
              }}
            >
              <div style={{ fontSize: 18 }}>📊</div>
              <div style={{ fontWeight: selectedNodeId === 'executive_summary' ? 800 : 600, fontSize: 13 }}>Executive Summary</div>
            </div>
            {analysis.nodes.map(node => renderSidebarNode(node))}
          </div>
        </div>
        <button className="btn btn-secondary" style={{ width: '100%', marginTop: 16, justifyContent: 'center' }} onClick={onReset}>
          ← New Analysis
        </button>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {selectedNodeId === 'executive_summary' ? renderExecutiveSummary() : renderAccountDetail()}
      </div>
      
      <ChatAssistant analysis={analysis} config={config} currentNode={currentNode || (allNodes[0] as any)} />
    </div>
  );
}
