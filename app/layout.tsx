import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Criteo Campaign Manager — Performance Analytics",
  description: "Professional Criteo campaign analysis and optimization dashboard. Upload CSV data, analyze pacing, KPIs, and get data-driven recommendations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <header className="header">
            <div className="header-logo">
              <svg viewBox="0 0 394 80" fill="none" xmlns="http://www.w3.org/2000/svg" height="28">
                <path d="M52.6 22.8C46.2 16.4 37.4 13 27.6 13 12.4 13 0 25.4 0 40.6c0 15.2 12.4 27.6 27.6 27.6 9.8 0 18.6-3.4 25-9.8l-8.4-8.4c-4.2 4.2-10 6.2-16.6 6.2-9.6 0-15.6-6-15.6-15.6 0-9.6 6-15.6 15.6-15.6 6.6 0 12.4 2 16.6 6.2l8.4-8.4z" fill="#F48120"/>
                <path d="M78.8 14.6h-14v52h14v-20c0-7.2 4.2-11.6 10.4-11.6h5.6v-14h-4.4c-5.6 0-9.6 2.4-11.6 6.4v-12.8z" fill="#F48120"/>
                <path d="M110.4 14.6h14v52h-14v-52zm7-14.6c-4.6 0-8 3.4-8 8s3.4 8 8 8 8-3.4 8-8-3.4-8-8-8z" fill="#F48120"/>
                <path d="M155 14.6h-14v6.8h-8v12h8v20c0 9.2 5.6 14.6 14.8 14.6h7.2v-12h-4.4c-3.6 0-5.6-1.4-5.6-5.2v-17.4h10v-12h-8v-6.8z" fill="#F48120"/>
                <path d="M207.4 40.6c0 6-4.2 9.8-9.8 9.8-5.6 0-9.8-3.8-9.8-9.8s4.2-9.8 9.8-9.8c5.6 0 9.8 3.8 9.8 9.8zm14 0c0-15.2-10.4-27.6-23.8-27.6s-23.8 12.4-23.8 27.6 10.4 27.6 23.8 27.6 23.8-12.4 23.8-27.6z" fill="#F48120"/>
              </svg>
              <div>
                <div className="header-title">Campaign Manager</div>
                <div className="header-subtitle">Performance Analytics</div>
              </div>
            </div>
            <div className="header-right">
              <span className="header-badge">✦ AI-Powered</span>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
