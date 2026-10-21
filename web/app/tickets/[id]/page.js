'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, fmtDate, label, getUser } from '../../../lib/api';
import { Badge } from '../../../components/ui';
import Guard from '../../../components/Guard';

const CATS = ['billing', 'technical', 'account', 'shipping', 'feature_request', 'general'];

function TicketDetail() {
  const { id } = useParams();
  const [t, setT] = useState(null);
  const [agents, setAgents] = useState([]);
  const [reply, setReply] = useState('');
  const [user, setUser] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setUser(getUser()); }, []);
  useEffect(() => {
    setT(null);
    api(`/tickets/${id}`).then((x) => { setT(x); setErr(''); }).catch((e) => setErr(e.message));
    if (getUser()?.role === 'admin') api('/auth/agents').then(setAgents).catch(() => {});
  }, [id]);

  if (err && !t) return <p className="err">{err}</p>;
  if (!t) return <p className="muted">Loading…</p>;

  // PATCH/reply endpoints return the updated, populated ticket.
  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { setT(await fn()); setErr(''); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const patch = (body) => run(() => api(`/tickets/${id}`, { method: 'PATCH', body }));
  const send = () => {
    if (!reply.trim()) return;
    return run(async () => { const x = await api(`/tickets/${id}/reply`, { method: 'POST', body: { body: reply } }); setReply(''); return x; });
  };

  return (
    <div className="cols" style={{ gridTemplateColumns: '2fr 1fr' }}>
      <div className="card">
        <h1>{t.subject}</h1>
        <p className="muted small">{t.customer.name} · {t.customer.email} · {fmtDate(t.createdAt)}</p>
        {t.messages.map((m, i) => <div key={i} className={`msg ${m.from}`}><div className="muted small">{m.from} · {fmtDate(m.at)}</div>{m.body}</div>)}
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" />
        {err && <p className="err">{err}</p>}
        <div className="row" style={{ marginTop: 8 }}>
          <button onClick={send} disabled={busy}>Send reply</button>
          <button className="ghost" onClick={() => patch({ status: 'resolved' })} disabled={busy}>Resolve</button>
        </div>
      </div>
      <div className="card stack" style={{ maxWidth: 'none', alignContent: 'start' }}>
        <h2>Details</h2>
        <label>Status<select value={t.status} disabled={busy} onChange={(e) => patch({ status: e.target.value })}>{['open', 'pending', 'resolved', 'closed'].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Priority<select value={t.priority} disabled={busy} onChange={(e) => patch({ priority: e.target.value })}>{['low', 'medium', 'high', 'urgent'].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Category<select value={t.category} disabled={busy} onChange={(e) => patch({ category: e.target.value })}>{CATS.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></label>
        {user?.role === 'admin' ? (
          <label>Assignee<select value={t.assignee?._id || ''} disabled={busy} onChange={(e) => patch({ assignee: e.target.value })}><option value="">Unassigned</option>{agents.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select></label>
        ) : (
          <div className="small"><b>Assignee</b>: {t.assignee?.name || 'Unassigned'} {!t.assignee && user && <button onClick={() => patch({ assignee: user.id })} disabled={busy}>Claim</button>}</div>
        )}
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
        <div className="small"><b>AI</b>: {label(t.ai?.category || '?')} / {t.ai?.priority || '?'} · {Math.round((t.ai?.confidence || 0) * 100)}% confident · via {t.ai?.source || 'n/a'}</div>
        <div className="small"><b>First response due</b>: {fmtDate(t.sla.firstResponseDue)} {t.sla.firstRespondedAt ? '✓' : ''}</div>
        <div className="small"><b>Resolution due</b>: {fmtDate(t.sla.resolutionDue)} {t.sla.resolvedAt ? '✓' : ''}</div>
        {t.sla.breached && <Badge kind="breach">SLA breached</Badge>}
        {t.csat?.score && <div className="small"><b>CSAT</b>: {t.csat.score}/5 {t.csat.comment && `— ${t.csat.comment}`}</div>}
      </div>
    </div>
  );
}

export default function Page() { return <Guard roles={['agent', 'admin']}><TicketDetail /></Guard>; }
