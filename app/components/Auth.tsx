'use client';

import { supabase } from '../../lib/supabase';

export default function Auth() {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  return (
    <div className="main-content fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
      <div className="card" style={{ maxWidth: 400, width: '100%', textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ marginBottom: 32 }}>
          <div className="upload-icon" style={{ width: 64, height: 64, margin: '0 auto 16px' }}>
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/2/21/Criteo_logo.svg" 
              alt="Criteo" 
              height="24" 
            />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>Welcome Back</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Sign in to manage your campaigns and analytics.</p>
        </div>
        
        <button 
          onClick={handleGoogleLogin}
          className="btn btn-secondary" 
          style={{ width: '100%', justifyContent: 'center', padding: '12px 16px', fontSize: 15 }}
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" style={{ width: 18, height: 18 }} />
          Continue with Google
        </button>
      </div>
    </div>
  );
}
