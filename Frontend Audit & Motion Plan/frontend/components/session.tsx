'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { User } from '@/types';

type Session = { user: User | null; setUser: (user: User | null) => void; booting: boolean; provider: string; bootError: string };
const SessionContext = createContext<Session | null>(null);

// Lives in the root layout so the auth check runs once, not on every section change.
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [provider, setProvider] = useState('');
  const [bootError, setBootError] = useState('');
  useEffect(() => {
    api<User>('/auth/me').then(setUser).catch(e => { if (!String(e.message).startsWith('401')) setBootError(e.message); }).finally(() => setBooting(false));
    api<{ provider: string }>('/health').then(v => setProvider(v.provider)).catch(() => {});
  }, []);
  return <SessionContext.Provider value={{ user, setUser, booting, provider, bootError }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
