'use client';

import { useState } from 'react';
import { Target, Save, RotateCcw } from 'lucide-react';

export interface BudgetGoals {
  totalBudget: number;
  currency: string;
  startDate: string;
  endDate: string;
  kpiGoals: { metric: string; target: number; unit: string }[];
}

interface Props {
  initialGoals: BudgetGoals;
  onSave: (goals: BudgetGoals) => void;
}

const DEFAULT_KPIS = [
  { metric: 'Target CTR', target: 0, unit: '%' },
  { metric: 'Target CPC', target: 0, unit: '$' },
  { metric: 'Target CPA', target: 0, unit: '$' },
  { metric: 'Target ROAS', target: 0, unit: 'x' },
  { metric: 'Target Conversions', target: 0, unit: '' },
  { metric: 'Target Visits', target: 0, unit: '' },
];

export function makeDefaultGoals(): BudgetGoals {
  return {
    totalBudget: 0,
    currency: 'USD',
    startDate: '',
    endDate: '',
    kpiGoals: DEFAULT_KPIS.map(k => ({ ...k })),
  };
}

export default function BudgetGoalsPanel({ initialGoals, onSave }: Props) {
  const [goals, setGoals] = useState<BudgetGoals>(initialGoals);
  const [saved, setSaved] = useState(false);

  const updateKpi = (i: number, val: string) => {
    const updated = goals.kpiGoals.map((k, idx) =>
      idx === i ? { ...k, target: parseFloat(val) || 0 } : k
    );
    setGoals(g => ({ ...g, kpiGoals: updated }));
    setSaved(false);
  };

  const handleSave = () => {
    onSave(goals);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setGoals(makeDefaultGoals());
    setSaved(false);
  };

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--brand-orange), var(--brand-orange-dark))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Target size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Monthly Budget & KPI Goals</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Set targets to compare against actual performance</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleReset}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            <RotateCcw size={12} /> Reset
          </button>
          <button
            onClick={handleSave}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 16px', borderRadius: 8, border: 'none',
              background: saved ? 'var(--success)' : 'linear-gradient(135deg, var(--brand-orange), var(--brand-orange-dark))',
              color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(244,129,32,0.3)', transition: 'background 0.3s',
            }}
          >
            <Save size={12} /> {saved ? '✓ Saved!' : 'Apply & Recalculate'}
          </button>
        </div>
      </div>

      <div className="card-body">
        {/* Budget row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 12, alignItems: 'end', marginBottom: 24 }}>
          <div className="form-group">
            <label className="form-label">Currency</label>
            <select
              className="form-select"
              value={goals.currency}
              onChange={e => { setGoals(g => ({ ...g, currency: e.target.value })); setSaved(false); }}
              style={{ width: 90 }}
            >
              <option>USD</option><option>EUR</option><option>GBP</option><option>SGD</option><option>IDR</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Total Monthly Budget</label>
            <input
              type="number" className="form-input" placeholder="e.g. 50000" min="0"
              value={goals.totalBudget || ''}
              onChange={e => { setGoals(g => ({ ...g, totalBudget: parseFloat(e.target.value) || 0 })); setSaved(false); }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Flight Start</label>
            <input type="date" className="form-input" value={goals.startDate}
              onChange={e => { setGoals(g => ({ ...g, startDate: e.target.value })); setSaved(false); }} />
          </div>
          <div className="form-group">
            <label className="form-label">Flight End</label>
            <input type="date" className="form-input" value={goals.endDate}
              onChange={e => { setGoals(g => ({ ...g, endDate: e.target.value })); setSaved(false); }} />
          </div>
        </div>

        {/* KPI Goals grid */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            🎯 KPI Targets
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {goals.kpiGoals.map((kpi, i) => (
              <div key={kpi.metric} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 10,
                border: `1px solid ${kpi.target > 0 ? 'rgba(244,129,32,0.3)' : 'var(--border)'}`,
                background: kpi.target > 0 ? 'rgba(244,129,32,0.03)' : 'var(--bg-card)',
                transition: 'all 0.2s',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{kpi.metric}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {kpi.unit && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{kpi.unit}</span>}
                    <input
                      type="number" min="0"
                      placeholder="Target"
                      value={kpi.target || ''}
                      onChange={e => updateKpi(i, e.target.value)}
                      style={{
                        flex: 1, padding: '5px 8px', borderRadius: 6,
                        border: '1px solid var(--border)', fontSize: 13,
                        fontFamily: 'inherit', outline: 'none', background: '#fff',
                      }}
                      onFocus={e => (e.target.style.borderColor = 'var(--brand-orange)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                    />
                  </div>
                </div>
                {kpi.target > 0 && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
