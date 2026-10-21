'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '../lib/api';

// Renders children only if the signed-in user has one of the allowed roles; otherwise redirects.
export default function Guard({ roles, children }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const u = getUser();
    if (!u) return router.replace('/login');
    if (!roles.includes(u.role)) return router.replace(u.role === 'admin' ? '/' : '/my');
    setOk(true);
  }, []);
  return ok ? children : null;
}
