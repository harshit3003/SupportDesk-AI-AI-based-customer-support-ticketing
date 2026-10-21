'use client';
import Guard from '../../components/Guard';
import { useEffect, useState } from 'react';
import { api, label } from '../../lib/api';
import { Stat, Bars } from '../../components/ui';

function Csat() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/analytics/csat').then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="err">{err}</p>;
  if (!d) return <p className="muted">Loading…</p>;
  return (
    <>
      <h1>Customer satisfaction</h1>
      <div className="grid">
        <Stat title="Average CSAT" value={d.average ?? '—'} sub="out of 5" />
        <Stat title="Satisfied (4–5)" value={d.satisfiedPct != null ? `${d.satisfiedPct}%` : '—'} />
        <Stat title="Responses" value={d.responses} />
      </div>
      <div className="cols">
        <div className="card"><h2>Score distribution</h2><Bars rows={d.distribution.map((x) => ({ label: `${x.score} ★`, value: x.n }))} /></div>
        <div className="card"><h2>Lowest-rated categories</h2><Bars max={5} rows={d.byCategory.map((c) => ({ label: label(c.category), value: c.avg }))} /></div>
        <div className="card"><h2>Daily average (last 30 days)</h2><Bars max={5} rows={d.trend.map((t) => ({ label: t.day.slice(5), value: t.avg }))} /></div>
      </div>
    </>
  );
}

export default function Page() { return <Guard roles={['admin']}><Csat /></Guard>; }
