'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtDate, label } from '../../lib/api';
import { Badge } from '../../components/ui';

const CATS = ['billing', 'technical', 'account', 'shipping', 'feature_request', 'general'];

export default function Tickets() {
  const [f, setF] = useState({ status: '', category: '', priority: '', mine: false, breached: false });
  const [rows, setRows] = useState([]);
  useEffect(() => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
    api(`/tickets?${qs}`).then(setRows).catch(() => {});
  }, [f]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <>
      <h1>Tickets</h1>
      <div className="row">
        <select value={f.status} onChange={set('status')}><option value="">All statuses</option>{['open', 'pending', 'resolved', 'closed'].map((s) => <option key={s}>{s}</option>)}</select>
        <select value={f.category} onChange={set('category')}><option value="">All categories</option>{CATS.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
        <select value={f.priority} onChange={set('priority')}><option value="">All priorities</option>{['urgent', 'high', 'medium', 'low'].map((s) => <option key={s}>{s}</option>)}</select>
        <label><input type="checkbox" checked={f.mine} onChange={set('mine')} /> Mine</label>
        <label><input type="checkbox" checked={f.breached} onChange={set('breached')} /> SLA breached</label>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Created</th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t._id}>
                <td><Link href={`/tickets/${t._id}`}>{t.subject}</Link> {t.sla.breached && <Badge kind="breach">SLA</Badge>} {t.ai?.needsReview && <Badge kind="high">review</Badge>}</td>
                <td>{label(t.category)}</td>
                <td><Badge kind={t.priority}>{t.priority}</Badge></td>
                <td>{t.status}</td>
                <td>{t.assignee?.name || '—'}</td>
                <td>{fmtDate(t.createdAt)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="muted">No tickets</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
