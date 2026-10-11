import { describe, expect, it } from 'vitest';
import { can, permissionsFor } from './rbac';

describe('rbac', () => {
  it('owner can do everything', () => expect(can(['owner'], 'invoices.void')).toBe(true));
  it('manager cannot manage staff', () => expect(can(['manager'], 'staff.manage')).toBe(false));
  it('chef cannot see food cost', () => expect(can(['chef'], 'food_cost.view')).toBe(false));
  it('merges roles', () => {
    const p = permissionsFor(['chef', 'cashier']);
    expect(p.has('kitchen.update') && p.has('orders.create')).toBe(true);
  });
});
