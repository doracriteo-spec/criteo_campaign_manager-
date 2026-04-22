import type { Metadata } from "next";
import "./globals.css";

import Header from "./components/Header";

export const metadata: Metadata = {
  title: "Criteo Campaign Manager — Performance Analytics",
  description: "Professional Criteo campaign analysis and optimization dashboard. Upload CSV data, analyze pacing, KPIs, and get data-driven recommendations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
