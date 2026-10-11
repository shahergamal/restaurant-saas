import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { createIngredientSchema, inventoryQuery } from '@sufra/shared';
import { RequirePermissions } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { InventoryService } from './inventory.service';

const moveSchema = z.object({
  ingredientId: z.string().uuid(),
  type: z.enum(['waste', 'adjust']),
  qty: z.number().min(-100_000).max(100_000).refine((v) => v !== 0),
  reason: z.string().trim().min(2).max(200),
});
const poSchema = z.object({ ingredientIds: z.array(z.string().uuid()).min(1).max(100) });

@ApiTags('inventory')
@Controller()
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('inventory/summary')
  @RequirePermissions('inventory.view')
  summary() {
    return this.inventory.summary();
  }

  @Get('inventory/ingredients')
  @RequirePermissions('inventory.view')
  list(@Query(new ZodPipe(inventoryQuery)) q: z.infer<typeof inventoryQuery>) {
    return this.inventory.list(q);
  }

  @Post('inventory/ingredients')
  @RequirePermissions('inventory.manage')
  create(@Body(new ZodPipe(createIngredientSchema)) body: z.infer<typeof createIngredientSchema>) {
    return this.inventory.createIngredient(body);
  }

  @Get('inventory/activity')
  @RequirePermissions('inventory.view')
  activity() {
    return this.inventory.activity();
  }

  @Get('inventory/action-needed')
  @RequirePermissions('inventory.view')
  actionNeeded() {
    return this.inventory.actionNeeded();
  }

  @Post('inventory/movements')
  @RequirePermissions('inventory.manage')
  move(@Body(new ZodPipe(moveSchema)) body: z.infer<typeof moveSchema>) {
    return this.inventory.move(body);
  }

  @Get('inventory/export.csv')
  @RequirePermissions('inventory.view')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="inventory.csv"')
  export() {
    return this.inventory.csv();
  }

  @Get('purchase-orders')
  @RequirePermissions('purchasing.manage')
  listPos() {
    return this.inventory.listPurchaseOrders();
  }

  @Post('purchase-orders')
  @RequirePermissions('purchasing.manage')
  createPo(@Body(new ZodPipe(poSchema)) body: z.infer<typeof poSchema>) {
    return this.inventory.createPurchaseOrder(body.ingredientIds);
  }

  @Post('purchase-orders/:id/receive')
  @HttpCode(200)
  @RequirePermissions('purchasing.manage')
  receive(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventory.receivePurchaseOrder(id);
  }
}
