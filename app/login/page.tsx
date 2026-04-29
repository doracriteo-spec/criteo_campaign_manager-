'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/portfolios');
    });
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage(error.message);
      } else if (data.user && !data.session) {
        setMessage('Account created! Check your email to confirm before signing in.');
      } else {
        router.replace('/portfolios');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.toLowerCase().includes('invalid')) {
          setMessage('Invalid email or password.');
        } else {
          setMessage(error.message);
        }
      } else {
        router.replace('/portfolios');
      }
    }
    setLoading(false);
  };

  return (
    <main className="main-content fade-in" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100vh - 64px)',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 16,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg, var(--brand-orange), var(--brand-orange-dark))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 900, color: '#fff',
            }}>C</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em' }}>CampaignPacer</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Portfolio Pacing Platform</div>
            </div>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {mode === 'signin'
              ? 'Sign in to manage your campaign portfolios.'
              : 'Start tracking your campaign pacing.'}
          </p>
        </div>

        <div className="card" style={{ padding: '32px' }}>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Min. 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {message && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: message.toLowerCase().includes('created') || message.toLowerCase().includes('check')
                  ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: message.toLowerCase().includes('created') || message.toLowerCase().includes('check')
                  ? 'var(--success)' : 'var(--danger)',
                fontSize: 13,
              }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px 16px', fontSize: 15, marginTop: 4 }}
              disabled={loading}
            >
              {loading ? 'Loading…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div style={{
            marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)',
            textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)',
          }}>
            {mode === 'signin' ? (
              <>No account? <button onClick={() => { setMode('signup'); setMessage(''); }} style={{ background: 'none', border: 'none', color: 'var(--brand-orange)', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Sign up</button></>
            ) : (
              <>Already have an account? <button onClick={() => { setMode('signin'); setMessage(''); }} style={{ background: 'none', border: 'none', color: 'var(--brand-orange)', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Sign in</button></>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
