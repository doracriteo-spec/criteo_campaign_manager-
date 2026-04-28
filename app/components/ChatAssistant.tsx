'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useRef } from 'react';
import { AnalysisNode, BulkAnalysisResult, CampaignContext } from '../../lib/analyzer';
import { Send, X, MessageSquare, Bot, Mail, Sparkles } from 'lucide-react';

interface ChatAssistantProps {
  analysis: BulkAnalysisResult;
  config: CampaignContext;
  currentNode: AnalysisNode;
}

export default function ChatAssistant({ analysis, config, currentNode }: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, append } = (useChat as any)({
    api: '/api/chat',
    body: {
      context: {
        summary: analysis.summary,
        config: config,
        currentNode: {
          name: currentNode.name,
          level: currentNode.level,
          pacing: currentNode.pacing,
          kpi_performance: currentNode.kpi_performance,
          risks: currentNode.risks,
        }
      }
    }
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const suggestions = [
    "How is this campaign pacing?",
    "Why is this account underspending?",
    "What should we change to improve ROAS?",
    "Draft a quick email update to the client"
  ];

  return (
    <>
      {/* Trigger Button */}
      <button 
        className="chat-trigger"
        onClick={() => setIsOpen(true)}
      >
        <Sparkles size={20} />
        <span>Ask Campaign Assistant</span>
      </button>

      {/* Chat Panel */}
      <div className={`chat-panel ${isOpen ? 'open' : ''}`}>
        <div className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="chat-avatar">
              <Bot size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Campaign Assistant</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Senior Strategy Analyst</div>
            </div>
          </div>
          <button className="chat-close" onClick={() => setIsOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="chat-messages" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="chat-welcome">
              <div className="welcome-icon">⚡</div>
              <h3>Hello! I'm your campaign analyst.</h3>
              <p>I can help you analyze performance, identify risks, and draft client communications based on your current data.</p>
              
              <div className="suggestion-grid">
                {suggestions.map((s, i) => (
                  <button key={i} className="suggestion-chip" onClick={() => {
                    append({ role: 'user', content: s });
                  }}>
                    {s.includes('email') ? <Mail size={12} /> : <MessageSquare size={12} />}
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m: any) => (
            <div key={m.id} className={`message-wrapper ${m.role}`}>
              <div className="message-bubble">
                {m.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message-wrapper assistant">
              <div className="message-bubble loading">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}

          {error && (
            <div className="message-wrapper assistant">
              <div className="message-bubble" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
                <strong>Assistant Error:</strong> {(error as any).message || "An unexpected error occurred. Please check your connection or API configuration."}
              </div>
            </div>
          )}
        </div>

        <form className="chat-input-area" onSubmit={handleSubmit}>
          <input
            className="chat-input"
            value={input}
            placeholder="Ask a question about your campaigns..."
            onChange={handleInputChange}
          />
          <button className="chat-send" type="submit" disabled={!input || isLoading}>
            <Send size={18} />
          </button>
        </form>
      </div>

      <style jsx>{`
        .chat-trigger {
          position: fixed;
          bottom: 30px;
          right: 30px;
          background: #000;
          color: #fff;
          border: none;
          padding: 14px 24px;
          border-radius: 100px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          z-index: 2000;
          transition: transform 0.2s ease, background 0.2s ease;
        }
        .chat-trigger:hover {
          transform: translateY(-2px);
          background: var(--brand-orange);
        }
        
        .chat-panel {
          position: fixed;
          bottom: 100px;
          right: 30px;
          width: 400px;
          height: 600px;
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          z-index: 2000;
          transform: translateY(20px);
          opacity: 0;
          pointer-events: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid var(--border);
        }
        .chat-panel.open {
          transform: translateY(0);
          opacity: 1;
          pointer-events: auto;
        }

        .chat-header {
          padding: 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .chat-avatar {
          width: 36px;
          height: 36px;
          background: #000;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .chat-close {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 5px;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .chat-welcome {
          text-align: center;
          padding: 20px 0;
        }
        .welcome-icon {
          font-size: 40px;
          margin-bottom: 15px;
        }
        .chat-welcome h3 {
          font-size: 18px;
          font-weight: 800;
          margin-bottom: 8px;
        }
        .chat-welcome p {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 24px;
          line-height: 1.5;
        }

        .suggestion-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .suggestion-chip {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          padding: 10px 16px;
          border-radius: 12px;
          font-size: 12px;
          text-align: left;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }
        .suggestion-chip:hover {
          border-color: var(--brand-orange);
          background: #fff;
        }

        .message-wrapper {
          display: flex;
          flex-direction: column;
        }
        .message-wrapper.user {
          align-items: flex-end;
        }
        .message-wrapper.assistant {
          align-items: flex-start;
        }

        .message-bubble {
          max-width: 85%;
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
          white-space: pre-wrap;
        }
        .user .message-bubble {
          background: var(--brand-orange);
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .assistant .message-bubble {
          background: var(--bg-primary);
          color: var(--text-primary);
          border-bottom-left-radius: 4px;
          border: 1px solid var(--border);
        }

        .chat-input-area {
          padding: 20px;
          border-top: 1px solid var(--border);
          display: flex;
          gap: 12px;
        }
        .chat-input {
          flex: 1;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 14px;
          outline: none;
        }
        .chat-input:focus {
          border-color: var(--brand-orange);
        }
        .chat-send {
          width: 42px;
          height: 42px;
          background: #000;
          color: #fff;
          border: none;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .chat-send:disabled {
          background: var(--border);
          cursor: not-allowed;
        }

        .loading {
          display: flex;
          gap: 4px;
          padding: 15px 20px !important;
        }
        .dot {
          width: 6px;
          height: 6px;
          background: var(--text-muted);
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        .dot:nth-child(1) { animation-delay: -0.32s; }
        .dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </>
  );
}
