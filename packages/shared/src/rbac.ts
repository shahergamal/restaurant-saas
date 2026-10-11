export const ROLES = ['owner', 'manager', 'cashier', 'waiter', 'chef', 'accountant', 'inventory_clerk'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'dashboard.view',
  'orders.view',
  'orders.create',
  'orders.update',
  'orders.cancel',
  'orders.discount.high', // discount above the configured threshold
  'tables.view',
  'tables.manage',
  'kitchen.view',
  'kitchen.update',
  'inventory.view',
  'inventory.manage',
  'purchasing.manage',
  'recipes.manage',
  'reports.view',
  'food_cost.view',
  'staff.manage',
  'settings.view',
  'settings.manage',
  'invoices.void',
  'audit.view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const all = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: all,
  manager: all.filter((p) => p !== 'staff.manage' && p !== 'settings.manage'),
  cashier: ['dashboard.view', 'orders.view', 'orders.create', 'orders.update', 'tables.view', 'kitchen.view'],
  waiter: ['orders.view', 'orders.create', 'orders.update', 'tables.view', 'tables.manage', 'kitchen.view'],
  chef: ['kitchen.view', 'kitchen.update', 'orders.view', 'inventory.view'],
  accountant: ['dashboard.view', 'orders.view', 'reports.view', 'food_cost.view', 'inventory.view', 'audit.view', 'settings.view'],
  inventory_clerk: ['inventory.view', 'inventory.manage', 'purchasing.manage', 'recipes.manage'],
};

/** Roles that must enroll in multi-factor authentication. */
export const MFA_REQUIRED_ROLES: readonly Role[] = ['owner', 'manager'];

export function permissionsFor(roles: readonly Role[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) set.add(p);
  return set;
}

export function can(roles: readonly Role[], permission: Permission): boolean {
  return permissionsFor(roles).has(permission);
}
