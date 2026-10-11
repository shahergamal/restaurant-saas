import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { listOrdersQuery } from '@sufra/shared';
import { RequirePermissions } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { OrdersService } from './orders.service';

const itemSchema = z.object({
  menuItemId: z.string().uuid(),
  qty: z.number().int().min(1).max(99),
  modifiers: z.array(z.string().max(40)).max(10).optional(),
  notes: z.string().max(200).optional(),
});
const createSchema = z.object({
  channel: z.enum(['dine_in', 'takeaway', 'delivery']),
  tableId: z.string().uuid().optional(),
  guests: z.number().int().min(1).max(50).optional(),
  notes: z.string().max(300).optional(),
  items: z.array(itemSchema).min(1).max(100),
  discountBp: z.number().int().min(0).max(10_000).optional(),
});
const addItemsSchema = z.object({ items: z.array(itemSchema).min(1).max(100) });
const paySchema = z.object({
  payments: z.array(z.object({ method: z.enum(['cash', 'mada', 'card', 'apple_pay', 'stc_pay']), amount: z.number().int().min(1) })).min(1).max(5),
});
const splitSchema = z.object({ parts: z.number().int().min(2).max(20) });
const cancelSchema = z.object({ reason: z.string().trim().min(3).max(200) });

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermissions('orders.view')
  list(@Query(new ZodPipe(listOrdersQuery)) q: z.infer<typeof listOrdersQuery>) {
    return this.orders.list(q);
  }

  @Get(':id')
  @RequirePermissions('orders.view')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.get(id);
  }

  @Post()
  @RequirePermissions('orders.create')
  create(@Body(new ZodPipe(createSchema)) body: z.infer<typeof createSchema>) {
    return this.orders.create(body);
  }

  @Patch(':id/items')
  @RequirePermissions('orders.update')
  addItems(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(addItemsSchema)) body: z.infer<typeof addItemsSchema>) {
    return this.orders.addItems(id, body.items);
  }

  @Post(':id/ready')
  @HttpCode(200)
  @RequirePermissions('orders.update')
  ready(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.markReady(id);
  }

  @Post(':id/serve')
  @HttpCode(200)
  @RequirePermissions('orders.update')
  serve(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.serve(id);
  }

  @Post(':id/split')
  @HttpCode(200)
  @RequirePermissions('orders.update')
  split(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(splitSchema)) body: z.infer<typeof splitSchema>) {
    return this.orders.splitPreview(id, body.parts);
  }

  @Post(':id/pay')
  @HttpCode(200)
  @RequirePermissions('orders.update')
  pay(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(paySchema)) body: z.infer<typeof paySchema>) {
    return this.orders.pay(id, body.payments);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('orders.cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(cancelSchema)) body: z.infer<typeof cancelSchema>) {
    return this.orders.cancel(id, body.reason);
  }
}
