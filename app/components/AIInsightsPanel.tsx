'use client';

import { useState, useRef, useEffect } from 'react';

interface Message { role: 'user' | 'assistant'; content: string; }

export default function AIInsightsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const quickPrompts = [
    'Which accounts are underpacing?',
    'Suggest budget reallocations',
    'Flag any spend anomalies',
    'Which accounts may overspend this month?',
  ];

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      const assistantContent = data.text || data.reply || 'No response from assistant.';
      
      setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
    } catch (err: any) {
      setError(err.message || 'Connection error');
    }
    setIsLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          zIndex: 300,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(124,58,237,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s, box-shadow 0.2s',
          color: '#fff',
        }}
        title="AI Insights Assistant"
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        id="ai-chat-toggle"
      >
        {isOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <circle cx="9" cy="10" r="1" fill="currentColor"/>
            <circle cx="12" cy="10" r="1" fill="currentColor"/>
            <circle cx="15" cy="10" r="1" fill="currentColor"/>
          </svg>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 96,
          right: 28,
          zIndex: 300,
          width: 400,
          maxHeight: 580,
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.16)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              ✦
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>AI Campaign Analyst</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Powered by Claude · Context-aware</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minHeight: 200,
          }}>
            {messages.length === 0 && (
              <div>
                <div style={{ textAlign: 'center', padding: '20px 0 16px', color: 'var(--text-secondary)', fontSize: 13 }}>
                  Ask me anything about your campaign pacing, budgets, or performance.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {quickPrompts.map(prompt => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      style={{
                        padding: '6px 12px', borderRadius: 20,
                        border: '1px solid var(--border)', background: 'var(--bg-primary)',
                        fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)',
                        fontFamily: 'inherit', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F3EDFF'; e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.color = '#7C3AED'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-primary)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: m.role === 'user' ? 'linear-gradient(135deg, #7C3AED, #4F46E5)' : 'var(--bg-primary)',
                  color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                  fontSize: 13, lineHeight: 1.65,
                  border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.content || (isLoading && idx === messages.length - 1 ? (
                    <span style={{ opacity: 0.5 }}>Thinking…</span>
                  ) : null)}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '10px 16px', borderRadius: '16px 16px 16px 4px',
                  background: 'var(--bg-primary)', border: '1px solid var(--border)',
                  display: 'flex', gap: 6, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: '#7C3AED',
                      animation: `aiDot 1.2s ease ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', fontSize: 12 }}>
                ⚠️ {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} style={{
            padding: '12px 16px', borderTop: '1px solid var(--border)',
            display: 'flex', gap: 10, flexShrink: 0, background: '#fff',
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about pacing, budgets, anomalies…"
              disabled={isLoading}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 12,
                border: '1.5px solid var(--border)', fontSize: 13,
                fontFamily: 'inherit', outline: 'none', background: 'var(--bg-primary)',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = '#7C3AED')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{
                width: 40, height: 40, borderRadius: 12,
                background: isLoading || !input.trim() ? 'var(--border)' : 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                border: 'none', cursor: isLoading || !input.trim() ? 'default' : 'pointer',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 0.2s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes aiDot {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </>
  );
}
