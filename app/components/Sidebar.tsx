'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  
  const portfolioId = params.portfolioId as string;
  const accountId = params.accountId as string;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  if (!portfolioId) return null;

  return (
    <aside className="sidebar">
      <div className="nav-section-title">Portfolio</div>
      <Link 
        href={`/portfolios/${portfolioId}`} 
        className={`nav-item ${pathname === `/portfolios/${portfolioId}` ? 'active' : ''}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        Overview
      </Link>
      <Link 
        href={`/portfolios/${portfolioId}/upload`} 
        className={`nav-item ${isActive(`/portfolios/${portfolioId}/upload`) ? 'active' : ''}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        Import Data
      </Link>

      {accountId && (
        <>
          <div className="nav-section-title">Account Details</div>
          <Link 
            href={`/portfolios/${portfolioId}/accounts/${accountId}`} 
            className={`nav-item ${pathname === `/portfolios/${portfolioId}/accounts/${accountId}` ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            Dashboard
          </Link>
          <Link 
            href={`/portfolios/${portfolioId}/accounts/${accountId}/ad-sets`} 
            className={`nav-item ${isActive(`/portfolios/${portfolioId}/accounts/${accountId}/ad-sets`) ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
            Ad Sets & Pacing
          </Link>
          <Link 
            href={`/portfolios/${portfolioId}/accounts/${accountId}/budget`} 
            className={`nav-item ${isActive(`/portfolios/${portfolioId}/accounts/${accountId}/budget`) ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            Budget Planner
          </Link>
          <Link 
            href={`/portfolios/${portfolioId}/accounts/${accountId}/notes`} 
            className={`nav-item ${isActive(`/portfolios/${portfolioId}/accounts/${accountId}/notes`) ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Notes & Actions
          </Link>
        </>
      )}

      <div style={{ marginTop: 'auto', padding: '16px 24px' }}>
        <Link href="/portfolios" className="nav-item" style={{ padding: '8px 0', border: 'none' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Portfolios
        </Link>
      </div>
    </aside>
  );
}
