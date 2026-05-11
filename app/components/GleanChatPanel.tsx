'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

const GLEAN_AGENT_ID = '029e132bac844e8baaf6cb20dea43213';

declare global {
  interface Window {
    GleanWebSDK?: {
      renderChat: (
        container: HTMLElement,
        options: { agentId: string; [key: string]: unknown }
      ) => void;
    };
  }
}

export default function GleanChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  // Render the Glean agent whenever the panel opens and the SDK is available
  useEffect(() => {
    if (!isOpen) return;
    // Slight delay to ensure the container is visible in the DOM
    const timer = setTimeout(() => {
      if (containerRef.current && window.GleanWebSDK && !renderedRef.current) {
        window.GleanWebSDK.renderChat(containerRef.current, {
          agentId: GLEAN_AGENT_ID,
        });
        renderedRef.current = true;
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [isOpen]);

  return (
    <>
      {/* Floating trigger button */}
      <button
        id="glean-chat-trigger"
        onClick={() => setIsOpen(o => !o)}
        aria-label="Open AI Campaign Assistant"
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          zIndex: 1000,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: isOpen
            ? 'linear-gradient(135deg, #1a1a2e, #16213e)'
            : 'linear-gradient(135deg, #7C3AED, #4F46E5)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(124,58,237,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
          color: '#fff',
        }}
        onMouseEnter={e => {
          if (!isOpen) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
        }}
      >
        {isOpen ? <X size={22} /> : <Sparkles size={20} />}
      </button>

      {/* Chat panel */}
      <div
        id="glean-chat-panel"
        style={{
          position: 'fixed',
          bottom: 96,
          right: 28,
          zIndex: 999,
          width: 420,
          height: 640,
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
          border: '1px solid rgba(124,58,237,0.15)',
          overflow: 'hidden',
          background: '#fff',
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Panel header */}
        <div style={{
          padding: '14px 18px',
          background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            ✦
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>AI Campaign Analyst</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Powered by Glean · Agent {GLEAN_AGENT_ID.slice(0, 8)}…</div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.15)', border: 'none',
              color: '#fff', borderRadius: 8, width: 28, height: 28,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Glean SDK mounts here */}
        <div
          id="glean-app"
          ref={containerRef}
          style={{ position: 'relative', display: 'block', height: 'calc(100% - 60px)', width: '100%' }}
        />
      </div>
    </>
  );
}
