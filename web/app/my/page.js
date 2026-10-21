'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtMin, fmtDate, label } from '../../lib/api';
import { Stat, Badge } from '../../components/ui';
import Guard from '../../components/Guard';

function Queue({ title, rows, empty }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>{title}</h2>
      <table>
        <thead><tr><th>Subject</th><th>Category</th><th>Priority</th><th>Resolution due</th><th /></tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t._id}>
              <td><Link href={`/tickets/${t._id}`}>{t.subject}</Link></td>
              <td>{label(t.category)}</td>
              <td><Badge kind={t.priority}>{t.priority}</Badge></td>
              <td>{fmtDate(t.sla.resolutionDue)}</td>
              <td>{t.sla.breached && <Badge kind="breach">breached</Badge>}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="muted">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function MyWorkspace() {
  const [me, setMe] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    Promise.all([api('/analytics/me'), api('/tickets')]).then(([m, t]) => { setMe(m); setTickets(t); }).catch((e) => setErr(e.message));
  }, []);
  if (err) return <p className="err">{err}</p>;
  if (!me) return <p className="muted">Loading…</p>;
  const live = tickets.filter((t) => ['open', 'pending'].includes(t.status)).sort((a, b) => new Date(a.sla.resolutionDue) - new Date(b.sla.resolutionDue));
  const mine = live.filter((t) => t.assignee);
  const queue = live.filter((t) => !t.assignee);
  return (
    <>
      <h1>My workspace</h1>
      <div className="grid">
        <Stat title="Open tickets" value={me.open} />
        <Stat title="Resolved" value={me.resolved} />
        <Stat title="My SLA compliance" value={`${me.slaCompliance}%`} tone={me.slaCompliance < 90 ? 'bad' : 'ok'} />
        <Stat title="Avg first response" value={fmtMin(me.avgFirstResponseMin)} />
        <Stat title="My CSAT" value={me.csat ?? '—'} sub={`${me.csatCount} ratings`} />
      </div>
      <Queue title="My queue (most urgent SLA first)" rows={mine} empty="You're all caught up." />
      <Queue title="Unassigned — claim one" rows={queue} empty="No unassigned tickets." />
    </>
  );
}

export default function Page() { return <Guard roles={['agent', 'admin']}><MyWorkspace /></Guard>; }
