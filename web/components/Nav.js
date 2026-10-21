'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUser } from '../lib/api';

const ADMIN = [['/', 'Overview'], ['/tickets', 'Tickets'], ['/agents', 'Agents'], ['/csat', 'Satisfaction']];
const AGENT = [['/my', 'My workspace'], ['/tickets', 'Tickets']];

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  useEffect(() => { setUser(getUser()); }, [path]);
  if (path === '/login' || path === '/submit' || path.startsWith('/rate') || !user) return null;
  const links = user.role === 'admin' ? ADMIN : AGENT;
  return (
    <nav className="nav">
      <strong>SupportDesk AI</strong>
      {links.map(([href, text]) => (
        <Link key={href} href={href} className={path === href || (href !== '/' && path.startsWith(href)) ? 'active' : ''}>{text}</Link>
      ))}
      <span style={{ flex: 1 }} />
      <span className="muted small">{user.name} · {user.role}</span>
      <a href="#" onClick={(e) => { e.preventDefault(); localStorage.clear(); router.push('/login'); }}>Sign out</a>
    </nav>
  );
}
