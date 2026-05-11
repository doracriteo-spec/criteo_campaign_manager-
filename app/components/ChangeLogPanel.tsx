'use client';

import { useState, useEffect, useRef } from 'react';
import { Clock, Plus, Tag, ChevronDown, ChevronUp, Trash2, FileText } from 'lucide-react';

export interface ChangeLogEntry {
  id: string;
  timestamp: string; // ISO string
  type: 'note' | 'budget_change' | 'kpi_update' | 'config_change' | 'upload';
  title: string;
  content: string;
  author?: string;
  metadata?: Record<string, string | number>;
}

interface ChangeLogPanelProps {
  accountId?: string;  // optional — if undefined, uses in-memory log
  entityName: string;
  onLogEntry?: (entry: ChangeLogEntry) => void;
}

const TYPE_CONFIG: Record<ChangeLogEntry['type'], { icon: string; color: string; label: string }> = {
  note:          { icon: '📝', color: '#6366f1', label: 'Note' },
  budget_change: { icon: '💰', color: '#f59e0b', label: 'Budget' },
  kpi_update:    { icon: '🎯', color: '#10b981', label: 'KPI' },
  config_change: { icon: '⚙️', color: '#3b82f6', label: 'Config' },
  upload:        { icon: '📤', color: '#8b5cf6', label: 'Upload' },
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getStorageKey(accountId?: string) {
  return accountId ? `changelog_${accountId}` : 'changelog_global';
}

export function useChangeLog(accountId?: string) {
  const key = getStorageKey(accountId);

  const loadEntries = (): ChangeLogEntry[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveEntry = (entry: ChangeLogEntry) => {
    if (typeof window === 'undefined') return;
    const existing = loadEntries();
    const updated = [entry, ...existing].slice(0, 200); // cap at 200 entries
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const removeEntry = (id: string) => {
    if (typeof window === 'undefined') return;
    const existing = loadEntries().filter(e => e.id !== id);
    localStorage.setItem(key, JSON.stringify(existing));
  };

  return { loadEntries, saveEntry, removeEntry, key };
}

export function createLogEntry(
  type: ChangeLogEntry['type'],
  title: string,
  content: string,
  metadata?: Record<string, string | number>
): ChangeLogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    type,
    title,
    content,
    metadata,
  };
}

export default function ChangeLogPanel({ accountId, entityName, onLogEntry }: ChangeLogPanelProps) {
  const { loadEntries, saveEntry, removeEntry } = useChangeLog(accountId);
  const [entries, setEntries] = useState<ChangeLogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<ChangeLogEntry['type']>('note');
  const [filterType, setFilterType] = useState<ChangeLogEntry['type'] | 'all'>('all');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEntries(loadEntries());
  }, [accountId]);

  useEffect(() => {
    if (showAddNote && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [showAddNote]);

  const addEntry = () => {
    if (!noteContent.trim()) return;
    const entry = createLogEntry(
      noteType,
      noteTitle.trim() || `${TYPE_CONFIG[noteType].label} — ${entityName}`,
      noteContent.trim()
    );
    saveEntry(entry);
    setEntries(loadEntries());
    onLogEntry?.(entry);
    setNoteTitle('');
    setNoteContent('');
    setNoteType('note');
    setShowAddNote(false);
  };

  const deleteEntry = (id: string) => {
    removeEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const filtered = filterType === 'all' ? entries : entries.filter(e => e.type === filterType);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          background: 'var(--bg-card)',
        }}
        onClick={() => setIsExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FileText size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              Change Log & Notes
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} — auto-timestamped
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            id="add-note-btn"
            onClick={e => { e.stopPropagation(); setShowAddNote(true); setIsExpanded(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8,
              background: 'linear-gradient(135deg, var(--brand-orange), var(--brand-orange-dark))',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              boxShadow: '0 2px 8px rgba(244,129,32,0.3)',
            }}
          >
            <Plus size={13} />
            Add Note
          </button>
          {isExpanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Add Note Form */}
          {showAddNote && (
            <div style={{
              padding: 20,
              borderBottom: '1px solid var(--border-light)',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.03), rgba(99,102,241,0.01))',
            }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
                    Title (optional)
                  </label>
                  <input
                    value={noteTitle}
                    onChange={e => setNoteTitle(e.target.value)}
                    placeholder={`e.g. Budget adjustment for ${entityName}`}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 8,
                      border: '1.5px solid var(--border)', fontSize: 13,
                      fontFamily: 'inherit', outline: 'none', background: '#fff',
                      color: 'var(--text-primary)',
                    }}
                    onFocus={e => (e.target.style.borderColor = '#6366f1')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
                    Type
                  </label>
                  <select
                    value={noteType}
                    onChange={e => setNoteType(e.target.value as ChangeLogEntry['type'])}
                    style={{
                      padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border)',
                      fontSize: 13, fontFamily: 'inherit', background: '#fff',
                      color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
                      height: 38,
                    }}
                  >
                    {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
                  Note Content *
                </label>
                <textarea
                  ref={textareaRef}
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  placeholder={`Describe the change, observation, or action taken for ${entityName}…`}
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1.5px solid var(--border)', fontSize: 13,
                    fontFamily: 'inherit', outline: 'none', resize: 'vertical',
                    background: '#fff', color: 'var(--text-primary)', lineHeight: 1.6,
                  }}
                  onFocus={e => (e.target.style.borderColor = '#6366f1')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) addEntry(); }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Ctrl+Enter to save · Time & date will be recorded automatically
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={addEntry}
                  disabled={!noteContent.trim()}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: noteContent.trim() ? 'pointer' : 'not-allowed',
                    background: noteContent.trim() ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'var(--border)',
                    color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
                  }}
                >
                  <Clock size={13} />
                  Save with Timestamp
                </button>
                <button
                  onClick={() => { setShowAddNote(false); setNoteTitle(''); setNoteContent(''); }}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
                    background: '#fff', color: 'var(--text-secondary)', fontSize: 13,
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          {entries.length > 0 && (
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => setFilterType('all')}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  border: filterType === 'all' ? '1.5px solid #6366f1' : '1px solid var(--border)',
                  background: filterType === 'all' ? 'rgba(99,102,241,0.08)' : '#fff',
                  color: filterType === 'all' ? '#6366f1' : 'var(--text-secondary)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                All ({entries.length})
              </button>
              {(Object.keys(TYPE_CONFIG) as ChangeLogEntry['type'][])
                .filter(t => entries.some(e => e.type === t))
                .map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      border: filterType === t ? `1.5px solid ${TYPE_CONFIG[t].color}` : '1px solid var(--border)',
                      background: filterType === t ? `${TYPE_CONFIG[t].color}15` : '#fff',
                      color: filterType === t ? TYPE_CONFIG[t].color : 'var(--text-secondary)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {TYPE_CONFIG[t].icon} {TYPE_CONFIG[t].label} ({entries.filter(e => e.type === t).length})
                  </button>
                ))
              }
            </div>
          )}

          {/* Entries List */}
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>No entries yet</div>
                <div style={{ fontSize: 12 }}>Click "Add Note" to log a change or observation with an automatic timestamp.</div>
              </div>
            ) : (
              filtered.map((entry, idx) => {
                const cfg = TYPE_CONFIG[entry.type];
                return (
                  <div
                    key={entry.id}
                    style={{
                      padding: '14px 20px',
                      borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-light)' : 'none',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Type icon */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: `${cfg.color}12`,
                      border: `1px solid ${cfg.color}25`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, marginTop: 1,
                    }}>
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {entry.title}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                          color: cfg.color, background: `${cfg.color}12`,
                          padding: '2px 7px', borderRadius: 10,
                          border: `1px solid ${cfg.color}20`,
                          letterSpacing: '0.04em', flexShrink: 0,
                        }}>
                          {cfg.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 6 }}>
                        {entry.content}
                      </div>
                      {/* Metadata */}
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                          {Object.entries(entry.metadata).map(([k, v]) => (
                            <span key={k} style={{
                              fontSize: 11, background: 'var(--bg-primary)',
                              border: '1px solid var(--border)', borderRadius: 6,
                              padding: '2px 8px', color: 'var(--text-secondary)',
                            }}>
                              {k}: <strong>{v}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Timestamp */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', fontSize: 11 }}>
                        <Clock size={10} />
                        <span>{formatTimestamp(entry.timestamp)}</span>
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: 4, borderRadius: 6,
                        flexShrink: 0, transition: 'color 0.15s',
                        display: 'flex', alignItems: 'center',
                      }}
                      title="Delete entry"
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
