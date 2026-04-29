'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Don't show sidebar/header layout on login page
  if (pathname === '/login') return <>{children}</>;

  // Check if we are in a portfolio or account context to show sidebar
  const showSidebar = pathname.startsWith('/portfolios/');

  return (
    <div className="app-container">
      <Header />
      {showSidebar ? (
        <div className="app-shell">
          <Sidebar />
          <div style={{ overflowY: 'auto' }}>
            {children}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1 }}>
          {children}
        </div>
      )}
    </div>
  );
}
