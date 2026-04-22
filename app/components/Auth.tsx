'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // First, try to sign in
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    // If invalid credentials, they might not exist yet. Let's auto-signup to make it easy.
    if (error && error.message.includes('Invalid login')) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        alert(signUpError.message);
      }
    } else if (error) {
      alert(error.message);
    }
    
    setLoading(false);
  };

  return (
    <div className="main-content fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
      <div className="card" style={{ maxWidth: 400, width: '100%', textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ marginBottom: 32 }}>
          <div className="upload-icon" style={{ width: 64, height: 64, margin: '0 auto 16px' }}>
            <div style={{
              fontWeight: 900,
              fontSize: '32px',
              letterSpacing: '-1.5px',
              color: 'var(--criteo-orange)',
              fontFamily: 'Inter, sans-serif',
              lineHeight: 1
            }}>
              CRITEO
            </div>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>Welcome Back</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Sign in or create an account to manage your campaigns.</p>
        </div>
        
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="email"
            placeholder="Email address"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button 
            type="submit"
            disabled={loading}
            className="btn btn-primary" 
            style={{ width: '100%', justifyContent: 'center', padding: '12px 16px', fontSize: 15 }}
          >
            {loading ? 'Authenticating...' : 'Sign In / Sign Up'}
          </button>
        </form>
      </div>
    </div>
  );
}
