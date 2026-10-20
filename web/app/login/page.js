'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function Login() {
  const [email, setEmail] = useState('admin@demo.com');
  const [password, setPassword] = useState('password123');
  const [err, setErr] = useState('');
  const router = useRouter();
  const submit = async () => {
    try {
      const { token } = await api('/auth/login', { method: 'POST', body: { email, password }, auth: false });
      localStorage.setItem('token', token);
      router.push('/');
    } catch (e) { setErr(e.message); }
  };
  return (
    <div className="center card stack">
      <h1>SupportDesk AI</h1>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" onKeyDown={(e) => e.key === 'Enter' && submit()} />
      {err && <div className="err">{err}</div>}
      <button onClick={submit}>Sign in</button>
    </div>
  );
}
