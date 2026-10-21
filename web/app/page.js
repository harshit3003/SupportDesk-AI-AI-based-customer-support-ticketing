'use client';
import Guard from '../components/Guard';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtMin, fmtDate, label } from '../lib/api';
import { Stat, Bars, Badge } from '../components/ui';

function Overview() {
  const [o, setO] = useState(null);
  const [risk, setRisk] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    Promise.all([api('/analytics/overview'), api('/analytics/sla-risk')])
      .then(([a, b]) => { setO(a); setRisk(b); }).catch((e) => setErr(e.message));
  }, []);
  if (err) return <p className="err">{err}</p>;
  if (!o) return <p className="muted">Loading…</p>;
  return (
    <>
      <h1>Overview</h1>
      <div className="grid">
        <Stat title="Total tickets" value={o.total} sub={`${o.unassigned} unassigned · ${o.needsReview} need AI review`} />
        <Stat title="SLA compliance" value={`${o.slaCompliance}%`} sub={`${o.breached} breached`} tone={o.slaCompliance < 90 ? 'bad' : 'ok'} />
        <Stat title="Avg first response" value={fmtMin(o.avgFirstResponseMin)} />
        <Stat title="Avg resolution" value={fmtMin(o.avgResolutionMin)} />
      </div>
      <div className="cols">
        <div className="card"><h2>By category (AI-classified)</h2><Bars rows={o.byCategory.map((c) => ({ label: label(c._id), value: c.n }))} /></div>
        <div className="card"><h2>By status</h2><Bars rows={o.byStatus.map((c) => ({ label: c._id, value: c.n }))} /></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>SLA at risk / breached</h2>
        <table>
          <thead><tr><th>Ticket</th><th>Priority</th><th>Assignee</th><th>Resolution due</th><th /></tr></thead>
          <tbody>
            {risk.map((t) => (
              <tr key={t._id}>
                <td><Link href={`/tickets/${t._id}`}>{t.subject}</Link></td>
                <td><Badge kind={t.priority}>{t.priority}</Badge></td>
                <td>{t.assignee?.name || 'Unassigned'}</td>
                <td>{fmtDate(t.sla.resolutionDue)}</td>
                <td>{t.sla.breached && <Badge kind="breach">breached</Badge>}</td>
              </tr>
            ))}
            {!risk.length && <tr><td colSpan={5} className="muted">Nothing at risk 🎉</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Page() { return <Guard roles={['admin']}><Overview /></Guard>; }
