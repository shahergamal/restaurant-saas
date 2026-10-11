/**
 * Demo seed. Runs as the owner role (bypasses RLS) and rebuilds two organizations:
 *  - "The Olive Restaurant" (3 branches, full Saudi demo data, live orders relative to *now*)
 *  - "Palm Kitchen" (a second tenant used to demonstrate data isolation)
 *
 * Re-run any time to refresh the live demo (orders are generated relative to the current time).
 * Historic sales stock usage is stored as one aggregated movement per ingredient per day.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import { computeTotals, recipeCost } from '@sufra/shared';
import { CATEGORIES, FEEDBACK_COMMENTS, FLOOR_LAYOUTS, INGREDIENTS, MENU, STATIONS, SUPPLIERS, TABLES } from './seed-data';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const PASSWORD = process.env.SEED_PASSWORD ?? 'Sufra@Demo2026';
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const RIYADH = 3 * HOUR;

// Deterministic PRNG so every seed run produces the same shape of data.
let state = 20260516;
function rand() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a: number, b: number) => a + rand() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
function weighted<T extends { weight: number }>(xs: readonly T[]): T {
  const total = xs.reduce((s, x) => s + x.weight, 0);
  let r = rand() * total;
  for (const x of xs) if ((r -= x.weight) <= 0) return x;
  return xs[xs.length - 1]!;
}
function poisson(lambda: number) {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > l);
  return k - 1;
}

const key = Buffer.from(process.env.DATA_ENCRYPTION_KEY ?? '', 'base64');
function encrypt(plain: string) {
  if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be set (32 bytes, base64) to seed personal data');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

const halala = (sar: number) => Math.round(sar * 100);
const riyadhDayStart = (t: number) => {
  const local = new Date(t + RIYADH);
  local.setUTCHours(0, 0, 0, 0);
  return local.getTime() - RIYADH;
};

const HOUR_WEIGHTS: Record<number, number> = {
  10: 0.3, 11: 0.6, 12: 1.0, 13: 1.6, 14: 1.5, 15: 0.8, 16: 0.5, 17: 0.7, 18: 1.1, 19: 1.5, 20: 1.7, 21: 1.4, 22: 0.9, 23: 0.4,
};

async function wipe() {
  // Child tables first.
  const tables = [
    'audit_logs', 'activity_events', 'feedback', 'invoices', 'payments', 'kitchen_tickets', 'order_items', 'orders', 'reservations',
    'stock_movements', 'stock_lots', 'purchase_order_lines', 'purchase_orders', 'recipe_lines', 'menu_item_modifier_groups', 'modifiers',
    'modifier_groups', 'menu_items', 'menu_categories', 'ingredients', 'suppliers', 'tables', 'floors', 'stations', 'expenses',
    'delivery_channels', 'customers', 'compliance_documents', 'devices', 'sessions', 'user_branch_roles', 'users', 'branches', 'organizations',
  ];
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} CASCADE`);
}

async function createMany<T>(fn: (rows: T[]) => Promise<unknown>, rows: T[], size = 2000) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

async function main() {
  const now = Date.now();
  console.log('Seeding demo data…');
  await wipe();
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });

  // ---------- Organization, branches, users ----------
  const org = await prisma.organization.create({
    data: {
      nameAr: 'مطعم الزيتونة', nameEn: 'The Olive Restaurant', crNumber: '1010123456', vatNumber: '310123456700003',
      plan: 'pro', serviceChargeBp: 0, delayThresholdMin: 20, targetMarginBp: 2500,
    },
  });
  const O = org.id;
  const branchDefs = [
    { nameAr: 'الفرع الرئيسي', nameEn: 'Main Branch', address: 'طريق العليا، حي العليا، الرياض', base: 8.5, growth: 0.14 },
    { nameAr: 'فرع النرجس', nameEn: 'Al Narjis', address: 'طريق أبو بكر الصديق، حي النرجس، الرياض', base: 3.8, growth: 0.1 },
    { nameAr: 'فرع الملقا', nameEn: 'Al Malqa', address: 'طريق الأمير محمد بن سعد، حي الملقا، الرياض', base: 2.3, growth: 0.08 },
  ];
  const branches = [];
  for (const [i, b] of branchDefs.entries()) {
    branches.push(
      await prisma.branch.create({
        data: { organizationId: O, nameAr: b.nameAr, nameEn: b.nameEn, address: b.address, zatcaBranchName: b.nameEn, createdAt: new Date(now - (400 - i) * DAY) },
      }),
    );
  }
  const main = branches[0]!;

  const people = [
    { email: 'owner@sufra.demo', ar: 'خالد العتيبي', en: 'Khalid Alotaibi', role: 'owner' },
    { email: 'manager@sufra.demo', ar: 'أحمد حسن', en: 'Ahmed Hassan', role: 'manager' },
    { email: 'cashier@sufra.demo', ar: 'ريم الشهري', en: 'Reem Alshehri', role: 'cashier' },
    { email: 'chef@sufra.demo', ar: 'ماجد القحطاني', en: 'Majed Alqahtani', role: 'chef' },
    { email: 'accountant@sufra.demo', ar: 'منى الدوسري', en: 'Mona Aldosari', role: 'accountant' },
    { email: 'stock@sufra.demo', ar: 'سلطان الحربي', en: 'Sultan Alharbi', role: 'inventory_clerk' },
    { email: 'omar@sufra.demo', ar: 'عمر أحمد', en: 'Omar Ahmed', role: 'waiter' },
    { email: 'faisal@sufra.demo', ar: 'فيصل المطيري', en: 'Faisal Almutairi', role: 'waiter' },
    { email: 'yousef@sufra.demo', ar: 'يوسف الزهراني', en: 'Yousef Alzahrani', role: 'waiter' },
    { email: 'nasser@sufra.demo', ar: 'ناصر الغامدي', en: 'Nasser Alghamdi', role: 'waiter' },
  ] as const;
  const users: Record<string, string> = {};
  for (const p of people) {
    const u = await prisma.user.create({
      data: {
        organizationId: O, email: p.email, nameAr: p.ar, nameEn: p.en, passwordHash, locale: 'ar',
        roles: { create: { organizationId: O, role: p.role } },
      },
    });
    users[p.email] = u.id;
  }
  const waiters = people.filter((p) => p.role === 'waiter').map((p) => users[p.email]!);
  const managerId = users['manager@sufra.demo']!;

  // ---------- Second tenant (isolation demo) ----------
  const other = await prisma.organization.create({ data: { nameAr: 'مطبخ النخلة', nameEn: 'Palm Kitchen', plan: 'starter' } });
  const otherBranch = await prisma.branch.create({ data: { organizationId: other.id, nameAr: 'الفرع الرئيسي', nameEn: 'Main Branch' } });
  await prisma.user.create({
    data: {
      organizationId: other.id, email: 'owner@palm.demo', nameAr: 'هند السبيعي', nameEn: 'Hind Alsubaie', passwordHash,
      roles: { create: { organizationId: other.id, role: 'owner' } },
    },
  });
  const otherFloor = await prisma.floor.create({ data: { organizationId: other.id, branchId: otherBranch.id, nameAr: 'الصالة', nameEn: 'Hall' } });
  await prisma.diningTable.create({ data: { organizationId: other.id, floorId: otherFloor.id, label: 1, seats: 4, x: 200, y: 200 } });

  // ---------- Suppliers, ingredients ----------
  const supplierIds: string[] = [];
  for (const s of SUPPLIERS) {
    supplierIds.push((await prisma.supplier.create({ data: { organizationId: O, name: s.name, phone: s.phone, vatNumber: s.vat } })).id);
  }
  const ing: Record<string, { id: string; cost: number; unit: string; def: (typeof INGREDIENTS)[number] }> = {};
  for (const d of INGREDIENTS) {
    const row = await prisma.ingredient.create({
      data: {
        organizationId: O, slug: d.slug, nameAr: d.ar, nameEn: d.en, unit: d.unit, category: d.category,
        minLevelMilli: Math.round(d.min * 1000), reorderLevelMilli: Math.round(d.reorder * 1000), avgCostHalala: halala(d.cost),
        image: d.image ? `ingredients/${d.slug}` : null, supplierId: supplierIds[d.supplier],
      },
    });
    ing[d.slug] = { id: row.id, cost: halala(d.cost), unit: d.unit, def: d };
  }

  // ---------- Menu ----------
  const catIds: Record<string, string> = {};
  for (const [i, c] of CATEGORIES.entries()) {
    catIds[c.key] = (await prisma.menuCategory.create({ data: { organizationId: O, key: c.key, nameAr: c.ar, nameEn: c.en, sort: i } })).id;
  }
  const stationsByBranch: Record<string, Record<string, string>> = {};
  for (const b of branches) {
    stationsByBranch[b.id] = {};
    for (const [i, s] of STATIONS.entries()) {
      stationsByBranch[b.id]![s.key] = (await prisma.station.create({
        data: { organizationId: O, branchId: b.id, key: s.key, nameAr: s.ar, nameEn: s.en, sort: i },
      })).id;
    }
  }
  const doneness = await prisma.modifierGroup.create({
    data: {
      organizationId: O, nameAr: 'درجة الاستواء', nameEn: 'Doneness', minSelect: 1, maxSelect: 1,
      modifiers: {
        create: [
          { organizationId: O, nameAr: 'نصف استواء', nameEn: 'Medium' },
          { organizationId: O, nameAr: 'مستوي جيداً', nameEn: 'Well Done' },
          { organizationId: O, nameAr: 'قليل الاستواء', nameEn: 'Rare' },
        ],
      },
    },
  });
  await prisma.modifierGroup.create({
    data: {
      organizationId: O, nameAr: 'إضافات', nameEn: 'Extras', maxSelect: 3,
      modifiers: {
        create: [
          { organizationId: O, nameAr: 'بدون بصل', nameEn: 'No onions' },
          { organizationId: O, nameAr: 'حار', nameEn: 'Spicy' },
          { organizationId: O, nameAr: 'جبن إضافي', nameEn: 'Extra cheese', priceHalala: 400 },
        ],
      },
    },
  });

  type MenuRow = { id: string; price: number; cost: number; station: string; def: (typeof MENU)[number]; recipe: { slug: string; qty: number; waste: number }[] };
  const menu: Record<string, MenuRow> = {};
  for (const m of MENU) {
    const recipe = m.recipe.map((r) => {
      const [slug, qty, waste] = r.split(':');
      if (!ing[slug!]) throw new Error(`unknown ingredient ${slug} in ${m.slug}`);
      return { slug: slug!, qty: Number(qty), waste: Number(waste ?? 0) * 100 };
    });
    const row = await prisma.menuItem.create({
      data: {
        organizationId: O, categoryId: catIds[m.cat]!, stationId: stationsByBranch[main.id]![m.station], slug: m.slug, nameAr: m.ar, nameEn: m.en,
        priceHalala: halala(m.price), image: `food/${m.slug}`,
        recipe: { create: recipe.map((r) => ({ organizationId: O, ingredientId: ing[r.slug]!.id, qtyMilli: r.qty, wasteBp: r.waste })) },
      },
    });
    if (['meat', 'burgers'].includes(m.cat)) {
      await prisma.menuItemModifierGroup.create({ data: { organizationId: O, menuItemId: row.id, groupId: doneness.id } });
    }
    menu[m.slug] = {
      id: row.id, price: halala(m.price), station: m.station, def: m, recipe,
      cost: recipeCost(recipe.map((r) => ({ qtyMilli: r.qty, wasteBp: r.waste, unitCost: ing[r.slug]!.cost }))),
    };
  }
  const menuList = Object.values(menu);
  const thisWeekStart = riyadhDayStart(now) - 6 * DAY;
  // Daily ingredient price noise (and an 18% chicken price rise this week) so margins move over time.
  const dayNoise = new Map<string, number>();
  const dayCost = (slug: string, day: number) => {
    const m = menu[slug]!;
    return recipeCost(
      m.recipe.map((r) => {
        const k = `${r.slug}|${day}`;
        if (!dayNoise.has(k)) dayNoise.set(k, 1 + between(-0.06, 0.06));
        const rise = r.slug === 'chicken-breast' && day >= thisWeekStart ? 1.18 : 1;
        return { qtyMilli: r.qty, wasteBp: r.waste, unitCost: Math.round(ing[r.slug]!.cost * dayNoise.get(k)! * rise) };
      }),
    );
  };

  // ---------- Floors and tables (main branch) ----------
  const floorIds: Record<string, string> = {};
  const floorNames = { ground: ['الدور الأرضي', 'Floor 1'], first: ['الدور الأول', 'Floor 2'], terrace: ['التراس', 'Terrace'] } as const;
  for (const [i, f] of (['ground', 'first', 'terrace'] as const).entries()) {
    floorIds[f] = (await prisma.floor.create({
      data: { organizationId: O, branchId: main.id, nameAr: floorNames[f][0], nameEn: floorNames[f][1], sort: i, layout: FLOOR_LAYOUTS[f] as Prisma.InputJsonValue },
    })).id;
  }
  const tableIds: Record<number, string> = {};
  for (const t of TABLES) {
    tableIds[t.label] = (await prisma.diningTable.create({
      data: { organizationId: O, floorId: floorIds[t.floor]!, label: t.label, seats: t.seats, x: t.x, y: t.y, shape: t.shape, section: t.section },
    })).id;
  }
  // Other branches get a simple hall each so they are usable.
  for (const b of branches.slice(1)) {
    const f = await prisma.floor.create({ data: { organizationId: O, branchId: b.id, nameAr: 'الصالة', nameEn: 'Main Hall', layout: { walls: true } } });
    for (let i = 0; i < 12; i++) {
      await prisma.diningTable.create({
        data: { organizationId: O, floorId: f.id, label: i + 1, seats: 4, x: 120 + (i % 4) * 230, y: 140 + Math.floor(i / 4) * 200 },
      });
    }
  }

  await prisma.deliveryChannel.createMany({
    data: branches.flatMap((b) => [
      { organizationId: O, branchId: b.id, platform: 'hungerstation', commissionBp: 2000 },
      { organizationId: O, branchId: b.id, platform: 'jahez', commissionBp: 1800 },
      { organizationId: O, branchId: b.id, platform: 'keeta', commissionBp: 1500 },
    ]),
  });

  // ---------- 30 days of history ----------
  const orders: Prisma.OrderCreateManyInput[] = [];
  const items: Prisma.OrderItemCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const feedback: Prisma.FeedbackCreateManyInput[] = [];
  const tickets: Prisma.KitchenTicketCreateManyInput[] = [];
  const usage = new Map<string, number>(); // `${branchId}|${dayStart}|${slug}` -> qtyMilli
  const startDay = riyadhDayStart(now) - 29 * DAY;
  const historyEnd = now - 70 * MIN;
  const numbers: Record<string, number> = Object.fromEntries(branches.map((b) => [b.id, 1000]));
  const pendingByBranch: Record<string, { order: Prisma.OrderCreateManyInput; lines: Prisma.OrderItemCreateManyInput[] }[]> = {};

  for (const [bi, b] of branchDefs.entries()) {
    const branch = branches[bi]!;
    pendingByBranch[branch.id] = [];
    for (let d = 0; d < 30; d++) {
      const dayStart = startDay + d * DAY;
      const weekday = new Date(dayStart + RIYADH).getUTCDay(); // 4=Thu 5=Fri 6=Sat
      const weekend = weekday === 4 || weekday === 5 ? 1.25 : weekday === 6 ? 1.1 : 1;
      const trend = 1 + b.growth * (d >= 23 ? 1 : 0) + 0.004 * d;
      for (let h = 10; h <= 23; h++) {
        const n = poisson(b.base * HOUR_WEIGHTS[h]! * weekend * trend);
        for (let k = 0; k < n; k++) {
          const opened = dayStart + h * HOUR + int(0, 59) * MIN;
          if (opened > historyEnd) continue;
          const roll = rand();
          const channel = roll < 0.6 ? 'dine_in' : roll < 0.85 ? 'takeaway' : 'delivery';
          const lineCount = channel === 'dine_in' ? int(2, 4) : int(1, 3);
          const chosen = new Map<string, number>();
          for (let i = 0; i < lineCount; i++) {
            const m = weighted(menuList.map((x) => ({ ...x, weight: x.def.weight })));
            chosen.set(m.def.slug, (chosen.get(m.def.slug) ?? 0) + (rand() < 0.2 ? 2 : 1));
          }
          const lines = [...chosen.entries()].map(([slug, qty]) => ({ m: menu[slug]!, qty, cost: dayCost(slug, dayStart) }));
          const totals = computeTotals({ lines: lines.map((l) => ({ unitPrice: l.m.price, qty: l.qty })) });
          const id = randomUUID();
          const prep = between(9, 23);
          const readyAt = opened + prep * MIN;
          const closedAt = opened + between(35, 80) * MIN;
          const orderRow: Prisma.OrderCreateManyInput = {
            id, organizationId: O, branchId: branch.id, number: 0, channel,
            platform: channel === 'delivery' ? pick(['hungerstation', 'jahez', 'keeta']) : null,
            guests: channel === 'dine_in' ? int(1, 6) : null, waiterId: channel === 'dine_in' ? pick(waiters) : null,
            status: 'paid', subtotalHalala: totals.itemsTotal, vatHalala: totals.vat, totalHalala: totals.total,
            costHalala: lines.reduce((s, l) => s + l.cost * l.qty, 0),
            openedAt: new Date(opened), readyAt: new Date(readyAt), closedAt: new Date(closedAt),
          };
          const lineRows = lines.map((l) => ({
            id: randomUUID(), organizationId: O, orderId: id, menuItemId: l.m.id, stationId: stationsByBranch[branch.id]![l.m.station],
            qty: l.qty, unitPrice: l.m.price, unitCost: l.cost, status: 'served' as const, firedAt: new Date(opened), readyAt: new Date(readyAt),
          }));
          pendingByBranch[branch.id]!.push({ order: orderRow, lines: lineRows });
          for (const l of lines) {
            for (const r of l.m.recipe) {
              const k2 = `${branch.id}|${dayStart}|${r.slug}`;
              usage.set(k2, (usage.get(k2) ?? 0) + Math.round((r.qty * (10_000 + r.waste) * l.qty) / 10_000));
            }
          }
          payments.push({
            organizationId: O, orderId: id, method: pick(['mada', 'mada', 'mada', 'card', 'apple_pay', 'cash', 'stc_pay'] as const),
            amountHalala: totals.total, at: new Date(closedAt),
          });
          if (channel === 'dine_in' && rand() < 0.3) {
            const r = rand();
            const rating = r < 0.82 ? 5 : r < 0.94 ? 4 : r < 0.98 ? 3 : r < 0.99 ? 2 : 1;
            const c = rating === 5 && rand() < 0.3 ? pick(FEEDBACK_COMMENTS) : null;
            feedback.push({
              organizationId: O, branchId: branch.id, orderId: id, rating, comment: c?.text ?? null, authorName: c?.author ?? null,
              at: new Date(closedAt + 10 * MIN),
            });
          }
          if (opened >= riyadhDayStart(now)) {
            for (const st of new Set(lines.map((l) => l.m.station))) {
              tickets.push({
                organizationId: O, orderId: id, stationId: stationsByBranch[branch.id]![st]!, status: 'served',
                createdAt: new Date(opened), readyAt: new Date(readyAt - between(0, 3) * MIN),
              });
            }
          }
        }
      }
    }
  }

  // ---------- Live service in the main branch ----------
  const T = (label: number) => tableIds[label]!;
  type Live = { min: number; table?: number; channel?: 'dine_in' | 'takeaway' | 'delivery'; guests?: number; status: 'in_progress' | 'ready' | 'served'; items: [string, number, string[]?][]; notes?: string };
  // prettier-ignore
  const live: Live[] = [
    { min: 75, table: 19, guests: 4, status: 'served', items: [['chicken-kabsa', 2], ['hummus', 1], ['saudi-coffee', 2]] },
    { min: 70, table: 22, guests: 3, status: 'served', items: [['lamb-mandi', 1], ['greek-salad', 1], ['soft-drink', 2]] },
    { min: 66, table: 23, guests: 2, status: 'served', items: [['margherita-pizza', 1], ['caesar-salad', 1]] },
    { min: 62, table: 30, guests: 2, status: 'served', items: [['chicken-shawarma', 2], ['french-fries', 1]] },
    { min: 58, table: 31, guests: 4, status: 'served', items: [['mixed-grill', 1], ['hummus', 1], ['mutabbal', 1], ['mint-lemonade', 2]] },
    { min: 55, table: 32, guests: 3, status: 'served', items: [['beef-burger', 2], ['onion-rings', 1]] },
    { min: 52, channel: 'takeaway', status: 'ready', items: [['tomato-soup', 1], ['grilled-cheese', 1]] },
    { min: 50, table: 33, guests: 2, status: 'served', items: [['grilled-salmon', 1], ['garden-salad', 1]] },
    { min: 47, table: 38, guests: 4, status: 'served', items: [['chicken-kabsa', 1], ['lamb-mandi', 1], ['saudi-coffee', 3]] },
    { min: 44, table: 39, guests: 3, status: 'served', items: [['kunafa', 2], ['cappuccino', 2]] },
    { min: 40, table: 40, guests: 6, status: 'served', items: [['lamb-mandi', 2], ['chicken-kabsa', 2], ['hummus', 2]] },
    { min: 32, table: 11, guests: 3, status: 'ready', items: [['grilled-salmon', 1], ['roasted-veggies', 1]] },
    { min: 30, table: 29, guests: 6, status: 'in_progress', items: [['bbq-ribs', 2, ['Well Done']], ['seafood-pasta', 1]] },
    { min: 26, table: 28, guests: 4, status: 'in_progress', items: [['ribeye-steak', 1, ['Medium']], ['americano', 2], ['fresh-juice', 1]] },
    { min: 25, channel: 'takeaway', status: 'ready', items: [['margherita-pizza', 1], ['soft-drink', 1]] },
    { min: 22, table: 27, guests: 4, status: 'in_progress', items: [['mixed-grill', 2, ['Medium']], ['lamb-chops', 1, ['Well Done']]] },
    { min: 18, table: 12, guests: 2, status: 'in_progress', items: [['chicken-breast', 3, ['Spicy']], ['beef-burger', 1, ['Medium']]] },
    { min: 16, table: 6, guests: 4, status: 'in_progress', items: [['pesto-pasta', 1], ['carbonara', 2]] },
    { min: 15, table: 17, guests: 2, status: 'in_progress', items: [['cappuccino', 1], ['iced-tea', 2]] },
    { min: 14, table: 26, guests: 2, status: 'in_progress', items: [['quinoa-salad', 2], ['garden-salad', 1]] },
    { min: 12, table: 25, guests: 2, status: 'in_progress', items: [['spaghetti-bolognese', 2], ['lasagna', 1], ['lemonade', 2]] },
    { min: 12, table: 7, guests: 2, status: 'in_progress', items: [['beef-steak', 2, ['Medium']], ['grilled-salmon', 1, ['Well Done']]], notes: 'بدون بصل من فضلك.' },
    { min: 10, table: 10, guests: 4, status: 'in_progress', items: [['chocolate-lava-cake', 2], ['cheesecake', 1]] },
    { min: 9, table: 24, guests: 3, status: 'in_progress', items: [['orange-juice', 2], ['mint-lemonade', 1]] },
    { min: 8, table: 3, guests: 3, status: 'in_progress', items: [['fettuccine-alfredo', 2], ['penne-arrabbiata', 1]] },
    { min: 6, table: 15, guests: 4, status: 'in_progress', items: [['caesar-salad', 3], ['greek-salad', 1]] },
    { min: 4, table: 2, guests: 2, status: 'in_progress', items: [['iced-latte', 2], ['fresh-juice', 1]] },
  ];
  const liveRows: { order: Prisma.OrderCreateManyInput; lines: Prisma.OrderItemCreateManyInput[]; live: Live }[] = [];
  for (const L of live) {
    const opened = now - L.min * MIN;
    const channel = L.channel ?? 'dine_in';
    const lines = L.items.map(([slug, qty]) => ({ m: menu[slug]!, qty }));
    const totals = computeTotals({ lines: lines.map((l) => ({ unitPrice: l.m.price, qty: l.qty })) });
    const id = randomUUID();
    const readyAt = L.status === 'in_progress' ? null : new Date(opened + Math.min(L.min - 2, between(12, 22)) * MIN);
    liveRows.push({
      live: L,
      order: {
        id, organizationId: O, branchId: main.id, number: 0, channel, tableId: L.table ? T(L.table) : null, guests: L.guests ?? null,
        waiterId: L.table ? (L.table === 7 ? users['omar@sufra.demo'] : pick(waiters)) : null, status: L.status, notes: L.notes ?? null,
        subtotalHalala: totals.itemsTotal, vatHalala: totals.vat, totalHalala: totals.total,
        costHalala: lines.reduce((s, l) => s + l.m.cost * l.qty, 0), openedAt: new Date(opened), readyAt,
      },
      lines: L.items.map(([slug, qty, mods]) => ({
        id: randomUUID(), organizationId: O, orderId: id, menuItemId: menu[slug]!.id, stationId: stationsByBranch[main.id]![menu[slug]!.station],
        qty, unitPrice: menu[slug]!.price, unitCost: menu[slug]!.cost, modifiers: mods ?? [],
        status: L.status === 'in_progress' ? ('cooking' as const) : L.status === 'ready' ? ('ready' as const) : ('served' as const),
        firedAt: new Date(opened), readyAt,
      })),
    });
  }
  pendingByBranch[main.id]!.push(...liveRows.map((r) => ({ order: r.order, lines: r.lines })));

  // Assign order numbers chronologically per branch.
  for (const b of branches) {
    const list = pendingByBranch[b.id]!.sort((x, y) => (x.order.openedAt as Date).getTime() - (y.order.openedAt as Date).getTime());
    for (const e of list) {
      e.order.number = ++numbers[b.id]!;
      orders.push(e.order);
      items.push(...e.lines);
    }
  }
  console.log(`  ${orders.length} orders, ${items.length} order lines`);
  await createMany((d) => prisma.order.createMany({ data: d }), orders);
  await createMany((d) => prisma.orderItem.createMany({ data: d }), items);
  await createMany((d) => prisma.payment.createMany({ data: d }), payments);
  await createMany((d) => prisma.feedback.createMany({ data: d }), feedback);

  // Kitchen tickets for live orders
  for (const r of liveRows) {
    const stations = new Set(r.lines.map((l) => l.stationId as string));
    for (const s of stations) {
      tickets.push({
        organizationId: O, orderId: r.order.id!, stationId: s,
        status: r.live.status === 'in_progress' ? 'cooking' : r.live.status === 'ready' ? 'ready' : 'served',
        createdAt: r.order.openedAt as Date, readyAt: (r.order.readyAt as Date | null) ?? null, estimatedMin: int(12, 18),
      });
    }
  }
  await createMany((d) => prisma.kitchenTicket.createMany({ data: d }), tickets);

  // Table states
  const occupied = liveRows.filter((r) => r.live.table);
  for (const r of occupied) {
    await prisma.diningTable.update({
      where: { id: T(r.live.table!) },
      data: {
        status: 'occupied', guests: r.live.guests, occupiedSince: r.order.openedAt as Date, waiterId: r.order.waiterId as string,
        needsAttention: r.live.status === 'in_progress' && r.live.min > 25,
      },
    });
  }
  await prisma.diningTable.updateMany({ where: { id: { in: [T(14), T(37)] } }, data: { status: 'cleaning' } });
  await prisma.diningTable.updateMany({ where: { id: { in: [T(5), T(20)] } }, data: { status: 'out_of_service' } });

  // ---------- Stock: purchases, lots, daily usage, waste ----------
  const lots: Prisma.StockLotCreateManyInput[] = [];
  const moves: Prisma.StockMovementCreateManyInput[] = [];
  const thisWeek = riyadhDayStart(now) - 6 * DAY;
  for (const b of branches) {
    const scale = b.id === main.id ? 1 : b.id === branches[1]!.id ? 0.45 : 0.3;
    for (const d of INGREDIENTS) {
      const I = ing[d.slug]!;
      // Weekly deliveries over the last 5 weeks (historic lots are fully consumed). Chicken breast rose ~18% this week.
      for (let w = 4; w >= 0; w--) {
        const receivedAt = riyadhDayStart(now) - w * 7 * DAY - 2 * DAY + 8 * HOUR;
        const inflation = d.slug === 'chicken-breast' && receivedAt >= thisWeek ? 1.18 : 1 + between(-0.02, 0.03);
        const qtyMilli = Math.round(d.reorder * 2 * 1000 * scale);
        lots.push({
          organizationId: O, branchId: b.id, ingredientId: I.id, qtyMilli: 0, costPerUnit: Math.round(I.cost * inflation),
          receivedAt: new Date(receivedAt), expiresAt: d.shelfDays ? new Date(receivedAt + d.shelfDays * DAY) : null,
        });
        moves.push({
          organizationId: O, branchId: b.id, ingredientId: I.id, qtyMilli, type: 'purchase', costHalala: Math.round((qtyMilli * I.cost * inflation) / 1000),
          at: new Date(receivedAt),
        });
      }
      // Current on-hand lot(s)
      const qtyMilli = Math.round(d.qty * 1000 * (b.id === main.id ? 1 : scale + 0.3));
      if (qtyMilli > 0) {
        const expiringSoon = b.id === main.id && ['tomatoes', 'lettuce', 'basil', 'salmon', 'milk', 'chicken-breast', 'yogurt', 'mint'].includes(d.slug);
        const receivedAt = now - (expiringSoon ? 2 : 1) * DAY;
        lots.push({
          organizationId: O, branchId: b.id, ingredientId: I.id, qtyMilli,
          costPerUnit: d.slug === 'chicken-breast' ? Math.round(I.cost * 1.18) : I.cost,
          receivedAt: new Date(receivedAt),
          expiresAt: d.shelfDays ? new Date(now + (expiringSoon ? int(1, 2) : Math.max(4, d.shelfDays)) * DAY) : null,
        });
      }
    }
  }
  for (const [k, qty] of usage) {
    const [branchId, day, slug] = k.split('|');
    const I = ing[slug!]!;
    moves.push({
      organizationId: O, branchId: branchId!, ingredientId: I.id, qtyMilli: -qty, type: 'sale',
      costHalala: Math.round((qty * I.cost) / 1000), at: new Date(Math.min(Number(day) + 23 * HOUR, now - 30 * MIN)), reason: 'daily sales (aggregated)',
    });
  }
  // Waste: produce waste is ~22% higher this week.
  for (const b of branches) {
    for (let d = 0; d < 29; d++) {
      const day = startDay + d * DAY;
      for (const slug of ['tomatoes', 'lettuce', 'basil', 'mint', 'parsley', 'cucumbers', 'salmon', 'milk', 'bread-crumbs']) {
        const I = ing[slug]!;
        const factor = (I.def.category === 'produce' && day >= thisWeek ? 1.22 : 1) * (b.id === main.id ? 1 : 0.4);
        const qty = Math.round(between(0.15, 0.6) * 1000 * factor * (I.def.category === 'produce' ? 1.4 : 0.5));
        moves.push({
          organizationId: O, branchId: b.id, ingredientId: I.id, qtyMilli: -qty, type: 'waste', reason: 'end of day',
          costHalala: Math.round((qty * I.cost) / 1000), at: new Date(day + 23 * HOUR + 30 * MIN),
        });
      }
    }
  }
  // Today's visible activity in the main branch.
  const todayStart = riyadhDayStart(now);
  const hhmm = (h: number, m: number) => Math.min(now - 5 * MIN, todayStart + h * HOUR + m * MIN);
  const todayMoves: [string, number, 'purchase' | 'adjust', number][] = [
    ['tomatoes', 10, 'purchase', hhmm(10, 24)], ['chicken-breast', -5, 'adjust', hhmm(9, 12)], ['lettuce', 6, 'purchase', hhmm(8, 45)],
    ['mozzarella', 2, 'purchase', hhmm(8, 20)], ['olive-oil', 5, 'purchase', hhmm(7, 50)], ['salmon', -1, 'adjust', hhmm(7, 32)],
    ['onions', 8, 'purchase', hhmm(6, 55)], ['basil', -0.5, 'adjust', hhmm(6, 20)], ['eggs', 10, 'purchase', hhmm(5, 48)],
  ];
  for (const [slug, q, type, at] of todayMoves) {
    const I = ing[slug]!;
    moves.push({
      organizationId: O, branchId: main.id, ingredientId: I.id, qtyMilli: Math.round(q * 1000), type, reason: type === 'adjust' ? 'stock count' : null,
      costHalala: Math.round((Math.abs(q) * 1000 * I.cost) / 1000), at: new Date(at),
    });
  }
  await createMany((d) => prisma.stockLot.createMany({ data: d }), lots);
  await createMany((d) => prisma.stockMovement.createMany({ data: d }), moves);

  // ---------- Expenses (labor, overheads, packaging) ----------
  const expenses: Prisma.ExpenseCreateManyInput[] = [];
  for (const b of branches) {
    for (let d = 0; d < 30; d++) {
      const day = startDay + d * DAY;
      const dayCost = orders.filter((o) => o.branchId === b.id && (o.openedAt as Date).getTime() >= day && (o.openedAt as Date).getTime() < day + DAY)
        .reduce((s, o) => s + (o.costHalala ?? 0), 0);
      for (const [category, share] of [['labor', 18 / 68], ['overheads', 8 / 68], ['packaging', 6 / 68]] as const) {
        expenses.push({ organizationId: O, branchId: b.id, category, amountHalala: Math.round(dayCost * share * between(0.92, 1.08)), day: new Date(day + RIYADH) });
      }
    }
  }
  await prisma.expense.createMany({ data: expenses });

  // ---------- Activity feed, customers, reservations ----------
  const lastLive = liveRows[liveRows.length - 1]!.order;
  const readyLive = liveRows.find((r) => r.live.table === 11)!.order;
  const delayedLive = liveRows.find((r) => r.live.table === 27)!.order;
  await prisma.activityEvent.createMany({
    data: [
      { organizationId: O, branchId: main.id, kind: 'low_stock', data: { ingredientId: ing['tomatoes']!.id, qtyMilli: 2000 }, at: new Date(now - 25 * MIN) },
      { organizationId: O, branchId: main.id, kind: 'order_delayed', data: { number: delayedLive.number, minutes: 25 }, at: new Date(now - 18 * MIN) },
      { organizationId: O, branchId: main.id, kind: 'table_seated', data: { table: 8, walkIn: true }, at: new Date(now - 12 * MIN) },
      { organizationId: O, branchId: main.id, kind: 'order_ready', data: { number: readyLive.number, stationEn: 'Grill Station', stationAr: 'محطة الشواء' }, at: new Date(now - 8 * MIN) },
      { organizationId: O, branchId: main.id, kind: 'order_created', data: { number: lastLive.number, table: 2, items: 2 }, at: new Date(now - 4 * MIN) },
      { organizationId: O, branchId: main.id, kind: 'low_stock', data: { ingredientId: ing['basil']!.id, qtyMilli: 2000 }, at: new Date(hhmm(6, 20)) },
    ],
  });
  const names = ['محمد العنزي', 'نورة القحطاني', 'عبدالرحمن السهلي', 'لمى الشمري', 'تركي البقمي', 'جواهر العمري', 'سعود الرشيد', 'هيا الدوسري'];
  await prisma.customer.createMany({
    data: Array.from({ length: 40 }, (_, i) => ({
      organizationId: O, name: names[i % names.length]!, phoneEnc: encrypt(`05${String(50000000 + i * 7919).slice(0, 8)}`), createdAt: new Date(now - i * DAY),
    })),
  });
  await prisma.reservation.createMany({
    data: [
      { organizationId: O, branchId: main.id, guestName: 'عائلة الشهري', phoneEnc: encrypt('0551234567'), guests: 6, section: 'family', at: new Date(now + 3 * HOUR), tableId: T(18) },
      { organizationId: O, branchId: main.id, guestName: 'سلمان العتيبي', phoneEnc: encrypt('0569876543'), guests: 2, section: 'single', at: new Date(now + 5 * HOUR), tableId: T(13) },
      { organizationId: O, branchId: main.id, guestName: 'Lina K.', phoneEnc: encrypt('0501112233'), guests: 4, section: 'family', at: new Date(now + 6 * HOUR) },
    ],
  });
  await prisma.complianceDocument.createMany({
    data: [
      { organizationId: O, branchId: main.id, type: 'commercial_registration', number: '1010123456', expiresAt: new Date(now + 200 * DAY) },
      { organizationId: O, branchId: main.id, type: 'municipality_license', number: 'BL-44021', expiresAt: new Date(now + 12 * DAY) },
      { organizationId: O, branchId: main.id, type: 'civil_defense', number: 'CD-9921', expiresAt: new Date(now + 95 * DAY) },
    ],
  });
  await prisma.purchaseOrder.create({
    data: {
      organizationId: O, branchId: main.id, number: 1001, status: 'received', supplierId: supplierIds[0], createdById: managerId,
      createdAt: new Date(now - 3 * DAY), receivedAt: new Date(now - 2 * DAY),
      lines: { create: [{ organizationId: O, ingredientId: ing['tomatoes']!.id, qtyMilli: 20000, unitCost: ing['tomatoes']!.cost }] },
    },
  });

  console.log('Done.');
  console.log(`  Sign in: manager@sufra.demo / ${PASSWORD}   (owner@sufra.demo, chef@sufra.demo, … use the same password)`);
  console.log(`  Second tenant for isolation checks: owner@palm.demo / ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
