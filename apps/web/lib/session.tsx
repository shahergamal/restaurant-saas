'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

export type Me = {
  user: { id: string; nameAr: string; nameEn: string; email: string; mfaEnabled: boolean; locale: string; numerals: string };
  organization: { id: string; nameAr: string; nameEn: string; plan: string };
  branches: { id: string; nameAr: string; nameEn: string }[];
  branchId: string;
  roles: string[];
  permissions: string[];
  mfaSetupRequired?: boolean;
};

type Session = { me: Me; can: (p: string) => boolean; branchId: string; setBranch: (id: string) => void };
const Ctx = createContext<Session | null>(null);

export const BRANCH_KEY = 'sufra.branch';

export function useMeQuery() {
  return useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/auth/me'), staleTime: 5 * 60_000 });
}

export function SessionProvider({ me, children }: { me: Me; children: React.ReactNode }) {
  const qc = useQueryClient();
  const [branchId, setBranchId] = useState(me.branchId);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(BRANCH_KEY);
      if (saved && me.branches.some((b) => b.id === saved)) setBranchId(saved);
      else localStorage.removeItem(BRANCH_KEY);
    } catch {
      /* storage blocked */
    }
  }, [me]);
  const setBranch = useCallback(
    (id: string) => {
      try {
        if (id === me.branchId) localStorage.removeItem(BRANCH_KEY);
        else localStorage.setItem(BRANCH_KEY, id);
      } catch {
        /* storage blocked */
      }
      setBranchId(id);
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    },
    [me.branchId, qc],
  );
  const can = useCallback((p: string) => me.permissions.includes(p), [me.permissions]);
  return <Ctx.Provider value={{ me, can, branchId, setBranch }}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

export async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    try {
      localStorage.removeItem(BRANCH_KEY);
    } catch {
      /* ignore */
    }
    window.location.assign('/login');
  }
}
