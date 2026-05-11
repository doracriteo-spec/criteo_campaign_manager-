import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

import Shell from "./components/Shell";
import GleanChatPanel from "./components/GleanChatPanel";

export const metadata: Metadata = {
  title: "Campaign Manager — Performance Analytics",
  description: "Professional campaign analysis and optimization dashboard. Upload CSV data, analyze pacing, KPIs, and get data-driven recommendations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Glean Web SDK — renders the Campaign Analyst agent */}
        <Script
          src="https://app.glean.com/embedded-search-latest.min.js"
          strategy="afterInteractive"
          defer
        />
      </head>
      <body>
        <Shell>
          {children}
        </Shell>
        {/* Glean floating chat panel */}
        <GleanChatPanel />
      </body>
    </html>
  );
}
