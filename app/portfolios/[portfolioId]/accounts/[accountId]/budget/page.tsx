'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../../../../lib/supabase';
import BudgetCalculator from '../../../../../../app/components/BudgetCalculator';

interface Account {
  id: string;
  name: string;
  currency: string;
}

export default function BudgetPlannerPage() {
  const router = useRouter();
  const params = useParams();
  const { portfolioId, accountId } = params as { portfolioId: string; accountId: string };

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/login'); return; }

    const { data, error } = await supabase
      .from('accounts')
      .select('id, name, currency')
      .eq('id', accountId)
      .single();

    if (data) setAccount(data);
    setLoading(false);
  }, [accountId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="main-content"><div className="loading-spinner" /></div>;
  if (!account) return <div className="main-content">Account not found.</div>;

  return (
    <main className="main-content fade-in">
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>Budget Planner & Recovery</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Calculate monthly allocations and get daily budget recommendations for {account.name}.
        </p>
      </div>

      <div style={{ maxWidth: 800 }}>
        <BudgetCalculator 
          currency={account.currency === 'EUR' ? '€' : '$'} 
          initialData={{ name: account.name }}
          onApply={(daily) => {
            alert(`Recommended daily budget of $${daily.toFixed(2)} noted. In a production app, this would update the ad set budgets via API.`);
          }}
        />
      </div>

      <div className="card" style={{ marginTop: 24, maxWidth: 800 }}>
        <div className="card-header">
          <span className="card-title">How to use this tool</span>
        </div>
        <div className="card-body" style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <p style={{ marginBottom: 12 }}>
            <strong>1. Planning Calculator:</strong> Use this to break down a total monthly target into weekly and daily caps. This helps you set the initial baseline for your campaigns.
          </p>
          <p>
            <strong>2. Campaign Recovery Advisor:</strong> If a campaign has been underspending, enter the remaining flight dates and total budget. The advisor will calculate the exact daily spend required from today until the end date to fully exhaust the budget.
          </p>
        </div>
      </div>
    </main>
  );
}
