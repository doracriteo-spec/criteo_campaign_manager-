'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../../../../lib/supabase';
import { calculatePacing, getPacingColor } from '../../../../../../lib/analytics';

interface AdSet {
  id: string;
  name: string;
  status: string;
  budget: number;
  start_date: string;
  end_date: string;
  campaign: { name: string };
  daily_metrics: Array<{ spend: number; date: string }>;
}

export default function AdSetsPage() {
  const router = useRouter();
  const params = useParams();
  const { portfolioId, accountId } = params as { portfolioId: string; accountId: string };

  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/login'); return; }

    const { data, error } = await supabase
      .from('ad_sets')
      .select(`
        *,
        campaign:campaigns(name),
        daily_metrics(spend, date)
      `)
      .eq('account_id', accountId)
      .eq('user_id', session.user.id);

    if (data) setAdSets(data as any);
    setLoading(false);
  }, [accountId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = adSets.filter(as => as.name.toLowerCase().includes(filter.toLowerCase()));

  if (loading) return <div className="main-content"><div className="loading-spinner" /></div>;

  return (
    <main className="main-content fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>Ad Sets & Pacing</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Dense performance and budget tracking at the ad set level.</p>
        </div>
        <input 
          className="form-input" 
          placeholder="Filter ad sets..." 
          value={filter} 
          onChange={e => setFilter(e.target.value)} 
          style={{ width: 240 }}
        />
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 20 }}>Ad Set Name</th>
              <th>Campaign</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Budget</th>
              <th style={{ textAlign: 'right' }}>Total Spend</th>
              <th style={{ textAlign: 'center' }}>Pacing</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'center' }}>Flight</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(as => {
              const totalSpend = (as.daily_metrics || []).reduce((sum, m) => sum + (m.spend || 0), 0);
              const pacing = calculatePacing(as.budget, totalSpend, as.start_date, as.end_date);
              const colorKey = getPacingColor(pacing.status);
              const statusClass = pacing.status === 'On Track' ? 'on-track' : pacing.status.includes('Under') ? 'under' : 'over';

              return (
                <tr key={as.id}>
                  <td style={{ paddingLeft: 20, fontWeight: 600 }}>{as.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{as.campaign?.name}</td>
                  <td><span className={`badge ${as.status === 'Live' ? 'badge-success' : 'badge-info'}`}>{as.status}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${(as.budget || 0).toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>${totalSpend.toLocaleString()}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700 }}>{pacing.hasBudget ? `${(pacing.ratio * 100).toFixed(0)}%` : '—'}</div>
                    <div className="pacing-bar-bg" style={{ width: 60, height: 4, margin: '4px auto 0' }}>
                      <div className={`pacing-bar-fill ${statusClass}`} style={{ width: `${Math.min(100, pacing.ratio * 100)}%` }} />
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`pacing-chip ${statusClass}`}>{pacing.status}</span>
                  </td>
                  <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                    {as.start_date ? new Date(as.start_date).toLocaleDateString() : '—'} to {as.end_date ? new Date(as.end_date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
