'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { User } from '@supabase/supabase-js';

export default function Header() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="header">
      <div className="header-logo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--criteo-orange)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
        <div>
          <div className="header-title">Campaign Manager</div>
          <div className="header-subtitle">Performance Analytics</div>
        </div>
      </div>
      <div className="header-right">
        <span className="header-badge">✦ AI-Powered</span>
        {user && (
          <button 
            onClick={handleSignOut} 
            className="btn btn-secondary" 
            style={{ padding: '6px 12px', fontSize: 12, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            Sign Out
          </button>
        )}
      </div>
    </header>
  );
}
