'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../../../lib/supabase';

export default function ShopeeModulePage() {
  const router = useRouter();
  const params = useParams();
  const portfolioId = params.portfolioId as string;
  const accountId = params.accountId as string;

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    async function loadShopeeData() {
      const { data, error } = await supabase
        .from('shopee_allocation_plans')
        .select('*, lines:shopee_allocation_lines(*)')
        .eq('account_id', accountId);
      
      if (!error && data) {
        setPlans(data);
      }
      setLoading(false);
    }
    loadShopeeData();
  }, [accountId]);

  if (loading) {
    return <div className="loading-spinner" />;
  }

  return (
    <div className="main-content fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-muted)' }}>
        <button onClick={() => router.push(`/portfolios/${portfolioId}`)} className="breadcrumb-btn">Portfolio</button>
        <span>/</span>
        <button onClick={() => router.push(`/portfolios/${portfolioId}/accounts/${accountId}`)} className="breadcrumb-btn">Account</button>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Shopee Module</span>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, color: '#ee4d2d' }}>
            Shopee Collaborative Ads Module
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Allocate and manage store-level budgets specifically for Shopee CPAS campaigns.
          </p>
        </div>

        <div className="card fade-in">
          <div className="card-header">
            <span className="card-title">Allocation Plans</span>
            <button className="btn btn-primary" style={{ background: '#ee4d2d', borderColor: '#ee4d2d' }}>+ New Plan</button>
          </div>
          <div className="card-body">
            {plans.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                No Shopee allocation plans found for this account.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Total Lines</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan: any) => (
                    <tr key={plan.id}>
                      <td>{plan.month}</td>
                      <td>{plan.lines?.length || 0} stores</td>
                      <td>{new Date(plan.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
