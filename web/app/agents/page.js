'use client';
import { useEffect, useState } from 'react';
import { api, fmtMin } from '../../lib/api';
import { Badge, Bars } from '../../components/ui';

export default function Agents() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api('/analytics/agents').then(setRows).catch(() => setRows([])); }, []);
  if (!rows) return <p className="muted">Loading…</p>;
  return (
    <>
      <h1>Agent performance</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <table>
          <thead><tr><th>Agent</th><th>Assigned</th><th>Open</th><th>Resolved</th><th>Avg 1st response</th><th>Avg resolution</th><th>SLA</th><th>CSAT</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td><td>{a.assigned}</td><td>{a.open}</td><td>{a.resolved}</td>
                <td>{fmtMin(a.avgFirstResponseMin)}</td><td>{fmtMin(a.avgResolutionMin)}</td>
                <td><Badge kind={a.slaCompliance >= 90 ? 'ok' : 'breach'}>{a.slaCompliance}%</Badge></td>
                <td>{a.csat ? `${a.csat} (${a.csatCount})` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cols">
        <div className="card"><h2>Tickets resolved</h2><Bars rows={rows.map((a) => ({ label: a.name, value: a.resolved }))} /></div>
        <div className="card"><h2>CSAT (out of 5)</h2><Bars max={5} rows={rows.map((a) => ({ label: a.name, value: a.csat || 0 }))} /></div>
      </div>
    </>
  );
}
