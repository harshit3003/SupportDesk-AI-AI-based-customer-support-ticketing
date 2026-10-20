'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../lib/api';

// Link to send customers when a ticket is resolved: /rate/<ticketId>?email=<customer email>
export default function Rate() {
  const { id } = useParams();
  const [email, setEmail] = useState('');
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { setEmail(new URLSearchParams(window.location.search).get('email') || ''); }, []);
  const send = async () => {
    try { await api(`/tickets/${id}/csat`, { method: 'POST', body: { email, score, comment }, auth: false }); setMsg('Thank you for your feedback!'); }
    catch (e) { setMsg(e.message); }
  };
  return (
    <div className="center card stack">
      <h1>How did we do?</h1>
      <input placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="row">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={score === n ? '' : 'ghost'} onClick={() => setScore(n)}>{n} ★</button>)}</div>
      <textarea placeholder="Anything we could improve? (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <button onClick={send} disabled={!score}>Submit</button>
      {msg && <div>{msg}</div>}
    </div>
  );
}
