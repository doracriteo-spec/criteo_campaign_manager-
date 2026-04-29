'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { authFetch } from '../../../../../../lib/auth-fetch';

interface Note {
  id: string;
  account_id: string;
  portfolio_id: string;
  content: string;
  type: 'note' | 'action';
  owner: string | null;
  status: 'open' | 'in_progress' | 'done';
  due_date: string | null;
  created_at: string;
}

export default function NotesPage() {
  const router = useRouter();
  const params = useParams();
  const { portfolioId, accountId } = params as { portfolioId: string; accountId: string };

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<'note' | 'action'>('note');
  const [newOwner, setNewOwner] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  const fetchNotes = useCallback(async () => {
    const res = await authFetch(`/api/notes?accountId=${accountId}`);
    if (res.ok) {
      setNotes(await res.json());
    }
    setLoading(false);
  }, [accountId]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    const res = await authFetch('/api/notes', {
      method: 'POST',
      body: JSON.stringify({
        account_id: accountId,
        portfolio_id: portfolioId,
        content: newContent,
        type: newType,
        owner: newOwner || null,
        due_date: newDueDate || null,
        status: 'open',
      }),
    });

    if (res.ok) {
      const created = await res.json();
      setNotes([created, ...notes]);
      setShowAdd(false);
      setNewContent('');
      setNewOwner('');
      setNewDueDate('');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const res = await authFetch('/api/notes', {
      method: 'PATCH',
      body: JSON.stringify({ id, status: newStatus }),
    });

    if (res.ok) {
      setNotes(notes.map(n => n.id === id ? { ...n, status: newStatus as any } : n));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    const res = await authFetch(`/api/notes?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setNotes(notes.filter(n => n.id !== id));
    }
  };

  if (loading) return <div className="main-content"><div className="loading-spinner" /></div>;

  const actions = notes.filter(n => n.type === 'action');
  const pureNotes = notes.filter(n => n.type === 'note');

  return (
    <main className="main-content fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>Notes & Action Items</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Keep track of follow-ups, optimizations, and account history.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : '+ Add Note or Action'}
        </button>
      </div>

      {showAdd && (
        <div className="card fade-in" style={{ marginBottom: 24, padding: 20 }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                  <input type="radio" checked={newType === 'note'} onChange={() => setNewType('note')} /> Note
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                  <input type="radio" checked={newType === 'action'} onChange={() => setNewType('action')} /> Action Item
                </label>
              </div>
              <textarea
                className="form-input"
                placeholder={newType === 'note' ? "Client feedback, campaign context..." : "What needs to be done?"}
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                rows={3}
                required
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            
            {newType === 'action' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Owner</label>
                  <input className="form-input" placeholder="e.g. John Doe" value={newOwner} onChange={e => setNewOwner(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input type="date" className="form-input" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} />
                </div>
              </div>
            )}
            
            <div style={{ alignSelf: 'flex-end' }}>
              <button type="submit" className="btn btn-primary">Save {newType === 'note' ? 'Note' : 'Action'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Action Items Column */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Action Items ({actions.length})</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {actions.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No action items.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {actions.map(action => (
                  <div key={action.id} style={{ padding: 16, borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <select 
                          className="form-select" 
                          style={{ padding: '4px 8px', fontSize: 12, borderRadius: 20, 
                            backgroundColor: action.status === 'done' ? 'var(--success)' : action.status === 'in_progress' ? 'var(--brand-orange)' : 'var(--bg-card)',
                            color: action.status !== 'open' ? '#fff' : 'var(--text-primary)',
                            borderColor: action.status !== 'open' ? 'transparent' : 'var(--border)'
                          }}
                          value={action.status}
                          onChange={e => handleUpdateStatus(action.id, e.target.value)}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                        {action.due_date && (
                          <span style={{ fontSize: 11, color: new Date(action.due_date) < new Date() && action.status !== 'done' ? 'var(--danger)' : 'var(--text-muted)' }}>
                            Due: {new Date(action.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <button onClick={() => handleDelete(action.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 8, textDecoration: action.status === 'done' ? 'line-through' : 'none', opacity: action.status === 'done' ? 0.6 : 1 }}>
                      {action.content}
                    </p>
                    {action.owner && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>👤 {action.owner}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notes Column */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Account Notes ({pureNotes.length})</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {pureNotes.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No notes added.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {pureNotes.map(note => (
                  <div key={note.id} style={{ padding: 16, borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(note.created_at).toLocaleDateString()}</span>
                      <button onClick={() => handleDelete(note.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
