'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const LINKS = [['/', 'Overview'], ['/tickets', 'Tickets'], ['/agents', 'Agents'], ['/csat', 'Satisfaction']];

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  if (path === '/login' || path === '/submit' || path.startsWith('/rate')) return null;
  return (
    <nav className="nav">
      <strong>SupportDesk AI</strong>
      {LINKS.map(([href, text]) => (
        <Link key={href} href={href} className={path === href || (href !== '/' && path.startsWith(href)) ? 'active' : ''}>{text}</Link>
      ))}
      <span style={{ flex: 1 }} />
      <Link href="/submit">Customer form ↗</Link>
      <a href="#" onClick={(e) => { e.preventDefault(); localStorage.removeItem('token'); router.push('/login'); }}>Sign out</a>
    </nav>
  );
}
