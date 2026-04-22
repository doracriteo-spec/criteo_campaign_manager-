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
            <svg viewBox="0 0 394 80" fill="none" xmlns="http://www.w3.org/2000/svg" height="24">
              <path d="M52.6 22.8C46.2 16.4 37.4 13 27.6 13 12.4 13 0 25.4 0 40.6c0 15.2 12.4 27.6 27.6 27.6 9.8 0 18.6-3.4 25-9.8l-8.4-8.4c-4.2 4.2-10 6.2-16.6 6.2-9.6 0-15.6-6-15.6-15.6 0-9.6 6-15.6 15.6-15.6 6.6 0 12.4 2 16.6 6.2l8.4-8.4z" fill="#F48120"/>
              <path d="M78.8 14.6h-14v52h14v-20c0-7.2 4.2-11.6 10.4-11.6h5.6v-14h-4.4c-5.6 0-9.6 2.4-11.6 6.4v-12.8z" fill="#F48120"/>
              <path d="M110.4 14.6h14v52h-14v-52zm7-14.6c-4.6 0-8 3.4-8 8s3.4 8 8 8 8-3.4 8-8-3.4-8-8-8z" fill="#F48120"/>
              <path d="M155 14.6h-14v6.8h-8v12h8v20c0 9.2 5.6 14.6 14.8 14.6h7.2v-12h-4.4c-3.6 0-5.6-1.4-5.6-5.2v-17.4h10v-12h-8v-6.8z" fill="#F48120"/>
              <path d="M207.4 40.6c0 6-4.2 9.8-9.8 9.8-5.6 0-9.8-3.8-9.8-9.8s4.2-9.8 9.8-9.8c5.6 0 9.8 3.8 9.8 9.8zm14 0c0-15.2-10.4-27.6-23.8-27.6s-23.8 12.4-23.8 27.6 10.4 27.6 23.8 27.6 23.8-12.4 23.8-27.6z" fill="#F48120"/>
            </svg>
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
