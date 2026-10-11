import { AsyncLocalStorage } from 'node:async_hooks';
import type { Role } from '@sufra/shared';

export interface RequestContext {
  orgId?: string;
  userId?: string;
  branchId?: string;
  roles?: Role[];
  ip?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function ctx(): RequestContext {
  const store = requestContext.getStore();
  if (!store) throw new Error('No request context');
  return store;
}

/** Organization of the current request. Throws when unauthenticated so queries fail closed. */
export function currentOrgId(): string {
  const id = requestContext.getStore()?.orgId;
  if (!id) throw new Error('Tenant context missing: refusing to query tenant data');
  return id;
}

export function currentBranchId(): string {
  const id = requestContext.getStore()?.branchId;
  if (!id) throw new Error('Branch context missing');
  return id;
}
