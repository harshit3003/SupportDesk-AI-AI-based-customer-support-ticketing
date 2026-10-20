'use client';
import { useState } from 'react';
import { api, label } from '../../lib/api';

export default function Submit() {
  const [f, setF] = useState({ name: '', email: '', subject: '', body: '' });
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const send = async () => {
    try { setDone(await api('/tickets/public', { method: 'POST', body: f, auth: false })); setErr(''); }
    catch (e) { setErr(e.message); }
  };
  if (done) return <div className="center card"><h1>Thanks — we’re on it</h1><p>Ticket <code>{done.id}</code> was filed under <b>{label(done.category)}</b> ({done.priority} priority).</p></div>;
  return (
    <div className="center card stack">
      <h1>Contact support</h1>
      <input placeholder="Your name" value={f.name} onChange={set('name')} />
      <input placeholder="Email" value={f.email} onChange={set('email')} />
      <input placeholder="Subject" value={f.subject} onChange={set('subject')} />
      <textarea placeholder="How can we help?" value={f.body} onChange={set('body')} />
      {err && <div className="err">{err}</div>}
      <button onClick={send}>Submit ticket</button>
    </div>
  );
}
