import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const mfaSchema = z.object({
  challenge: z.string().min(10).max(2000),
  code: z.string().regex(/^\d{6}$/),
});

export const orderStatusFilter = z.enum(['all', 'in_progress', 'ready', 'delayed']);

export const listOrdersQuery = z.object({
  status: orderStatusFilter.default('all'),
  area: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(80).optional(),
});

export const updateTableSchema = z.object({
  status: z.enum(['occupied', 'available', 'cleaning', 'out_of_service']).optional(),
  waiterId: z.string().uuid().nullable().optional(),
  x: z.number().int().min(0).max(2000).optional(),
  y: z.number().int().min(0).max(2000).optional(),
});

export const inventoryQuery = z.object({
  category: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(9),
  q: z.string().trim().max(80).optional(),
  status: z.enum(['in_stock', 'low', 'critical', 'out']).optional(),
});

export const createIngredientSchema = z.object({
  nameAr: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  unit: z.enum(['kg', 'g', 'L', 'ml', 'pack', 'pcs']),
  category: z.enum(['produce', 'meat', 'seafood', 'dairy', 'dry_goods', 'beverages']),
  minLevel: z.number().min(0).max(100_000),
  reorderLevel: z.number().min(0).max(100_000),
  qty: z.number().min(0).max(100_000).default(0),
  unitCost: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
});

export const rangeQuery = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  branchId: z.string().uuid().optional(),
});

export const settingsSchema = z.object({
  nameAr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  vatNumber: z.string().regex(/^3\d{13}3$/, 'VAT number is 15 digits starting and ending with 3').optional().or(z.literal('')),
  crNumber: z.string().regex(/^\d{10}$/).optional().or(z.literal('')),
  serviceChargeBp: z.number().int().min(0).max(3000),
  delayThresholdMin: z.number().int().min(5).max(120),
  locale: z.enum(['ar', 'en']),
  numerals: z.enum(['arab', 'latn']),
});
export type SettingsInput = z.infer<typeof settingsSchema>;
