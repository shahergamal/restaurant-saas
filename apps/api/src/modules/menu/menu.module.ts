import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { marginBp, recipeCost } from '@sufra/shared';
import { AuditService } from '../../common/audit.service';
import { RequirePermissions } from '../../common/decorators';
import { DbService } from '../../common/prisma.service';
import { ctx } from '../../common/tenant-context';
import { ZodPipe } from '../../common/zod.pipe';

const price = z.number().int().min(0).max(10_000_000);
const createItemSchema = z.object({
  categoryId: z.string().uuid(),
  stationId: z.string().uuid().nullable().optional(),
  nameAr: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  priceHalala: price,
});
const updateItemSchema = createItemSchema.partial().extend({ active: z.boolean().optional() });
const categorySchema = z.object({ nameAr: z.string().trim().min(1).max(60), nameEn: z.string().trim().min(1).max(60) });
const recipeSchema = z.object({
  lines: z.array(z.object({ ingredientId: z.string().uuid(), qtyMilli: z.number().int().min(1).max(10_000_000), wasteBp: z.number().int().min(0).max(5000) })).max(50),
});

@Injectable()
export class MenuService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  categories() {
    return this.db.client.menuCategory.findMany({ orderBy: { sort: 'asc' }, include: { _count: { select: { items: true } } } });
  }

  async items() {
    const items = await this.db.client.menuItem.findMany({
      orderBy: [{ category: { sort: 'asc' } }, { nameEn: 'asc' }],
      include: { category: true, station: true, recipe: { include: { ingredient: true } } },
    });
    return items.map((m) => {
      const cost = recipeCost(m.recipe.map((r) => ({ qtyMilli: r.qtyMilli, wasteBp: r.wasteBp, unitCost: r.ingredient.avgCostHalala })));
      return {
        id: m.id, slug: m.slug, nameAr: m.nameAr, nameEn: m.nameEn, image: m.image, priceHalala: m.priceHalala, active: m.active,
        category: { id: m.category.id, nameAr: m.category.nameAr, nameEn: m.category.nameEn },
        station: m.station && { id: m.station.id, nameAr: m.station.nameAr, nameEn: m.station.nameEn },
        cost, marginPct: Math.round(marginBp(m.priceHalala, cost, m.vatRateBp) / 100),
        recipe: m.recipe.map((r) => ({ ingredientId: r.ingredientId, nameAr: r.ingredient.nameAr, nameEn: r.ingredient.nameEn, unit: r.ingredient.unit, qtyMilli: r.qtyMilli, wasteBp: r.wasteBp })),
      };
    });
  }

  stations() {
    return this.db.client.station.findMany({ orderBy: { sort: 'asc' } });
  }

  async createCategory(input: z.infer<typeof categorySchema>) {
    const count = await this.db.client.menuCategory.count();
    const key = input.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '') || `cat_${count + 1}`;
    const cat = await this.db.client.menuCategory.create({ data: { organizationId: ctx().orgId!, key, sort: count, ...input } });
    await this.audit.log('menu.category.create', 'menu_category', cat.id, input);
    return cat;
  }

  async createItem(input: z.infer<typeof createItemSchema>) {
    const slug = input.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `item-${Date.now()}`;
    const cat = await this.db.client.menuCategory.findUnique({ where: { id: input.categoryId } });
    if (!cat) throw new BadRequestException('category_invalid');
    const item = await this.db.client.menuItem.create({ data: { organizationId: ctx().orgId!, slug, ...input } });
    await this.audit.log('menu.item.create', 'menu_item', item.id, input);
    return item;
  }

  async updateItem(id: string, input: z.infer<typeof updateItemSchema>) {
    const before = await this.db.client.menuItem.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('item_not_found');
    const item = await this.db.client.menuItem.update({ where: { id }, data: input });
    await this.audit.log('menu.item.update', 'menu_item', id, { before: { priceHalala: before.priceHalala, active: before.active }, after: input });
    return item;
  }

  async setRecipe(id: string, input: z.infer<typeof recipeSchema>) {
    const orgId = ctx().orgId!;
    await this.db.tx(async (tx) => {
      const item = await tx.menuItem.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('item_not_found');
      await tx.recipeLine.deleteMany({ where: { menuItemId: id } });
      if (input.lines.length) await tx.recipeLine.createMany({ data: input.lines.map((l) => ({ organizationId: orgId, menuItemId: id, ...l })) });
      await this.audit.log('menu.recipe.update', 'menu_item', id, input, tx);
    });
    return { ok: true };
  }
}

@ApiTags('menu')
@Controller('menu')
class MenuController {
  constructor(private readonly svc: MenuService) {}

  @Get('categories')
  @RequirePermissions('orders.view')
  categories() {
    return this.svc.categories();
  }

  @Post('categories')
  @RequirePermissions('recipes.manage')
  createCategory(@Body(new ZodPipe(categorySchema)) body: z.infer<typeof categorySchema>) {
    return this.svc.createCategory(body);
  }

  @Get('items')
  @RequirePermissions('orders.view')
  items() {
    return this.svc.items();
  }

  @Get('stations')
  @RequirePermissions('orders.view')
  stations() {
    return this.svc.stations();
  }

  @Post('items')
  @RequirePermissions('recipes.manage')
  create(@Body(new ZodPipe(createItemSchema)) body: z.infer<typeof createItemSchema>) {
    return this.svc.createItem(body);
  }

  @Patch('items/:id')
  @RequirePermissions('recipes.manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(updateItemSchema)) body: z.infer<typeof updateItemSchema>) {
    return this.svc.updateItem(id, body);
  }

  @Patch('items/:id/recipe')
  @RequirePermissions('recipes.manage')
  recipe(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(recipeSchema)) body: z.infer<typeof recipeSchema>) {
    return this.svc.setRecipe(id, body);
  }
}

@Module({ controllers: [MenuController], providers: [MenuService] })
export class MenuModule {}
