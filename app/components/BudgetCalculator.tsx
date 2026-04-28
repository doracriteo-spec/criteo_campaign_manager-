'use client';

import { useState, useEffect } from 'react';

interface BudgetCalculatorProps {
  currency: string;
  initialData?: {
    totalBudget?: number;
    currentSpend?: number;
    startDate?: string;
    endDate?: string;
    name?: string;
  };
  onApply?: (newDailyBudget: number) => void;
}

export default function BudgetCalculator({ currency, initialData, onApply }: BudgetCalculatorProps) {
  // Static Calculator State
  const [monthlyBudget, setMonthlyBudget] = useState<number>(initialData?.totalBudget || 0);
  
  // Dynamic Advisor State
  const [flightBudget, setFlightBudget] = useState<number>(initialData?.totalBudget || 0);
  const [currentSpend, setCurrentSpend] = useState<number>(initialData?.currentSpend || 0);
  const [startDate, setStartDate] = useState<string>(initialData?.startDate || '');
  const [endDate, setEndDate] = useState<string>(initialData?.endDate || '');

  // Derived Values - Static
  const weeklyBudget = monthlyBudget / 4.33;
  const dailyBudgetStatic = monthlyBudget / 30.42;

  // Derived Values - Dynamic
  const [analysis, setAnalysis] = useState<{
    remainingBudget: number;
    daysLeft: number;
    requiredDaily: number;
    pacingStatus: string;
    idealSpend: number;
    pacingPct: number;
  } | null>(null);

  useEffect(() => {
    if (!startDate || !endDate || flightBudget <= 0) {
      setAnalysis(null);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(0, Math.min(totalDays, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))));
    const daysLeft = Math.max(1, totalDays - elapsedDays);
    
    const remainingBudget = flightBudget - currentSpend;
    const requiredDaily = remainingBudget / daysLeft;
    
    const timeElapsedPct = elapsedDays / totalDays;
    const idealSpend = flightBudget * timeElapsedPct;
    const pacingPct = idealSpend > 0 ? (currentSpend / idealSpend) * 100 : 0;
    
    let pacingStatus = 'On Track';
    if (pacingPct < 85) pacingStatus = 'Underspending';
    else if (pacingPct > 115) pacingStatus = 'Overspending';

    setAnalysis({
      remainingBudget,
      daysLeft,
      requiredDaily,
      pacingStatus,
      idealSpend,
      pacingPct
    });
  }, [flightBudget, currentSpend, startDate, endDate]);

  return (
    <div className="card fade-in" style={{ height: '100%' }}>
      <div className="card-header">
        <span className="card-title">💰 Smart Budget & Pacing Advisor</span>
        {initialData?.name && <span className="badge badge-info">{initialData.name}</span>}
      </div>
      <div className="card-body">
        {/* Section 1: Static Calculator */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, textTransform: 'uppercase', color: 'var(--text-muted)' }}>1. Planning Calculator</h3>
          <div className="form-group">
            <label className="form-label">Total Monthly Budget</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>{currency}</span>
              <input 
                type="number" 
                className="form-input" 
                style={{ paddingLeft: 28 }}
                value={monthlyBudget || ''} 
                onChange={(e) => setMonthlyBudget(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div style={{ padding: 16, background: 'var(--bg-primary)', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>WEEKLY CAP</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{currency}{weeklyBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div style={{ padding: 16, background: 'var(--bg-primary)', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>DAILY CAP</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{currency}{dailyBudgetStatic.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>

        {/* Section 2: Dynamic Advisor */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, textTransform: 'uppercase', color: 'var(--text-muted)' }}>2. Campaign Recovery Advisor</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: 11 }}>Flight Start</label>
              <input type="date" className="form-input" style={{ fontSize: 12 }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: 11 }}>Flight End</label>
              <input type="date" className="form-input" style={{ fontSize: 12 }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: 11 }}>Total Budget</label>
              <input type="number" className="form-input" style={{ fontSize: 12 }} value={flightBudget || ''} onChange={(e) => setFlightBudget(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: 11 }}>Spend to Date</label>
              <input type="number" className="form-input" style={{ fontSize: 12 }} value={currentSpend || ''} onChange={(e) => setCurrentSpend(parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          {analysis ? (
            <div className="fade-in" style={{ padding: 20, background: 'var(--bg-card-hover)', borderRadius: 16, border: '1px dashed var(--brand-orange)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>PACING STATUS</div>
                <span className={`badge ${analysis.pacingStatus === 'On Track' ? 'badge-success' : 'badge-warning'}`}>{analysis.pacingStatus}</span>
              </div>
              
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>IDEAL SPEND: {currency}{analysis.idealSpend.toLocaleString()}</span>
                  <span>{Math.round(analysis.pacingPct)}% of ideal</span>
                </div>
                <div className="pacing-bar-bg" style={{ height: 6 }}>
                  <div className="pacing-bar-fill" style={{ width: `${Math.min(100, analysis.pacingPct)}%`, height: '100%', background: analysis.pacingStatus === 'On Track' ? '#4ade80' : 'var(--brand-orange)' }} />
                </div>
              </div>

              <div style={{ textAlign: 'center', padding: '16px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>RECOMMENDED RECOVERY DAILY BUDGET</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--brand-orange)' }}>
                  {currency}{analysis.requiredDaily.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>To exhaust {currency}{analysis.remainingBudget.toLocaleString()} over {analysis.daysLeft} days</div>
                
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
                  onClick={() => onApply?.(analysis.requiredDaily)}
                >
                  Apply Recommendation
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', background: 'var(--bg-primary)', borderRadius: 16, fontSize: 13 }}>
              Enter flight dates and budget to see recovery recommendations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
