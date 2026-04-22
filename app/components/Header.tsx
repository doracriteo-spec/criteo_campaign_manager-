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
        <div style={{
          fontWeight: 900,
          fontSize: '28px',
          letterSpacing: '-1.5px',
          color: 'var(--criteo-orange)',
          fontFamily: 'Inter, sans-serif',
          lineHeight: 1
        }}>
          CRITEO
        </div>
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
